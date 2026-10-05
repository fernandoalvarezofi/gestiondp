import type { CSSProperties } from "react";
import { FUENTES, RADIOS, readableOn, type TemaNormalizado } from "@/lib/storefront";

const ESPACIO: Record<string, string> = { compacto: "pt-8 sm:pt-10", normal: "pt-12 sm:pt-16", amplio: "pt-16 sm:pt-24" };

/** Estilos derivados del diseño de la tienda (colores, letras, esquinas, ancho). Los usan la portada de la tienda y la ficha de producto. */
export function estiloTienda(theme: TemaNormalizado) {
  const d = theme.diseno;
  const darkPage = d.fondo ? readableOn(d.fondo) === "#FFFFFF" : false;
  const titleFont = FUENTES[d.fuente_titulos].css;
  const bodyFont = d.fuente_texto === "serif" ? FUENTES.serif.css : undefined;
  const pageStyle = {
    "--sf-accent": theme.color,
    "--sf-on-accent": readableOn(theme.color),
    "--sf-radius": RADIOS[d.radio].css,
    "--sf-aspect": d.aspecto,
    fontFamily: bodyFont,
    ...(d.fondo ? { backgroundColor: d.fondo, color: d.texto ?? readableOn(d.fondo) } : d.texto ? { color: d.texto } : {}),
  } as unknown as CSSProperties;
  return {
    d,
    darkPage,
    pageStyle,
    accent: { background: "var(--sf-accent)", color: "var(--sf-on-accent)" } as CSSProperties,
    headingStyle: (titleFont ? { fontFamily: titleFont } : {}) as CSSProperties,
    radiusButton: { borderRadius: d.radio === "pildora" ? 9999 : d.radio === "cuadrado" ? 0 : "var(--sf-radius)" } as CSSProperties,
    width: d.ancho === "amplio" ? "max-w-7xl" : "max-w-6xl",
    centered: d.cabecera === "centro",
    space: ESPACIO[d.espaciado],
  };
}
