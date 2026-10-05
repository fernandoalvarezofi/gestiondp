import { describe, expect, it } from "vitest";
import { orderSections } from "./delivery";
import { passwordStrength } from "./password";

describe("orderSections", () => {
  const products = [{ categoria: "Bebidas" }, { categoria: "Pizzas" }, { categoria: "Postres" }];

  it("respeta el orden elegido por el comercio y deja al final las secciones sin configurar", () => {
    const configured = [
      { id: "1", comercio_id: "c", nombre: "Postres", orden: 0, visible: true },
      { id: "2", comercio_id: "c", nombre: "Pizzas", orden: 10, visible: true },
    ];
    expect(orderSections(products, configured, false).map((section) => section.name)).toEqual(["Postres", "Pizzas", "Bebidas"]);
  });

  it("oculta a los clientes las secciones ocultas, pero las muestra al comercio", () => {
    const configured = [{ id: "1", comercio_id: "c", nombre: "Pizzas", orden: 0, visible: false }];
    expect(orderSections(products, configured, true).map((section) => section.name)).not.toContain("Pizzas");
    expect(orderSections(products, configured, false).map((section) => section.name)).toContain("Pizzas");
  });

  it("incluye secciones configuradas que todavía no tienen productos", () => {
    const configured = [{ id: "1", comercio_id: "c", nombre: "Ofertas", orden: 0, visible: true }];
    expect(orderSections([], configured, false)).toEqual([{ name: "Ofertas", visible: true }]);
  });
});

describe("passwordStrength (en uso por Mi cuenta)", () => {
  it("exige un mínimo razonable", () => {
    expect(passwordStrength("abc").score).toBe(0);
    expect(passwordStrength("Una-Clave-Larga-2026!").score).toBe(4);
  });
});

import { COMERCIO_COLS } from "./delivery";

describe("columnas públicas de comercios", () => {
  it("no incluye los datos internos de la plataforma", () => {
    const cols = COMERCIO_COLS.split(",");
    expect(cols).not.toContain("comision_pct");
    expect(cols).not.toContain("liquidacion_frecuencia");
    expect(cols).not.toContain("*");
  });
  it("incluye lo que necesitan las tarjetas y la tienda", () => {
    const cols = COMERCIO_COLS.split(",");
    for (const c of ["id", "nombre", "slug", "categoria", "tienda_tema", "latitud", "longitud", "esta_abierto", "envio_gratis_desde"]) expect(cols).toContain(c);
  });
  it("no repite columnas", () => {
    const cols = COMERCIO_COLS.split(",");
    expect(new Set(cols).size).toBe(cols.length);
  });
});
