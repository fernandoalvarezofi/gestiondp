import { describe, expect, it } from "vitest";
import { bloqueNuevo, fechaIso, finDeSemana, normalizeBloque, videoEmbed, videoUrl } from "./storefront";
import { tiempoRestante } from "@/components/storefront/MarketingBlocks";

describe("bloques de marketing", () => {
  it("el video solo acepta YouTube y Vimeo por https", () => {
    expect(videoUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeTruthy();
    expect(videoUrl("https://youtu.be/dQw4w9WgXcQ")).toBeTruthy();
    expect(videoUrl("https://vimeo.com/123456789")).toBeTruthy();
    expect(videoUrl("http://www.youtube.com/watch?v=dQw4w9WgXcQ")).toBeUndefined();
    expect(videoUrl("https://evil.com/watch?v=dQw4w9WgXcQ")).toBeUndefined();
    expect(videoUrl("javascript:alert(1)")).toBeUndefined();
  });
  it("arma la dirección para incrustar sin cookies", () => {
    expect(videoEmbed("https://youtu.be/dQw4w9WgXcQ")).toBe("https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ");
    expect(videoEmbed("https://vimeo.com/123456789")).toBe("https://player.vimeo.com/video/123456789");
    expect(videoEmbed("https://evil.com/x")).toBeNull();
  });
  it("valida la fecha de la oferta", () => {
    expect(fechaIso("2026-12-01T20:00")).toBe("2026-12-01T20:00");
    expect(fechaIso("2026-12-01T20:00:00-03:00")).toBeTruthy();
    expect(fechaIso("mañana")).toBeUndefined();
    expect(fechaIso(123)).toBeUndefined();
  });
  it("sugiere un domingo a las 23:59 como fin de la oferta", () => {
    const fin = new Date(finDeSemana(new Date(2026, 9, 7, 10, 0)));
    expect(fin.getDay()).toBe(0);
    expect(fin.getHours()).toBe(23);
  });
  it("normaliza política, oferta y newsletter descartando lo inválido", () => {
    const politicas = normalizeBloque({ tipo: "politicas", items: [{ t: "Envíos", x: "24 hs" }, { t: "", x: "sin título" }, { t: "Sin texto", x: "" }] }, 0);
    expect(politicas && politicas.tipo === "politicas" && politicas.items).toEqual([{ t: "Envíos", x: "24 hs" }]);
    const oferta = normalizeBloque({ tipo: "oferta", titulo: "Hot", hasta: "nunca" }, 1);
    expect(oferta && oferta.tipo === "oferta" && oferta.hasta).toBeUndefined();
    expect(normalizeBloque({ tipo: "newsletter", titulo: "Hola" }, 2)?.tipo).toBe("newsletter");
    expect(bloqueNuevo("oferta").tipo).toBe("oferta");
  });
});

describe("cuenta regresiva", () => {
  it("parte el tiempo en días, horas, minutos y segundos", () => {
    const t = tiempoRestante(2 * 86400000 + 3 * 3600000 + 4 * 60000 + 5000, 0);
    expect(t).toMatchObject({ dias: 2, horas: 3, min: 4, seg: 5, terminada: false });
  });
  it("nunca da negativo y marca cuando terminó", () => {
    expect(tiempoRestante(1000, 5000)).toMatchObject({ dias: 0, horas: 0, min: 0, seg: 0, terminada: true });
  });
});

import { progresoEnvio } from "@/components/storefront/MiniCart";

describe("progreso hacia el envío gratis", () => {
  it("calcula lo que falta y el porcentaje", () => {
    expect(progresoEnvio(3000, 10000)).toEqual({ falta: 7000, pct: 30 });
  });
  it("llega al 100% y no pasa", () => {
    expect(progresoEnvio(12000, 10000)).toEqual({ falta: 0, pct: 100 });
  });
  it("sin promo de envío gratis no hay barra", () => {
    expect(progresoEnvio(3000, null)).toBeNull();
    expect(progresoEnvio(3000, 0)).toBeNull();
    expect(progresoEnvio(3000, undefined)).toBeNull();
  });
});
