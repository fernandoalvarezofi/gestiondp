import { describe, expect, it } from "vitest";
import { ACTIVIDADES, BLOQUES_SOLO_TIENDA, bloquePermitido, datosParaCrear, esSitio, sitioInicial } from "./sitioWeb";
import { normalizeBloque, normalizeTheme } from "./storefront";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const ID = /^[a-z0-9-]{1,16}$/;

describe("punto de partida de un sitio web", () => {
  for (const actividad of ACTIVIDADES) {
    it(`${actividad.nombre}: secciones válidas, sin catálogo y con formulario de consultas`, () => {
      const { tema, paginas } = sitioInicial(actividad.id, { nombre: "Estudio López", descripcion: "Asesoramiento contable", whatsapp: "5492355123456" });
      const bloques = tema.bloques ?? [];
      expect(bloques.length).toBeGreaterThan(3);
      // Cada sección pasa por el mismo validador que usa el editor (y que replica el servidor) sin perderse.
      bloques.forEach((b, i) => { expect(normalizeBloque(b, i)).not.toBeNull(); expect(b.id).toMatch(ID); });
      expect(bloques.some((b) => BLOQUES_SOLO_TIENDA.includes(b.tipo))).toBe(false);
      expect(bloques.some((b) => b.tipo === "formulario")).toBe(true);
      expect(bloques[0].tipo).toBe("portada");
      // No se inventan opiniones ni testimonios.
      expect(bloques.some((b) => b.tipo === "testimonios" || b.tipo === "opiniones")).toBe(false);

      expect(paginas.map((p) => p.slug)).toEqual(["servicios", "nosotros", "contacto"]);
      for (const p of paginas) {
        expect(p.slug).toMatch(SLUG);
        expect(p.titulo.length).toBeGreaterThanOrEqual(2);
        p.bloques.forEach((b, i) => { expect(normalizeBloque(b, i)).not.toBeNull(); expect(BLOQUES_SOLO_TIENDA).not.toContain(b.tipo); });
      }
      // El menú solo apunta a páginas que se crean.
      for (const m of tema.menu ?? []) if (m.tipo === "pagina") expect(paginas.map((p) => p.slug)).toContain(m.destino);

      const normal = normalizeTheme(tema);
      expect(normal.plantilla).toBe(actividad.plantilla);
      // La app conserva un catálogo al final (oculto en un sitio) para que activar la tienda después no pierda nada.
      expect(normal.bloques.filter((b) => bloquePermitido(b.tipo, true)).length).toBe(bloques.length);
      expect(normal.whatsapp).toBe("5492355123456");
      expect(normal.mostrar_busqueda).toBe(false);
    });
  }

  it("respeta los límites de largo que valida el servidor", () => {
    const largo = "N".repeat(80);
    const { tema } = sitioInicial("profesional", { nombre: largo, descripcion: "x".repeat(300) });
    expect((tema.titulo ?? "").length).toBeLessThanOrEqual(80);
    expect((tema.subtitulo ?? "").length).toBeLessThanOrEqual(160);
    expect((tema.seo_titulo ?? "").length).toBeLessThanOrEqual(70);
    expect((tema.seo_descripcion ?? "").length).toBeLessThanOrEqual(170);
  });

  it("descarta un WhatsApp inválido en vez de mandarlo al servidor", () => {
    expect(sitioInicial("salud", { nombre: "Consultorio", whatsapp: "123" }).tema.whatsapp).toBeUndefined();
  });

  it("arma los datos de alta con la categoría y el rubro de la actividad", () => {
    expect(datosParaCrear("gastronomia", { nombre: "  La Casona ", slug: "la-casona" })).toEqual({ nombre: "La Casona", slug: "la-casona", categoria: "comida", rubro: "Gastronomía", descripcion: null, telefono: null, direccion: "" });
  });
});

describe("tipo de negocio", () => {
  it("solo un comercio marcado como sitio es sitio", () => {
    expect(esSitio({ tipo_sitio: "sitio" })).toBe(true);
    expect(esSitio({ tipo_sitio: "tienda" })).toBe(false);
    expect(esSitio({})).toBe(false);
    expect(esSitio(null)).toBe(false);
  });
  it("las secciones de productos se ocultan en un sitio y siguen en una tienda", () => {
    for (const t of BLOQUES_SOLO_TIENDA) { expect(bloquePermitido(t, true)).toBe(false); expect(bloquePermitido(t, false)).toBe(true); }
    expect(bloquePermitido("formulario", true)).toBe(true);
    expect(bloquePermitido("servicios", true)).toBe(true);
  });
});
