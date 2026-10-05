// Lógica pura del carrito con varios comercios (sin React, para poder probarla).
// Un grupo por comercio: cada grupo se confirma y se paga por separado (un pedido por vendedor). Hasta MAX_COMERCIOS grupos.
import type { CartItem, CartStore } from "@/contexts/CartContext";

export type CartGroup = { store: CartStore; items: CartItem[] };
export const MAX_COMERCIOS = 5;
export const MAX_POR_LINEA = 50;

export const subtotalDe = (items: CartItem[]) => items.reduce((total, item) => total + item.precio * item.cantidad, 0);
export const unidadesDe = (items: CartItem[]) => items.reduce((total, item) => total + item.cantidad, 0);
export const totalUnidades = (groups: CartGroup[]) => groups.reduce((total, g) => total + unidadesDe(g.items), 0);
export const totalGeneral = (groups: CartGroup[]) => groups.reduce((total, g) => total + subtotalDe(g.items), 0);

/** Suma una línea al grupo de su comercio (lo crea si hace falta). Devuelve null si ya hay MAX_COMERCIOS comercios distintos. */
export function agregarLinea(groups: CartGroup[], store: CartStore, line: CartItem): CartGroup[] | null {
  const idx = groups.findIndex((g) => g.store.id === store.id);
  if (idx === -1) {
    if (groups.length >= MAX_COMERCIOS) return null;
    return [...groups, { store, items: [line] }];
  }
  return groups.map((g, i) => {
    if (i !== idx) return g;
    const existing = g.items.find((item) => item.lineId === line.lineId);
    const items = existing
      ? g.items.map((item) => (item.lineId === line.lineId ? { ...item, cantidad: Math.min(item.cantidad + line.cantidad, MAX_POR_LINEA), notas: line.notas ?? item.notas } : item))
      : [...g.items, line];
    return { store, items };
  });
}

/** Cambia la cantidad de una línea (0 la quita) y descarta los comercios que quedan vacíos. */
export function cambiarCantidad(groups: CartGroup[], lineId: string, cantidad: number): CartGroup[] {
  return groups
    .map((g) => ({ ...g, items: g.items.map((item) => (item.lineId === lineId ? { ...item, cantidad: Math.min(cantidad, MAX_POR_LINEA) } : item)).filter((item) => item.cantidad > 0) }))
    .filter((g) => g.items.length > 0);
}

/** Resta una unidad de la última línea agregada de ese producto. */
export function quitarUnidad(groups: CartGroup[], productId: string): CartGroup[] {
  for (const g of groups) {
    const last = [...g.items].reverse().find((item) => item.id === productId);
    if (last) return cambiarCantidad(groups, last.lineId, last.cantidad - 1);
  }
  return groups;
}

/** Reemplaza todas las líneas de un comercio (repetir pedido). Sin líneas, lo quita. */
export function reemplazarGrupo(groups: CartGroup[], store: CartStore, items: CartItem[]): CartGroup[] | null {
  const sin = groups.filter((g) => g.store.id !== store.id);
  if (items.length === 0) return sin;
  const existia = sin.length !== groups.length;
  if (!existia && sin.length >= MAX_COMERCIOS) return null;
  return existia ? groups.map((g) => (g.store.id === store.id ? { store, items } : g)) : [...sin, { store, items }];
}

export const quitarGrupo = (groups: CartGroup[], storeId: string) => groups.filter((g) => g.store.id !== storeId);

/** Cantidad de un producto sumando todas sus combinaciones de opciones, en todos los comercios. */
export const cantidadDe = (groups: CartGroup[], productId: string) => groups.flatMap((g) => g.items).filter((item) => item.id === productId).reduce((t, item) => t + item.cantidad, 0);

/** Lee lo guardado: el formato nuevo {groups, active} o el anterior {store, items} (un solo comercio). */
export function leerGuardado(raw: unknown): { groups: CartGroup[]; active: string | null } {
  const r = raw as { groups?: CartGroup[]; active?: string | null; store?: CartStore | null; items?: CartItem[] } | null;
  if (!r || typeof r !== "object") return { groups: [], active: null };
  const limpiar = (items: Partial<CartItem>[] | undefined): CartItem[] => (items ?? []).filter((item) => item && item.id && item.cantidad).map((item) => ({
    ...(item as CartItem), opciones: item.opciones ?? [], precioBase: item.precioBase ?? Number(item.precio), lineId: item.lineId || [item.id, ...(item.opciones ?? []).map((o) => o.id).sort()].join("|"),
  }));
  const groups = Array.isArray(r.groups)
    ? r.groups.filter((g) => g && g.store && g.store.id).map((g) => ({ store: g.store, items: limpiar(g.items) })).filter((g) => g.items.length > 0).slice(0, MAX_COMERCIOS)
    : r.store && r.store.id ? [{ store: r.store, items: limpiar(r.items) }].filter((g) => g.items.length > 0) : [];
  const active = r.active && groups.some((g) => g.store.id === r.active) ? r.active : groups[groups.length - 1]?.store.id ?? null;
  return { groups, active };
}
