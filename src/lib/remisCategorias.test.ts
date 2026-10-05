import { describe, expect, it } from "vitest";
import { capacidadDe, categoriaLabel, CATEGORIAS } from "./remis";

describe("categorías de remís", () => {
  it("capacidades: estándar y confort 4, familiar 6", () => {
    expect(capacidadDe("estandar")).toBe(4);
    expect(capacidadDe("confort")).toBe(4);
    expect(capacidadDe("familiar")).toBe(6);
  });
  it("etiquetas legibles y desconocidas sin romper", () => {
    expect(categoriaLabel("confort")).toBe("Confort");
    expect(categoriaLabel("otra")).toBe("otra");
  });
  it("están las tres, con la familiar al final", () => {
    expect(CATEGORIAS.map((c) => c.id)).toEqual(["estandar", "confort", "familiar"]);
  });
});
