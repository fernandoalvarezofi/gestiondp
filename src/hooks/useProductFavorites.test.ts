import { describe, expect, it } from "vitest";
import { MAX_FAVORITOS, normalizarIds } from "./useProductFavorites";

const id = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

describe("normalizarIds", () => {
  it("deja solo identificadores válidos, sin repetidos", () => {
    expect(normalizarIds([id(1), id(1), "no-es-uuid", 5, null, id(2), "<script>"])).toEqual([id(1), id(2)]);
  });
  it("se queda con los últimos 200", () => {
    const lista = normalizarIds(Array.from({ length: 250 }, (_, i) => id(i)));
    expect(lista).toHaveLength(MAX_FAVORITOS);
    expect(lista[lista.length - 1]).toBe(id(249));
  });
});
