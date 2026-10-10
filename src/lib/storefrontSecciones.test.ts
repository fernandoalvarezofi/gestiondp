import { describe, expect, it } from "vitest";
import { destinoHref, normalizeBotones, normalizeDestino, normalizeEstilo } from "./storefrontSecciones";
import { normalizeBloque, normalizeTheme } from "./storefront";
import { PATRONES } from "./storefrontPatrones";

describe("estilo de sección (mismo contrato que _ts_estilo)", () => {
  it("acepta valores válidos y descarta el resto", () => {
    expect(normalizeEstilo({ fondo: "acento", arriba: 9, abajo: -1, ancho: "completo", alinear: "centro", ver: "movil", ancla: "Promo-Verano", nombre: " Intro " }))
      .toEqual({ fondo: "acento", arriba: 6, abajo: 0, ancho: "completo", alinear: "centro", ver: "movil", ancla: "promo-verano", nombre: "Intro" });
    expect(normalizeEstilo({ fondo: "rojo", ancho: "gigante", ver: "todos" })).toBeUndefined();
  });
  it("color propio solo con hex y foto de fondo solo https sin caracteres peligrosos", () => {
    expect(normalizeEstilo({ fondo: "color", color: "red" })).toBeUndefined();
    expect(normalizeEstilo({ fondo: "color", color: "#aabbcc" })).toEqual({ fondo: "color", color: "#AABBCC" });
    expect(normalizeEstilo({ fondo: "imagen", imagen: "javascript:alert(1)" })).toBeUndefined();
    expect(normalizeEstilo({ fondo: "imagen", imagen: 'https://x.com/a.jpg" onerror="1' })).toBeUndefined();
    expect(normalizeEstilo({ fondo: "imagen", imagen: "https://x.com/a.jpg", capa: 200 })).toEqual({ fondo: "imagen", imagen: "https://x.com/a.jpg", capa: 80 });
  });
});

describe("destinos y botones", () => {
  it("valida cada tipo de destino", () => {
    expect(normalizeDestino({ tipo: "pagina", valor: "Nosotros!" })).toBeUndefined();
    expect(normalizeDestino({ tipo: "pagina", valor: "nosotros" })).toEqual({ tipo: "pagina", valor: "nosotros" });
    expect(normalizeDestino({ tipo: "url", valor: "http://inseguro.com" })).toBeUndefined();
    expect(normalizeDestino({ tipo: "whatsapp", valor: "x" })).toEqual({ tipo: "whatsapp" });
    expect(normalizeDestino({ tipo: "hackeo" })).toBeUndefined();
  });
  it("arma direcciones internas de la tienda", () => {
    expect(destinoHref("pan", { tipo: "coleccion", valor: "verano" })).toBe("/t/pan/coleccion/verano");
    expect(destinoHref("pan", { tipo: "categoria", valor: "Panes y facturas" })).toBe("/t/pan/c/Panes%20y%20facturas");
    expect(destinoHref("pan", { tipo: "ancla", valor: "promo" })).toBe("#promo");
    expect(destinoHref("pan", { tipo: "whatsapp" })).toBeNull();
  });
  it("hasta dos botones, sin texto o sin destino válido se descartan", () => {
    const b = normalizeBotones([{ texto: "Ir", destino: { tipo: "catalogo" } }, { texto: "", destino: { tipo: "catalogo" } }, { texto: "Ver", destino: { tipo: "url", valor: "ftp://x" } }, { texto: "Tercero", destino: { tipo: "ofertas" } }]);
    expect(b).toEqual([{ texto: "Ir", destino: { tipo: "catalogo" }, estilo: "primario" }]);
  });
});

describe("bloques y tema v2", () => {
  it("cualquier bloque conserva su estilo de sección", () => {
    const b = normalizeBloque({ tipo: "faq", id: "f1", items: [{ p: "¿Envían?", r: "Sí" }], est: { fondo: "suave", ancho: "estrecho" } }, 0);
    expect(b?.est).toEqual({ fondo: "suave", ancho: "estrecho" });
  });
  it("contenido: sin imagen válida no hay posición de imagen", () => {
    const b = normalizeBloque({ tipo: "contenido", titulo: "Hola", imagen_url: "http://x.com/a.jpg", imagen_pos: "izquierda", nivel: "h9" }, 0);
    expect(b).toMatchObject({ tipo: "contenido", titulo: "Hola", nivel: "h2", imagen_pos: "ninguna", botones: [] });
  });
  it("productos y galería tienen opciones de celular con valores por defecto", () => {
    expect(normalizeBloque({ tipo: "productos" }, 0)).toMatchObject({ movil: 2, estilo: "grilla" });
    expect(normalizeBloque({ tipo: "galeria", movil: 1, forma: "mosaico" }, 0)).toMatchObject({ movil: 1, forma: "mosaico" });
  });
  it("encabezado y pie: valores por defecto y columnas validadas", () => {
    const t = normalizeTheme({ pie_columnas: [{ titulo: "Ayuda", enlaces: [{ texto: "Envíos", tipo: "pagina", destino: "envios" }, { texto: "Malo", tipo: "url", destino: "javascript:x" }] }, {}, {}, { titulo: "Cuarta" }] });
    expect(t.cabecera).toEqual({ fija: true, transparente: false });
    expect(t.pie_auto).toBe(true);
    expect(t.pie_columnas).toEqual([{ titulo: "Ayuda", enlaces: [{ texto: "Envíos", tipo: "pagina", destino: "envios" }] }]);
  });
  it("los tokens nuevos tienen el valor del tema y se pueden cambiar", () => {
    expect(normalizeTheme({ plantilla: "urbano" }).diseno).toMatchObject({ mayusculas: true, tarjeta: "plana", escala: "grande" });
    expect(normalizeTheme({ plantilla: "urbano", diseno: { mayusculas: false, tarjeta: "sombra" } }).diseno).toMatchObject({ mayusculas: false, tarjeta: "sombra" });
  });
  it("cada patrón produce una sección válida que sobrevive a la normalización", () => {
    for (const p of PATRONES) {
      const b = p.crear("boutique");
      const n = normalizeBloque(JSON.parse(JSON.stringify(b)), 0);
      expect(n, p.id).not.toBeNull();
      expect(n?.tipo).toBe(b.tipo);
      expect(n?.est ?? null).toEqual(b.est ?? null);
    }
  });
});
