import { describe, expect, it } from "vitest";
import { antiguedad, descuentoPct, filtrarYOrdenar, fotosDe, insignias, nivelReputacion, SIN_FILTROS, tramosDePrecio } from "./marketplace";

const producto = (extra: Record<string, unknown> = {}) => ({ id: "p1", precio: 1000, precio_anterior: null, stock: null, created_at: "2020-01-01T00:00:00Z", destacado: false, orden: 0, ...extra }) as never;

describe("nivelReputacion", () => {
  it("un vendedor con pocas ventas es nuevo, aunque tenga buena nota", () => {
    expect(nivelReputacion({ entregados: 2, rating: 5, resenas: 2, positivas: 100 }).nivel).toBe(1);
  });
  it("sin calificación no se inventa un nivel", () => {
    expect(nivelReputacion({ entregados: 100, rating: 0, resenas: 0, positivas: null }).nivel).toBe(1);
  });
  it("el nivel más alto exige nota, volumen y opiniones positivas", () => {
    expect(nivelReputacion({ entregados: 40, rating: 4.8, resenas: 40, positivas: 95 }).nivel).toBe(5);
    expect(nivelReputacion({ entregados: 40, rating: 4.8, resenas: 40, positivas: 70 }).nivel).toBe(4);
    expect(nivelReputacion({ entregados: 10, rating: 4.8, resenas: 10, positivas: 95 }).nivel).toBe(4);
  });
  it("las notas bajas dan niveles bajos", () => {
    expect(nivelReputacion({ entregados: 50, rating: 3.8, resenas: 50, positivas: 70 }).nivel).toBe(3);
    expect(nivelReputacion({ entregados: 50, rating: 2.9, resenas: 50, positivas: 40 }).nivel).toBe(2);
  });
});

describe("insignias", () => {
  const ahora = new Date("2026-10-04T12:00:00Z");
  it("calcula el descuento solo si el precio anterior es mayor", () => {
    expect(descuentoPct({ precio: 750, precio_anterior: 1000 } as never)).toBe(25);
    expect(descuentoPct({ precio: 1000, precio_anterior: 900 } as never)).toBeNull();
    expect(descuentoPct({ precio: 1000, precio_anterior: null } as never)).toBeNull();
  });
  it("marca oferta, nuevo, últimas unidades y más vendido", () => {
    const lista = insignias(producto({ precio: 800, precio_anterior: 1000, stock: 2, created_at: "2026-10-01T00:00:00Z" }), ["p1"], ahora);
    expect(lista.map((item) => item.id)).toEqual(["oferta", "masvendido", "nuevo", "ultimas"]);
    expect(lista[0].texto).toBe("20% OFF");
  });
  it("sin motivos no hay insignias", () => {
    expect(insignias(producto(), [], ahora)).toEqual([]);
    expect(insignias(producto({ stock: 0 }), [], ahora)).toEqual([]);
  });
});

describe("filtrarYOrdenar", () => {
  const lista = [
    producto({ id: "a", precio: 300, precio_anterior: 400, created_at: "2026-01-01T00:00:00Z" }),
    producto({ id: "b", precio: 100, created_at: "2026-03-01T00:00:00Z" }),
    producto({ id: "c", precio: 200, destacado: true, created_at: "2026-02-01T00:00:00Z" }),
  ] as { id: string; precio: number }[];
  it("filtra por rango de precio y por ofertas", () => {
    expect(filtrarYOrdenar(lista as never[], { ...SIN_FILTROS, min: 150, max: 250 }).map((x) => (x as { id: string }).id)).toEqual(["c"]);
    expect(filtrarYOrdenar(lista as never[], { ...SIN_FILTROS, soloOferta: true }).map((x) => (x as { id: string }).id)).toEqual(["a"]);
  });
  it("ordena por precio y por novedad", () => {
    expect(filtrarYOrdenar(lista as never[], { ...SIN_FILTROS, orden: "menor" }).map((x) => (x as { id: string }).id)).toEqual(["b", "c", "a"]);
    expect(filtrarYOrdenar(lista as never[], { ...SIN_FILTROS, orden: "mayor" }).map((x) => (x as { id: string }).id)).toEqual(["a", "c", "b"]);
    expect(filtrarYOrdenar(lista as never[], { ...SIN_FILTROS, orden: "nuevos" }).map((x) => (x as { id: string }).id)).toEqual(["b", "c", "a"]);
  });
  it("la relevancia pone primero lo más vendido y los destacados", () => {
    expect(filtrarYOrdenar(lista as never[], SIN_FILTROS, ["a"]).map((x) => (x as { id: string }).id)).toEqual(["a", "c", "b"]);
  });
  it("no modifica la lista original", () => {
    const copia = [...lista];
    filtrarYOrdenar(lista as never[], { ...SIN_FILTROS, orden: "menor" });
    expect(lista).toEqual(copia);
  });
});

describe("tramosDePrecio y fotos", () => {
  it("con pocos productos no sugiere tramos", () => {
    expect(tramosDePrecio([100, 200])).toEqual([]);
  });
  it("arma tramos que cubren todo el rango", () => {
    const tramos = tramosDePrecio([1000, 2000, 3000, 4000, 5000, 6000, 7000, 8000]);
    expect(tramos[0].min).toBe(0);
    expect(tramos[tramos.length - 1].max).toBeNull();
    for (let i = 1; i < tramos.length; i += 1) expect(tramos[i].min).toBe(tramos[i - 1].max);
  });
  it("las fotos no se repiten y descartan enlaces inseguros", () => {
    expect(fotosDe({ imagen_url: "https://a.com/1.jpg", imagenes: ["https://a.com/1.jpg", "https://a.com/2.jpg", "javascript:alert(1)"] })).toEqual(["https://a.com/1.jpg", "https://a.com/2.jpg"]);
    expect(fotosDe({ imagen_url: null, imagenes: null })).toEqual([]);
  });
  it("la antigüedad se escribe en español", () => {
    expect(antiguedad("2026-01-15T00:00:00Z", new Date("2026-10-04T00:00:00Z"))).toContain("Vende en Woref desde");
    expect(antiguedad("2026-10-02T00:00:00Z", new Date("2026-10-04T00:00:00Z"))).toBe("Vende en Woref desde este mes");
  });
});
