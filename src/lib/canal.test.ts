import { beforeEach, describe, expect, it } from "vitest";
import { marcarOrigenTienda, vinoDeTienda } from "./canal";

describe("origen del pedido", () => {
  beforeEach(() => window.localStorage.clear());
  it("reconoce la tienda visitada", () => {
    marcarOrigenTienda("c1");
    expect(vinoDeTienda("c1")).toBe(true);
    expect(vinoDeTienda("otro")).toBe(false);
  });
  it("vence a las 24 horas", () => {
    marcarOrigenTienda("c1");
    expect(vinoDeTienda("c1", Date.now() + 25 * 60 * 60 * 1000)).toBe(false);
  });
  it("sin visita no marca nada", () => {
    expect(vinoDeTienda("c1")).toBe(false);
  });
});
