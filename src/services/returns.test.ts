import { describe, expect, it } from "vitest";
import { unidadesDisponibles, type Devolucion } from "./returns";

const dev = (estado: Devolucion["estado"], item_id: string, cantidad: number) => ({ estado, items: [{ item_id, nombre: "x", cantidad, precio_unitario: 1000 }] });

describe("unidadesDisponibles", () => {
  const items = [{ id: "a", cantidad: 3 }, { id: "b", cantidad: 1 }, { cantidad: 2 }];
  it("sin devoluciones, todo se puede devolver (los ítems sin id no cuentan)", () => {
    expect(unidadesDisponibles(items, [])).toEqual(new Map([["a", 3], ["b", 1]]));
  });
  it("descuenta lo pedido, aprobado o ya reintegrado", () => {
    const r = unidadesDisponibles(items, [dev("solicitada", "a", 1), dev("reintegrada", "a", 1), dev("aprobada", "b", 1)]);
    expect(r.get("a")).toBe(1);
    expect(r.get("b")).toBe(0);
  });
  it("lo rechazado o cancelado vuelve a estar disponible", () => {
    const r = unidadesDisponibles(items, [dev("rechazada", "a", 2), dev("cancelada", "b", 1)]);
    expect(r.get("a")).toBe(3);
    expect(r.get("b")).toBe(1);
  });
  it("nunca da negativo", () => {
    expect(unidadesDisponibles(items, [dev("solicitada", "a", 9)]).get("a")).toBe(0);
  });
});
