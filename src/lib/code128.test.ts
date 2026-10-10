import { describe, expect, it } from "vitest";
import { code128 } from "./code128";

describe("Code 128", () => {
  it("cada símbolo suma 11 módulos y el de fin 13", () => {
    const m = code128("WR0001000001");
    // inicio + 12 caracteres + control = 14 símbolos de 11 módulos; fin = 13 módulos.
    expect(m.reduce((a, b) => a + b, 0)).toBe(14 * 11 + 13);
  });
  it("dígito de control conocido", () => {
    // "PJJ123C": 104 + 48·1 + 42·2 + 42·3 + 17·4 + 18·5 + 19·6 + 35·7 = 879 → 879 mod 103 = 55 → "311321".
    // El patrón de fin tiene 7 elementos (barras y espacios), el de control 6 justo antes.
    const m = code128("PJJ123C");
    const control = m.slice(-7 - 6, -7).join("");
    expect(control).toBe("311321");
  });
  it("rechaza caracteres fuera de rango", () => {
    expect(() => code128("Ñ")).toThrow();
  });
});
