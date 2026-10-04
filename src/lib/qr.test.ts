import { describe, expect, it } from "vitest";
import { qrSvg } from "./qr";

describe("qrSvg", () => {
  it("genera un SVG cuadrado con el trazado de los módulos", () => {
    const svg = qrSvg("https://woref.vercel.app/t/mi-tienda");
    expect(svg.startsWith("<svg")).toBe(true);
    const box = svg.match(/viewBox="0 0 (\d+) (\d+)"/);
    expect(box?.[1]).toBe(box?.[2]);
    expect(svg).toContain("<path");
  });
  it("respeta el margen blanco (zona de silencio)", () => {
    const chico = qrSvg("hola", { margin: 1 }).match(/viewBox="0 0 (\d+)/);
    const grande = qrSvg("hola", { margin: 4 }).match(/viewBox="0 0 (\d+)/);
    expect(Number(grande?.[1]) - Number(chico?.[1])).toBe(6);
  });
  it("el mismo texto da siempre el mismo código", () => {
    expect(qrSvg("https://woref.vercel.app/t/x")).toBe(qrSvg("https://woref.vercel.app/t/x"));
  });
  it("un texto más largo da un código más grande", () => {
    const corto = qrSvg("a").match(/viewBox="0 0 (\d+)/);
    const largo = qrSvg("https://woref.vercel.app/t/una-tienda-con-un-nombre-bastante-largo-para-probar").match(/viewBox="0 0 (\d+)/);
    expect(Number(largo?.[1])).toBeGreaterThan(Number(corto?.[1]));
  });
});
