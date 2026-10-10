import { describe, expect, it } from "vitest";
import { combinar, deducirEjes } from "./VariantesPanel";

describe("variantes con opciones", () => {
  it("combina las opciones en orden", () => {
    expect(combinar([{ nombre: "Talle", valores: ["S", "M"] }, { nombre: "Color", valores: ["Negro", "Blanco"] }])).toEqual(["S / Negro", "S / Blanco", "M / Negro", "M / Blanco"]);
  });
  it("ignora opciones sin valores", () => {
    expect(combinar([{ nombre: "Talle", valores: ["S", "M"] }, { nombre: "Color", valores: [] }])).toEqual(["S", "M"]);
    expect(combinar([])).toEqual([]);
  });
  it("tres opciones", () => {
    expect(combinar([{ nombre: "A", valores: ["1", "2"] }, { nombre: "B", valores: ["x"] }, { nombre: "C", valores: ["p", "q"] }])).toHaveLength(4);
  });
  it("deduce las opciones de variantes existentes", () => {
    expect(deducirEjes(["S / Negro", "M / Negro", "S / Blanco"])).toEqual([{ nombre: "Opción 1", valores: ["S", "M"] }, { nombre: "Opción 2", valores: ["Negro", "Blanco"] }]);
    expect(deducirEjes(["Chico", "Grande"])).toEqual([{ nombre: "Opción", valores: ["Chico", "Grande"] }]);
    expect(deducirEjes(["S / Negro", "Único"])).toEqual([{ nombre: "Opción", valores: ["S / Negro", "Único"] }]);
  });
});
