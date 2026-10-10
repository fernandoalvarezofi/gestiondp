import { useLayoutEffect } from "react";
import { useLocation } from "react-router-dom";

/** Las tiendas públicas de cada comercio usan su propio tema: ahí no va el fondo de vidrio de Woref. */
export const usaTemaVidrio = (path: string) => !(path.startsWith("/t/") || path.startsWith("/vista-previa-tienda"));

/** Activa el tema "vidrio" (html.woref-glass) según la ruta. */
export function GlassTheme() {
  const { pathname } = useLocation();
  useLayoutEffect(() => { document.documentElement.classList.toggle("woref-glass", usaTemaVidrio(pathname)); }, [pathname]);
  return null;
}
