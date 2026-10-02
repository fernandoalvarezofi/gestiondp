import { db } from "@/lib/delivery";

/** Cargar un archivo de una versión vieja de la app (después de publicar una nueva) falla con estos mensajes. */
const isStaleChunk = (message: string) => /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|Unable to preload CSS/i.test(message);

const seen = new Set<string>();

/** Avisa de un error a administración (sin datos personales: mensaje, pantalla y navegador). */
export function reportError(error: unknown, context?: string) {
  const err = error instanceof Error ? error : new Error(typeof error === "string" ? error : "Error desconocido");
  const key = `${err.message}|${err.stack?.slice(0, 120) ?? ""}`;
  if (seen.has(key)) return;
  seen.add(key);
  // Si falló por una versión vieja, recargamos una sola vez para traer la nueva.
  if (isStaleChunk(err.message)) {
    try {
      if (sessionStorage.getItem("woref-chunk-reload") !== "1") { sessionStorage.setItem("woref-chunk-reload", "1"); window.location.reload(); return; }
    } catch { /* sin almacenamiento: seguimos y lo reportamos */ }
  }
  void Promise.resolve(db.rpc("delivery_reportar_error", {
    p_mensaje: context ? `${context}: ${err.message}` : err.message,
    p_stack: err.stack ?? null,
    p_url: `${window.location.pathname}${window.location.search}`.slice(0, 300),
    p_agente: navigator.userAgent,
  })).catch(() => undefined);
}

/** Captura los errores que nadie atajó (de la pantalla y de promesas). */
export function initMonitoring() {
  window.addEventListener("error", (event) => {
    // Los errores de carga de imágenes u otros recursos no son errores de código.
    if (event.target && event.target !== window) return;
    reportError(event.error ?? event.message);
  });
  window.addEventListener("unhandledrejection", (event) => reportError(event.reason, "Promesa sin atajar"));
}
