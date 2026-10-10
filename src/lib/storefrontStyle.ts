import type { CSSProperties } from "react";
import { FUENTES, RADIOS, readableOn, TEXTO_SERIF, type TemaNormalizado } from "@/lib/storefront";
import "@/lib/storefrontFonts";

const ESPACIO: Record<string, string> = { compacto: "pt-8 sm:pt-10", normal: "pt-12 sm:pt-16", amplio: "pt-16 sm:pt-24" };
const ESPACIO_ABAJO: Record<string, string> = { compacto: "pb-8 sm:pb-10", normal: "pb-12 sm:pb-16", amplio: "pb-16 sm:pb-24" };
const TITULO: Record<string, string> = { chica: "text-xl sm:text-2xl", media: "text-2xl sm:text-3xl", grande: "text-3xl sm:text-5xl" };
const PESO: Record<string, number> = { normal: 500, negrita: 700, black: 900 };

/** "#RRGGBB" → "H S% L%" (el formato de las variables de color de la app), para que las superficies del tema usen el sistema común. */
export function hexAHsl(hex: string): string | null {
  if (!/^#[0-9A-F]{6}$/i.test(hex)) return null;
  const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
  const max = Math.max(r, g, b), min = Math.min(r, g, b), l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
    h /= 6;
  }
  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Estilos derivados del diseño de la tienda (los tokens del tema). Los usan todas las páginas de la tienda y la ficha de producto.
 * Los colores de fondo, superficie y texto se vuelcan en las variables de color de la app (`--background`, `--card`…), así cada
 * componente que usa `bg-card` o `text-muted-foreground` respeta el tema sin código propio.
 */
export function estiloTienda(theme: TemaNormalizado) {
  const d = theme.diseno;
  const darkPage = d.fondo ? readableOn(d.fondo) === "#FFFFFF" : false;
  const titleFont = FUENTES[d.fuente_titulos].css;
  const bodyFont = d.fuente_texto === "serif" ? TEXTO_SERIF : undefined;
  const fondo = d.fondo ? hexAHsl(d.fondo) : null;
  const superficie = d.superficie ? hexAHsl(d.superficie) : null;
  const texto = d.texto ? hexAHsl(d.texto) : null;
  const pageStyle = {
    "--sf-accent": theme.color,
    "--sf-on-accent": readableOn(theme.color),
    "--sf-radius": RADIOS[d.radio].css,
    "--sf-radius-button": d.radio === "pildora" ? "9999px" : d.radio === "cuadrado" ? "0px" : RADIOS[d.radio].css,
    "--sf-aspect": d.aspecto,
    ...(fondo ? { "--background": fondo } : {}),
    ...(superficie ? { "--card": superficie, "--popover": superficie } : {}),
    ...(texto ? { "--foreground": texto, "--card-foreground": texto } : {}),
    fontFamily: bodyFont,
    ...(d.fondo ? { backgroundColor: d.fondo, color: d.texto ?? readableOn(d.fondo) } : d.texto ? { color: d.texto } : {}),
  } as unknown as CSSProperties;
  return {
    d,
    darkPage,
    pageStyle,
    /** Atributos para el contenedor de la tienda: el estilo de tarjeta se aplica por CSS a todas las cajas (`.border.bg-card`). */
    pageAttrs: { "data-sf-tarjeta": d.tarjeta } as Record<string, string>,
    accent: { background: "var(--sf-accent)", color: "var(--sf-on-accent)" } as CSSProperties,
    headingStyle: {
      ...(titleFont ? { fontFamily: titleFont } : {}),
      fontWeight: PESO[d.peso] ?? 900,
      ...(d.mayusculas ? { textTransform: "uppercase", letterSpacing: "0.04em" } : {}),
    } as CSSProperties,
    tituloClase: TITULO[d.escala] ?? TITULO.media,
    radiusButton: { borderRadius: d.radio === "pildora" ? 9999 : d.radio === "cuadrado" ? 0 : "var(--sf-radius)" } as CSSProperties,
    width: d.ancho === "amplio" ? "max-w-7xl" : "max-w-6xl",
    centered: d.cabecera === "centro",
    space: ESPACIO[d.espaciado],
    spaceBottom: ESPACIO_ABAJO[d.espaciado],
  };
}
