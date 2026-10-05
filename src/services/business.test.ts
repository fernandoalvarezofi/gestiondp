import { describe, expect, it } from "vitest";
import { agruparSucursales, type TiendaDeNegocio } from "./business";

const t = (id: string, parent: string | null = null): TiendaDeNegocio => ({ id, nombre: id, slug: id, parent_store_id: parent, aprobado: true, esta_abierto: true });

describe("sucursales por negocio", () => {
  it("agrupa las sucursales bajo su tienda principal", () => {
    const grupos = agruparSucursales([t("a"), t("b", "a"), t("c", "a"), t("d")]);
    expect(grupos.map((g) => g.principal.id)).toEqual(["a", "d"]);
    expect(grupos[0].sucursales.map((s) => s.id)).toEqual(["b", "c"]);
    expect(grupos[1].sucursales).toEqual([]);
  });
  it("si la principal no está en la lista, la sucursal se muestra sola", () => {
    expect(agruparSucursales([t("b", "zzz")]).map((g) => g.principal.id)).toEqual(["b"]);
  });
  it("lista vacía", () => {
    expect(agruparSucursales([])).toEqual([]);
  });
});
