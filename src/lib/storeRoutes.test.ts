import { describe, expect, it } from "vitest";
import type { DeliveryProduct } from "@/lib/delivery";
import { collectionPath, offersPath, parseVista, searchPath, sugerencias, tieneDescuento, vistaKey } from "./storeRoutes";

const prod = (nombre: string, extra: Partial<DeliveryProduct> = {}) => ({ id: nombre, comercio_id: "c", nombre, categoria: "x", precio: 100, disponible: true, ...extra }) as DeliveryProduct;

describe("rutas de la tienda", () => {
  it("arma y codifica las direcciones", () => {
    expect(collectionPath("mi-tienda", "Frutas y verduras")).toBe("/t/mi-tienda/c/Frutas%20y%20verduras");
    expect(offersPath("mi-tienda")).toBe("/t/mi-tienda/ofertas");
    expect(searchPath("mi-tienda", " pan ")).toBe("/t/mi-tienda/buscar?q=pan");
    expect(searchPath("mi-tienda", "  ")).toBe("/t/mi-tienda/buscar");
  });
  it("interpreta la página según la dirección", () => {
    expect(parseVista("/t/x", "")).toEqual({ tipo: "inicio" });
    expect(parseVista("/t/x/c/Frutas%20y%20verduras", "", "Frutas%20y%20verduras")).toEqual({ tipo: "coleccion", categoria: "Frutas y verduras" });
    expect(parseVista("/t/x/ofertas/", "")).toEqual({ tipo: "ofertas" });
    expect(parseVista("/t/x/buscar", "?q=leche")).toEqual({ tipo: "buscar", q: "leche" });
    expect(parseVista("/t/x/buscar", "")).toEqual({ tipo: "buscar", q: "" });
  });
  it("tolera una categoría mal codificada", () => {
    expect(parseVista("/t/x/c/100%", "", "100%")).toEqual({ tipo: "coleccion", categoria: "100%" });
  });
  it("la clave distingue páginas", () => {
    expect(vistaKey({ tipo: "coleccion", categoria: "A" })).not.toBe(vistaKey({ tipo: "coleccion", categoria: "B" }));
    expect(vistaKey({ tipo: "inicio" })).toBe("inicio");
  });
});

describe("descuento y sugerencias", () => {
  it("detecta el descuento", () => {
    expect(tieneDescuento({ precio: 100, precio_anterior: 150 })).toBe(true);
    expect(tieneDescuento({ precio: 100, precio_anterior: 100 })).toBe(false);
    expect(tieneDescuento({ precio: 100, precio_anterior: null })).toBe(false);
  });
  const catalogo = [prod("Pan de campo"), prod("Panceta"), prod("Leche entera"), prod("Sándwich de pan lactal"), prod("Agua", { disponible: false })];
  it("ordena primero lo que empieza con lo escrito, sin tildes", () => {
    const r = sugerencias(catalogo, ["Panadería", "Lácteos"], "pan");
    expect(r.productos.map((p) => p.nombre)).toEqual(["Pan de campo", "Panceta", "Sándwich de pan lactal"]);
    expect(r.categorias).toEqual(["Panadería"]);
    expect(sugerencias(catalogo, ["Lácteos"], "lacteos").categorias).toEqual(["Lácteos"]);
  });
  it("no sugiere con menos de 2 letras ni productos no disponibles", () => {
    expect(sugerencias(catalogo, [], "p")).toEqual({ productos: [], categorias: [] });
    expect(sugerencias(catalogo, [], "agua").productos).toEqual([]);
  });
  it("respeta el máximo", () => {
    expect(sugerencias(catalogo, [], "pan", 1).productos).toHaveLength(1);
  });
});
