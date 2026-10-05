import { describe, expect, it } from "vitest";
import { armarArbol, atributosAFilas, filasAAtributos, rutaDe, type Categoria } from "./categories";

const c = (id: string, nombre: string, parent_id: string | null, orden = 0): Categoria => ({ id, nombre, parent_id, slug: id, orden });
const rows = [c("m", "Moda", null, 2), c("h", "Hogar", null, 1), c("m2", "Mujer", "m", 1), c("m1", "Calzado", "m", 0), c("h1", "Muebles", "h")];

describe("categorías", () => {
  it("arma el árbol ordenado por orden y nombre", () => {
    const arbol = armarArbol(rows);
    expect(arbol.map((r) => r.nombre)).toEqual(["Hogar", "Moda"]);
    expect(arbol[1].hijas.map((h) => h.nombre)).toEqual(["Calzado", "Mujer"]);
  });
  it("muestra la ruta Raíz › Hija", () => {
    expect(rutaDe("m2", rows)).toBe("Moda › Mujer");
    expect(rutaDe("m", rows)).toBe("Moda");
    expect(rutaDe("zzz", rows)).toBeNull();
    expect(rutaDe(null, rows)).toBeNull();
  });
});

describe("atributos", () => {
  it("ida y vuelta", () => {
    expect(filasAAtributos(atributosAFilas({ color: "rojo", talle: "M" }))).toEqual({ color: "rojo", talle: "M" });
  });
  it("descarta vacíos y repetidos, y recorta a los límites", () => {
    const r = filasAAtributos([{ clave: " color ", valor: " rojo " }, { clave: "color", valor: "azul" }, { clave: "", valor: "x" }, { clave: "k", valor: "" }, { clave: "x".repeat(50), valor: "y".repeat(90) }]);
    expect(r.color).toBe("rojo");
    expect(Object.keys(r)).toHaveLength(2);
    expect(Object.keys(r)[1]).toHaveLength(30);
    expect(Object.values(r)[1]).toHaveLength(60);
  });
  it("no pasa de 12 atributos", () => {
    const filas = Array.from({ length: 20 }, (_, i) => ({ clave: `k${i}`, valor: "v" }));
    expect(Object.keys(filasAAtributos(filas))).toHaveLength(12);
  });
});
