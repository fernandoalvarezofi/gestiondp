import { useCallback } from "react";
import { useLocation, useNavigate } from "react-router-dom";

const PANELS = ["/app/comercio", "/app/repartidor", "/app/admin"];

/** Pantallas "raíz": las de la barra de abajo y los inicios de cada panel. Ahí no hay a dónde volver. */
const ROOTS = new Set(["/app", "/app/buscar", "/app/pedidos", "/app/favoritos", "/app/servicios", "/app/perfil", ...PANELS]);

const normalize = (pathname: string) => (pathname.length > 1 ? pathname.replace(/\/+$/, "") : pathname);

export const isRootPath = (pathname: string) => ROOTS.has(normalize(pathname));

/** Pantalla "madre" de una ruta: a dónde se vuelve si no hay historial (por ejemplo, al abrir un enlace directo). */
export function parentPath(pathname: string): string {
  const path = normalize(pathname);
  if (ROOTS.has(path)) return "/app";
  if (/^\/app\/tienda\//.test(path) || /^\/app\/categoria\//.test(path) || path === "/app/carrito") return "/app";
  if (/^\/app\/pedidos\/[^/]+$/.test(path) || /^\/app\/envios\/[^/]+$/.test(path)) return "/app/pedidos";
  if (/^\/app\/remis\/[^/]+$/.test(path)) return "/app/remis";
  if (/^\/app\/ayuda\/[^/]+$/.test(path)) return "/app/ayuda";
  if (path === "/app/ayuda") return "/app/perfil/ayuda";
  if (["/app/club", "/app/promociones", "/app/enviar", "/app/remis", "/app/directorio"].includes(path)) return "/app";
  if (/^\/app\/perfil\/[^/]+$/.test(path)) return "/app/perfil";
  const panel = PANELS.find((root) => path.startsWith(`${root}/`));
  if (panel) {
    const rest = path.slice(panel.length + 1).split("/");
    // Dentro de una sección con subpantallas (configuración/horarios) se vuelve al inicio del panel.
    return rest.length > 1 && rest[0] !== "configuracion" ? `${panel}/${rest[0]}` : panel;
  }
  return "/app";
}

/** Título corto de la pantalla actual, para la barra de "volver" del celular. */
export function pageTitle(pathname: string): string {
  const path = normalize(pathname);
  const exact: Record<string, string> = {
    "/app/carrito": "Mi pedido", "/app/club": "Woref Club", "/app/promociones": "Cupones y promociones", "/app/ayuda": "Ayuda",
    "/app/enviar": "Enviar un paquete", "/app/remis": "Pedir un remís", "/app/directorio": "Comercios de Lincoln", "/app/favoritos": "Favoritos", "/app/buscar": "Buscar", "/app/pedidos": "Mis pedidos", "/app/notificaciones": "Notificaciones", "/app/mensajes": "Mensajes", "/app/turnos": "Mis turnos",
  };
  if (exact[path]) return exact[path];
  if (/^\/app\/ayuda\/[^/]+$/.test(path)) return "Consulta";
  if (/^\/app\/envios\/[^/]+$/.test(path)) return "Envío";
  if (/^\/app\/remis\/[^/]+$/.test(path)) return "Tu viaje";
  if (/^\/app\/categoria\//.test(path)) return "Categoría";
  return "";
}

/**
 * Función para "volver" igual en toda la app: usa el historial real del navegador y,
 * si la persona entró directo a una pantalla interna (sin historial), la lleva a su pantalla madre.
 */
export function useGoBack(fallback?: string) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  return useCallback(() => {
    const idx = (window.history.state as { idx?: number } | null)?.idx ?? 0;
    if (idx > 0) navigate(-1);
    else navigate(fallback ?? parentPath(pathname), { replace: true });
  }, [navigate, fallback, pathname]);
}
