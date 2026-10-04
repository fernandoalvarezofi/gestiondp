import { describe, expect, it } from "vitest";
import { normalizeTheme, readableOn, TEMA_BASE } from "./storefront";

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
    expect(normalizeTheme({ plantilla: "hackeada" }).plantilla).toBe("clasica");
    expect(normalizeTheme({ titulo: "x".repeat(200) }).titulo).toHaveLength(80);
  });
});

describe("readableOn", () => {
  it("elige texto claro sobre fondos oscuros y oscuro sobre claros", () => {
    expect(readableOn("#111827")).toBe("#FFFFFF");
    expect(readableOn("#FDE68A")).toBe("#111111");
  });
});
