import { describe, expect, it } from "vitest";
import { MAX_BLOQUES, normalizeBloque, normalizeDiseno, normalizeTheme, paginaDePlantilla, PLANTILLAS, TIPOS_BLOQUE } from "./storefront";

describe("plantillas completas", () => {
  for (const plantilla of PLANTILLAS) {
    describe(plantilla.nombre, () => {
      const bloques = paginaDePlantilla(plantilla.id, { titulo: "Mi tienda", subtitulo: "Lo mejor", acerca: "Somos una tienda de barrio." });

      it("arma una página con portada y un único catálogo", () => {
        expect(bloques[0]?.tipo === "portada" || bloques.some((b) => b.tipo === "portada")).toBe(true);
        expect(bloques.filter((b) => b.tipo === "catalogo")).toHaveLength(1);
        expect(bloques.length).toBeGreaterThanOrEqual(7);
        expect(bloques.length).toBeLessThanOrEqual(MAX_BLOQUES);
      });

      it("no repite identificadores y solo usa tipos conocidos", () => {
        const ids = bloques.map((b) => b.id);
        expect(new Set(ids).size).toBe(ids.length);
        const tipos = TIPOS_BLOQUE.map((t) => t.tipo);
        for (const b of bloques) expect(tipos).toContain(b.tipo);
      });

      it("cada bloque sobrevive a la validación sin perder su tipo", () => {
        bloques.forEach((b, i) => expect(normalizeBloque(b, i)?.tipo).toBe(b.tipo));
      });

      it("la portada usa el estilo de la plantilla", () => {
        const portada = bloques.find((b) => b.tipo === "portada");
        expect(portada && portada.tipo === "portada" && portada.estilo).toBe(plantilla.id);
      });

      it("el tema completo se normaliza con su diseño", () => {
        const tema = normalizeTheme({ plantilla: plantilla.id, color: plantilla.color, bloques });
        expect(tema.plantilla).toBe(plantilla.id);
        expect(tema.bloques.length).toBe(bloques.length);
        expect(tema.diseno).toEqual(normalizeDiseno({}, plantilla.id));
      });
    });
  }

  it("Atelier y Urbano traen fondo y texto propios; el resto usa los de la app", () => {
    expect(normalizeDiseno({}, "atelier").fondo).toBe("#FAF7F2");
    expect(normalizeDiseno({}, "urbano").fondo).toBe("#0A0A0B");
    expect(normalizeDiseno({}, "boutique").fondo).toBeUndefined();
  });

  it("lo que elige el comercio tiene prioridad sobre la plantilla", () => {
    expect(normalizeDiseno({ fondo: "#112233" }, "urbano").fondo).toBe("#112233");
  });

  it("el texto del comercio aparece en la portada y en 'sobre nosotros'", () => {
    const bloques = paginaDePlantilla("boutique", { titulo: "Casa Luz", acerca: "Nacimos en 2010." });
    const portada = bloques.find((b) => b.tipo === "portada");
    expect(portada && portada.tipo === "portada" && portada.titulo).toBe("Casa Luz");
    expect(JSON.stringify(bloques)).toContain("Nacimos en 2010.");
  });

  it("la cinta descarta frases vacías y limita a 6", () => {
    const cinta = normalizeBloque({ tipo: "cinta", items: ["a", "", "b", "c", "d", "e", "f", "g"], estilo: "raro" }, 0);
    expect(cinta && cinta.tipo === "cinta" && cinta.items).toEqual(["a", "b", "c", "d", "e", "f"]);
    expect(cinta && cinta.tipo === "cinta" && cinta.estilo).toBe("acento");
  });
});
