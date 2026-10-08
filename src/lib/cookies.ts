import { isNativeApp } from "@/lib/native";

// Consentimiento de cookies y almacenamiento del navegador.
// Woref no usa publicidad ni rastreadores de terceros. Lo que guarda en el navegador es:
//  - necesarias (siempre): sesión y seguridad, carrito, dirección, pedido en curso, y esta misma elección;
//  - preferencias (opcional): apariencia y accesibilidad, favoritos, último panel usado;
//  - medición (opcional): conteo anónimo de visitas a las tiendas y de qué canal vienen los pedidos.

export type CategoriaCookie = "preferencias" | "medicion";
export type Consentimiento = { version: number; preferencias: boolean; medicion: boolean; fecha: string };

const CLAVE = "woref-cookies";
/** Si cambian las categorías, se sube la versión y se vuelve a preguntar. */
export const VERSION_COOKIES = 1;
export const EVENTO_ABRIR = "woref-cookies-abrir";

export function leerConsentimiento(): Consentimiento | null {
  try {
    const valor = JSON.parse(window.localStorage.getItem(CLAVE) || "null") as Consentimiento | null;
    return valor && valor.version === VERSION_COOKIES ? valor : null;
  } catch { return null; }
}

export function guardarConsentimiento(eleccion: { preferencias: boolean; medicion: boolean }, ahora = new Date()): Consentimiento {
  const valor: Consentimiento = { version: VERSION_COOKIES, preferencias: eleccion.preferencias, medicion: eleccion.medicion, fecha: ahora.toISOString() };
  try { window.localStorage.setItem(CLAVE, JSON.stringify(valor)); } catch { /* sin almacenamiento: se vuelve a preguntar la próxima vez */ }
  // Si se rechaza una categoría, se borra lo que ya estaba guardado de ella.
  if (!valor.medicion) borrar(["woref-origen-tienda"], /^woref-visita-/);
  if (!valor.preferencias) borrar(["woref-fav-productos", "woref-contexto", "woref-apariencia"], null);
  return valor;
}

function borrar(claves: string[], patronSesion: RegExp | null) {
  try {
    claves.forEach((k) => window.localStorage.removeItem(k));
    if (patronSesion) Object.keys(window.sessionStorage).filter((k) => patronSesion.test(k)).forEach((k) => window.sessionStorage.removeItem(k));
  } catch { /* sin almacenamiento: no hay nada que borrar */ }
}

/**
 * ¿Se puede usar esta categoría? Mientras la persona no eligió, solo se usa lo necesario
 * (lo opcional queda apagado hasta que acepte).
 */
export function consiente(categoria: CategoriaCookie): boolean {
  // En la app instalada (Android) no hay cookies web: son datos de la propia app y no se muestra el aviso.
  if (isNativeApp()) return true;
  return Boolean(leerConsentimiento()?.[categoria]);
}

/** Vuelve a mostrar el aviso (por ejemplo, desde el pie "Preferencias de cookies"). */
export const abrirPreferenciasCookies = () => window.dispatchEvent(new Event(EVENTO_ABRIR));
