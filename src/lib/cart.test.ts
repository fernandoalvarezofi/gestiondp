import { describe, expect, it } from "vitest";
import type { CartItem, CartStore } from "@/contexts/CartContext";
import { agregarLinea, cambiarCantidad, cantidadDe, CartGroup, leerGuardado, MAX_COMERCIOS, quitarGrupo, quitarUnidad, reemplazarGrupo, subtotalDe, totalGeneral, totalUnidades } from "./cart";

const store = (id: string): CartStore => ({ id, nombre: `Tienda ${id}`, slug: id, costo_envio: 0 });
const line = (id: string, precio: number, cantidad = 1, lineId = id): CartItem => ({ id, comercio_id: "x", nombre: id, precio, precioBase: precio, cantidad, opciones: [], lineId });

describe("carrito con varios comercios", () => {
  it("agrupa por comercio y suma la misma línea", () => {
    let g: CartGroup[] = [];
    g = agregarLinea(g, store("a"), line("p1", 100))!;
    g = agregarLinea(g, store("b"), line("p2", 50, 2))!;
    g = agregarLinea(g, store("a"), line("p1", 100, 2))!;
    expect(g).toHaveLength(2);
    expect(g[0].items[0].cantidad).toBe(3);
    expect(subtotalDe(g[0].items)).toBe(300);
    expect(totalGeneral(g)).toBe(400);
    expect(totalUnidades(g)).toBe(5);
  });
  it("no pasa de 5 comercios ni de 50 por línea", () => {
    let g: CartGroup[] = [];
    for (let i = 0; i < MAX_COMERCIOS; i++) g = agregarLinea(g, store(`s${i}`), line(`p${i}`, 1))!;
    expect(agregarLinea(g, store("extra"), line("z", 1))).toBeNull();
    expect(agregarLinea(g, store("s0"), line("p0", 1, 80))![0].items[0].cantidad).toBe(50);
  });
  it("cambiar cantidad a 0 quita la línea y el comercio vacío", () => {
    let g = agregarLinea([], store("a"), line("p1", 10))!;
    g = agregarLinea(g, store("b"), line("p2", 10))!;
    g = cambiarCantidad(g, "p1", 0);
    expect(g.map((x) => x.store.id)).toEqual(["b"]);
  });
  it("quitarUnidad resta de la última línea del producto", () => {
    let g = agregarLinea([], store("a"), line("p1", 10, 2, "p1|a"))!;
    g = agregarLinea(g, store("a"), line("p1", 10, 1, "p1|b"))!;
    g = quitarUnidad(g, "p1");
    expect(cantidadDe(g, "p1")).toBe(2);
    expect(g[0].items.find((i) => i.lineId === "p1|b")).toBeUndefined();
  });
  it("reemplazar el grupo de un comercio no toca los demás", () => {
    let g = agregarLinea([], store("a"), line("p1", 10))!;
    g = agregarLinea(g, store("b"), line("p2", 10))!;
    const r = reemplazarGrupo(g, store("a"), [line("p9", 5, 3)])!;
    expect(r.find((x) => x.store.id === "a")!.items.map((i) => i.id)).toEqual(["p9"]);
    expect(r.find((x) => x.store.id === "b")!.items.map((i) => i.id)).toEqual(["p2"]);
    expect(reemplazarGrupo(r, store("a"), [])!.map((x) => x.store.id)).toEqual(["b"]);
  });
  it("quitarGrupo", () => {
    const g = agregarLinea(agregarLinea([], store("a"), line("p1", 1))!, store("b"), line("p2", 1))!;
    expect(quitarGrupo(g, "a").map((x) => x.store.id)).toEqual(["b"]);
  });
});

describe("lo guardado en el navegador", () => {
  it("lee el formato anterior (un solo comercio)", () => {
    const r = leerGuardado({ store: store("a"), items: [{ id: "p1", cantidad: 2, precio: 100 }] });
    expect(r.groups).toHaveLength(1);
    expect(r.groups[0].items[0].lineId).toBe("p1");
    expect(r.active).toBe("a");
  });
  it("lee el formato nuevo y corrige el comercio activo", () => {
    const g = [{ store: store("a"), items: [line("p1", 1)] }, { store: store("b"), items: [line("p2", 1)] }];
    expect(leerGuardado({ groups: g, active: "a" }).active).toBe("a");
    expect(leerGuardado({ groups: g, active: "no-existe" }).active).toBe("b");
  });
  it("ignora basura", () => {
    expect(leerGuardado(null).groups).toEqual([]);
    expect(leerGuardado("x").groups).toEqual([]);
    expect(leerGuardado({ groups: [{ store: null, items: [] }, { store: store("a"), items: [] }] }).groups).toEqual([]);
  });
});
