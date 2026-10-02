import { afterEach, describe, expect, it, vi } from "vitest";
import { distanceKm, formatKm, searchAddresses, storeReach } from "./geo";

const photon = (features: unknown[]) => ({ ok: true, json: async () => ({ features }) });
const feature = (props: Record<string, string>, lng = -58.39, lat = -34.6) => ({ geometry: { coordinates: [lng, lat] }, properties: { country: "Argentina", ...props } });

afterEach(() => vi.unstubAllGlobals());

describe("distancia y zona", () => {
  it("calcula la distancia en línea recta", () => {
    const km = distanceKm({ lat: -34.6037, lng: -58.3816 }, { lat: -34.5875, lng: -58.4300 });
    expect(km).toBeGreaterThan(4);
    expect(km).toBeLessThan(5);
  });

  it("formatea metros y kilómetros", () => {
    expect(formatKm(0.45)).toBe("450 m");
    expect(formatKm(2.34)).toBe("2,3 km");
  });

  it("marca fuera de zona y calcula el envío igual que el servidor", () => {
    const store = { costo_envio: 1000, envio_gratis_desde: null, latitud: -34.6, longitud: -58.38, radio_entrega_km: 3, costo_por_km: 200 };
    const near = storeReach(store, { lat: -34.605, lng: -58.385 });
    expect(near.inZone).toBe(true);
    expect(near.fee % 10).toBe(0);
    expect(near.fee).toBeGreaterThan(1000);
    expect(storeReach(store, { lat: -34.7, lng: -58.5 }).inZone).toBe(false);
  });

  it("sin dirección con ubicación asume que llega y usa el costo base", () => {
    const store = { costo_envio: 1500, envio_gratis_desde: null, latitud: -34.6, longitud: -58.38 };
    expect(storeReach(store, null)).toEqual({ km: null, inZone: true, fee: 1500 });
  });
});

describe("búsqueda de direcciones", () => {
  it("prioriza resultados con calle y número y quita duplicados", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => photon([
      feature({ name: "Avenida Corrientes", street: "Avenida Corrientes", city: "CABA" }),
      feature({ street: "Avenida Corrientes", housenumber: "1847", district: "Balvanera", city: "CABA" }),
      feature({ street: "Avenida Corrientes", housenumber: "1847", district: "Balvanera", city: "CABA" }),
    ])));
    const results = await searchAddresses("Corrientes 1847");
    expect(results[0].label).toBe("Avenida Corrientes 1847");
    expect(results[0].precision).toBe("exacta");
    expect(results.filter((item) => item.label === "Avenida Corrientes 1847")).toHaveLength(1);
  });

  it("conserva el número que escribió la persona si el resultado solo trae la calle", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => photon([feature({ name: "Bartolomé Mitre", street: "Bartolomé Mitre", city: "Lincoln" })])));
    const [first] = await searchAddresses("Mitre 450");
    expect(first.label).toBe("Bartolomé Mitre 450");
    expect(first.precision).toBe("calle");
  });

  it("descarta resultados de otros países", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => photon([feature({ street: "Calle Mayor", housenumber: "1", country: "España" })])));
    // Photon devuelve solo España: cae a Nominatim, que acá no devuelve nada.
    const calls: string[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      calls.push(url);
      return url.includes("photon") ? photon([feature({ street: "Calle Mayor", housenumber: "1", country: "España" })]) : { ok: true, json: async () => [] };
    }));
    expect(await searchAddresses("Calle Mayor 1")).toEqual([]);
    expect(calls.some((url) => url.includes("nominatim"))).toBe(true);
  });

  it("si Photon falla usa Nominatim", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: string) => {
      if (url.includes("photon")) throw new Error("caído");
      return { ok: true, json: async () => [{ lat: "-34.86", lon: "-61.53", display_name: "Mitre 450, Lincoln", address: { road: "Bartolomé Mitre", house_number: "450", town: "Lincoln", state: "Buenos Aires" } }] };
    }));
    const [first] = await searchAddresses("Mitre 450 Lincoln");
    expect(first.label).toBe("Bartolomé Mitre 450");
    expect(first.detail).toContain("Lincoln");
    expect(first.precision).toBe("exacta");
  });

  it("no busca con menos de 3 letras", async () => {
    const spy = vi.fn();
    vi.stubGlobal("fetch", spy);
    expect(await searchAddresses("ab")).toEqual([]);
    expect(spy).not.toHaveBeenCalled();
  });
});
