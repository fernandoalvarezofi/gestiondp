import { describe, expect, it } from "vitest";
import { sumar, ultimo } from "./BusinessMetrics";

const filas = [
  { dia: "2026-10-03", clave: "ventas", valor: 100 },
  { dia: "2026-10-04", clave: "ventas", valor: 250 },
  { dia: "2026-10-04", clave: "pedidos", valor: 3 },
  { dia: "2026-10-03", clave: "comercios_activos", valor: 18 },
  { dia: "2026-10-04", clave: "comercios_activos", valor: 19 },
];

describe("métricas del negocio", () => {
  it("suma solo los días pedidos", () => {
    expect(sumar(filas, "ventas", new Set(["2026-10-04"]))).toBe(250);
    expect(sumar(filas, "ventas", new Set(["2026-10-03", "2026-10-04"]))).toBe(350);
  });
  it("devuelve 0 si no hay datos", () => {
    expect(sumar(filas, "ventas", new Set(["2026-01-01"]))).toBe(0);
  });
  it("toma el último valor de un indicador de estado", () => {
    expect(ultimo(filas, "comercios_activos")).toBe(19);
    expect(ultimo(filas, "no_existe")).toBeNull();
  });
});
