// Origen de un pedido: si el cliente llegó desde la tienda online del comercio (/t/...) en las últimas 24 h,
// el pedido se marca como "tienda" para que el comercio vea cuánto vende por ese canal.
const CLAVE = "woref-origen-tienda";
const VIGENCIA_MS = 24 * 60 * 60 * 1000;

export function marcarOrigenTienda(comercioId: string): void {
  try { window.localStorage.setItem(CLAVE, JSON.stringify({ id: comercioId, at: Date.now() })); } catch { /* sin almacenamiento: el pedido queda como "app" */ }
}

export function vinoDeTienda(comercioId: string, ahora = Date.now()): boolean {
  try {
    const guardado = JSON.parse(window.localStorage.getItem(CLAVE) || "null") as { id?: string; at?: number } | null;
    return Boolean(guardado && guardado.id === comercioId && typeof guardado.at === "number" && ahora - guardado.at < VIGENCIA_MS);
  } catch { return false; }
}
