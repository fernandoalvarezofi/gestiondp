import { describe, expect, it } from "vitest";
import { combinarVariantes } from "./VariantsEditor";

describe("combinarVariantes", () => {
  it("combina dos ejes", () => {
    expect(combinarVariantes([["S", "M"], ["Negro", "Blanco"]])).toEqual(["S / Negro", "S / Blanco", "M / Negro", "M / Blanco"]);
  });
  it("con un solo eje devuelve sus valores", () => {
    expect(combinarVariantes([["S", "M"], []])).toEqual(["S", "M"]);
  });
  it("sin datos no crea nada", () => {
    expect(combinarVariantes([[], []])).toEqual([]);
  });
  it("limita a 100 combinaciones", () => {
    const eje = Array.from({ length: 20 }, (_, i) => `v${i}`);
    expect(combinarVariantes([eje, eje]).length).toBe(100);
  });
});
