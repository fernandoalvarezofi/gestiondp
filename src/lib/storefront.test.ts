import { describe, expect, it } from "vitest";
import { MAX_BLOQUES, menuHref, normalizeBloque, normalizeMenu, normalizeTheme, readableOn, SECCIONES_BASE, TEMA_BASE } from "./storefront";

describe("normalizeTheme", () => {
  it("usa los valores base cuando no hay tema", () => {
    expect(normalizeTheme(null)).toMatchObject(TEMA_BASE);
    expect(normalizeTheme({})).toMatchObject(TEMA_BASE);
  });
  it("descarta colores que no son hexadecimales (evita inyectar estilos)", () => {
    expect(normalizeTheme({ color: "red; background:url(x)" }).color).toBe(TEMA_BASE.color);
    expect(normalizeTheme({ color: "#abc123" }).color).toBe("#ABC123");
  });
  it("solo acepta imágenes y webs https", () => {
    expect(normalizeTheme({ banner_url: "javascript:alert(1)" }).banner_url).toBeUndefined();
    expect(normalizeTheme({ banner_url: "http://x.com/a.jpg" }).banner_url).toBeUndefined();
    expect(normalizeTheme({ banner_url: "https://x.com/a.jpg" }).banner_url).toBe("https://x.com/a.jpg");
    expect(normalizeTheme({ web: "https://tienda.com" }).web).toBe("https://tienda.com");
  });
  it("valida usuario de redes y WhatsApp", () => {
    expect(normalizeTheme({ instagram: "mi.tienda_ok" }).instagram).toBe("mi.tienda_ok");
    expect(normalizeTheme({ instagram: "<script>" }).instagram).toBeUndefined();
    expect(normalizeTheme({ whatsapp: "5492355123456" }).whatsapp).toBe("5492355123456");
    expect(normalizeTheme({ whatsapp: "abc" }).whatsapp).toBeUndefined();
  });
  it("ignora plantillas desconocidas y recorta textos largos", () => {
    expect(normalizeTheme({ plantilla: "hackeada" }).plantilla).toBe(TEMA_BASE.plantilla);
    expect(normalizeTheme({ plantilla: "gourmet" }).plantilla).toBe("gourmet");
    expect(normalizeTheme({ titulo: "x".repeat(200) }).titulo).toHaveLength(80);
    expect(normalizeTheme({ boton: "y".repeat(60) }).boton).toHaveLength(24);
  });
});

describe("secciones", () => {
  it("por defecto muestra todas", () => {
    expect(normalizeTheme({}).secciones).toEqual(SECCIONES_BASE);
  });
  it("respeta el orden elegido, quita repetidas y desconocidas", () => {
    expect(normalizeTheme({ secciones: ["acerca", "catalogo", "acerca", "xss", 4] }).secciones).toEqual(["acerca", "catalogo"]);
  });
  it("el catálogo nunca falta", () => {
    expect(normalizeTheme({ secciones: ["acerca"] }).secciones).toEqual(["acerca", "catalogo"]);
    expect(normalizeTheme({ secciones: [] }).secciones).toEqual(["catalogo"]);
  });
});

describe("readableOn", () => {
  it("elige texto claro sobre fondos oscuros y oscuro sobre claros", () => {
    expect(readableOn("#111827")).toBe("#FFFFFF");
    expect(readableOn("#FDE68A")).toBe("#111111");
  });
});

describe("bloques y diseño", () => {
  it("sin bloques guardados se arma desde la plantilla, con portada primero y catálogo", () => {
    const tema = normalizeTheme({ plantilla: "gourmet", titulo: "Mi café" });
    expect(tema.bloques[0]).toMatchObject({ tipo: "portada", estilo: "gourmet", titulo: "Mi café" });
    expect(tema.bloques.some((bloque) => bloque.tipo === "catalogo")).toBe(true);
  });
  it("respeta los bloques guardados y su orden", () => {
    const tema = normalizeTheme({ bloques: [{ id: "a", tipo: "texto", titulo: "Hola" }, { id: "b", tipo: "catalogo" }, { id: "c", tipo: "banner", titulo: "Oferta" }] });
    expect(tema.bloques.map((bloque) => bloque.tipo)).toEqual(["texto", "catalogo", "banner"]);
  });
  it("descarta tipos desconocidos y siempre deja el catálogo", () => {
    const tema = normalizeTheme({ bloques: [{ tipo: "script", titulo: "x" }, { tipo: "texto" }] });
    expect(tema.bloques.map((bloque) => bloque.tipo)).toEqual(["texto", "catalogo"]);
  });
  it("limpia enlaces e imágenes peligrosas dentro de los bloques", () => {
    const tema = normalizeTheme({ bloques: [{ tipo: "banner", imagen_url: "javascript:alert(1)", enlace_tipo: "url", enlace_url: "http://x.com" }, { tipo: "galeria", imagenes: [{ url: "https://a.com/1.jpg" }, { url: "data:image/svg+xml;x" }, { url: "ftp://x" }] }] });
    const banner = tema.bloques[0] as { imagen_url?: string; enlace_url?: string };
    expect(banner.imagen_url).toBeUndefined();
    expect(banner.enlace_url).toBeUndefined();
    const galeria = tema.bloques[1] as { imagenes: { url: string }[] };
    expect(galeria.imagenes).toEqual([{ url: "https://a.com/1.jpg", texto: undefined }]);
  });
  it("acota números, listas y cantidad de bloques", () => {
    const muchos = Array.from({ length: 40 }, () => ({ tipo: "separador" }));
    expect(normalizeTheme({ bloques: muchos }).bloques.length).toBeLessThanOrEqual(MAX_BLOQUES + 1);
    const productos = normalizeTheme({ bloques: [{ tipo: "productos", cantidad: 999, columnas: -3 }] }).bloques[0] as { cantidad: number; columnas: number };
    expect(productos.cantidad).toBe(12);
    expect(productos.columnas).toBe(2);
    const faq = normalizeTheme({ bloques: [{ tipo: "faq", items: Array.from({ length: 30 }, (_, n) => ({ p: `p${n}`, r: `r${n}` })) }] }).bloques[0] as { items: unknown[] };
    expect(faq.items).toHaveLength(8);
  });
  it("el diseño valida colores y opciones", () => {
    const diseno = normalizeTheme({ diseno: { fondo: "red", texto: "#111111", radio: "xx", fuente_titulos: "display" } }).diseno;
    expect(diseno.fondo).toBeUndefined();
    expect(diseno.texto).toBe("#111111");
    expect(diseno.radio).toBe("suave");
    expect(diseno.fuente_titulos).toBe("display");
  });
  it("cada plantilla trae su propio diseño de partida", () => {
    expect(normalizeTheme({ plantilla: "galeria" }).diseno.radio).toBe("cuadrado");
    expect(normalizeTheme({ plantilla: "impacto" }).diseno.radio).toBe("pildora");
    expect(normalizeTheme({ plantilla: "gourmet" }).diseno.fuente_titulos).toBe("serif");
  });
});

describe("estabilidad", () => {
  it("la misma tienda sin bloques guardados genera siempre los mismos identificadores", () => {
    const a = normalizeTheme({ plantilla: "boutique" }).bloques.map((bloque) => bloque.id);
    const b = normalizeTheme({ plantilla: "boutique" }).bloques.map((bloque) => bloque.id);
    expect(a).toEqual(b);
  });
});
