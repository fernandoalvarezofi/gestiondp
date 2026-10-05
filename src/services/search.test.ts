import { describe, expect, it } from "vitest";
import { FILTROS_VACIOS, filtrosActivos, filtrosAUrl, filtrosDesdeUrl, hayBusqueda } from "./search";

const u = (s: string) => new URLSearchParams(s);
const UUID = "0b8f8a1e-6c1d-4f0a-9d5e-3c2b1a0f9e8d";

describe("filtros de búsqueda en la URL", () => {
  it("sin parámetros, valores por defecto", () => {
    expect(filtrosDesdeUrl(u(""))).toEqual(FILTROS_VACIOS);
  });
  it("ida y vuelta", () => {
    const f = { q: "zapatillas", categoria: UUID, marca: "Nikkon", min: 1000, max: 50000, conStock: false, ofertas: true, orden: "precio_asc" as const };
    expect(filtrosDesdeUrl(u(new URLSearchParams(filtrosAUrl(f)).toString()))).toEqual(f);
  });
  it("ignora valores inválidos o peligrosos", () => {
    const f = filtrosDesdeUrl(u(`cat=no-es-uuid&min=-5&max=abc&orden=drop&q=${"a".repeat(500)}&marca=${"b".repeat(200)}`));
    expect(f.categoria).toBeNull();
    expect(f.min).toBeNull();
    expect(f.max).toBeNull();
    expect(f.orden).toBe("relevancia");
    expect(f.q).toHaveLength(80);
    expect(f.marca).toHaveLength(60);
  });
  it("no ensucia la URL con valores por defecto", () => {
    expect(filtrosAUrl(FILTROS_VACIOS)).toEqual({});
    expect(filtrosAUrl({ ...FILTROS_VACIOS, q: "  pizza  " })).toEqual({ q: "pizza" });
  });
  it("hayBusqueda y filtrosActivos", () => {
    expect(hayBusqueda(FILTROS_VACIOS)).toBe(false);
    expect(hayBusqueda({ ...FILTROS_VACIOS, q: "p" })).toBe(false);
    expect(hayBusqueda({ ...FILTROS_VACIOS, q: "pi" })).toBe(true);
    expect(hayBusqueda({ ...FILTROS_VACIOS, ofertas: true })).toBe(true);
    expect(filtrosActivos({ ...FILTROS_VACIOS, ofertas: true, marca: "x", min: 1 })).toBe(3);
  });
});
