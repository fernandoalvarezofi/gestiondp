import { describe, expect, it } from "vitest";
import { explicarPuntaje } from "./dispatch";

describe("explicarPuntaje", () => {
  it("describe cada componente que pesa", () => {
    const t = explicarPuntaje({ distancia: 1.234, carga: 0.5, rechazos: 0.3, velocidad: -0.25, ocupado: 0, total: 1.8 });
    expect(t).toContain("1.2 km al local");
    expect(t).toContain("+0.50 por pedidos recientes");
    expect(t).toContain("+0.30 por rechazos");
    expect(t).toContain("-0.25 por velocidad");
    expect(t).not.toContain("en reparto");
  });
  it("avisa si no hay ubicación reciente", () => {
    expect(explicarPuntaje({ distancia: 9999, carga: 0, rechazos: 0, velocidad: 0, ocupado: 0, total: 9999 })).toBe("sin ubicación reciente");
  });
  it("marca el descuento por estar ya en reparto", () => {
    expect(explicarPuntaje({ distancia: 2, carga: 0, rechazos: 0, velocidad: 0, ocupado: -1, total: 1 })).toContain("-1 por estar en reparto");
  });
});
