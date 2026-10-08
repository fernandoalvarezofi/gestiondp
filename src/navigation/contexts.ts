import { Bike, CarTaxiFront, ShieldCheck, ShoppingBag, Store, type LucideIcon } from "lucide-react";

/**
 * Contextos de Woref: una misma cuenta puede ser cliente, comercio, repartidor, conductor y/o administración,
 * pero cada contexto tiene su propia navegación, su layout y sus rutas (todas debajo de su prefijo).
 */
export type AppContextId = "cliente" | "comercio" | "repartidor" | "conductor" | "admin";

/** Lo que el contexto necesita saber de la cuenta (sale de `useDeliveryRoles`). */
export type RoleFlags = { isAdmin: boolean; isCourier: boolean; isDriver: boolean; storeId: string | null };

export type AppContextDef = {
  id: AppContextId;
  /** Nombre del contexto ("Cliente", "Mi comercio"…). */
  label: string;
  /** Qué se hace en este contexto, para el selector. */
  description: string;
  /** Prefijo de todas sus rutas. */
  base: string;
  icon: LucideIcon;
  /** La cuenta ya tiene este rol. */
  has: (roles: RoleFlags) => boolean;
  /** Si no lo tiene: cómo se ofrece sumarse (null = no se ofrece, por ejemplo administración). */
  join: { label: string; description: string } | null;
};

export const APP_CONTEXTS: AppContextDef[] = [
  { id: "cliente", label: "Cliente", description: "Pedí, enviá y viajá", base: "/app", icon: ShoppingBag, has: () => true, join: null },
  { id: "comercio", label: "Mi comercio", description: "Pedidos, catálogo y ventas", base: "/app/comercio", icon: Store, has: (r) => Boolean(r.storeId), join: { label: "Sumar mi comercio", description: "Vendé con tu tienda en Woref" } },
  { id: "repartidor", label: "Repartidor", description: "Entregas, ganancias y metas", base: "/app/repartidor", icon: Bike, has: (r) => r.isCourier, join: { label: "Quiero ser repartidor", description: "Hacé entregas y generá ingresos" } },
  { id: "conductor", label: "Conductor", description: "Viajes de remís y ganancias", base: "/app/conductor", icon: CarTaxiFront, has: (r) => r.isDriver, join: { label: "Quiero ser conductor", description: "Llevá pasajeros con tu auto" } },
  { id: "admin", label: "Administración", description: "Gestión de la plataforma", base: "/app/admin", icon: ShieldCheck, has: (r) => r.isAdmin, join: null },
];

export const contextById = (id: AppContextId) => APP_CONTEXTS.find((ctx) => ctx.id === id)!;

/** Contexto al que pertenece una ruta: el prefijo más específico que coincide (todo lo demás de /app es del cliente). */
export function contextFromPath(pathname: string): AppContextId {
  const match = APP_CONTEXTS.filter((ctx) => ctx.id !== "cliente").find((ctx) => pathname === ctx.base || pathname.startsWith(`${ctx.base}/`));
  return match?.id ?? "cliente";
}

/** Contextos que la cuenta puede usar ya mismo y los que se le pueden ofrecer para sumarse. */
export function contextsFor(roles: RoleFlags) {
  return {
    available: APP_CONTEXTS.filter((ctx) => ctx.has(roles)),
    joinable: APP_CONTEXTS.filter((ctx) => !ctx.has(roles) && ctx.join),
  };
}

const LAST_KEY = "woref-contexto";
/** Recuerda el último panel de trabajo usado (para ofrecer volver a él desde el cliente). */
export function rememberContext(id: AppContextId) {
  try { window.localStorage.setItem(LAST_KEY, id); } catch { /* sin almacenamiento: no se recuerda */ }
}
export function lastContext(): AppContextId | null {
  try {
    const value = window.localStorage.getItem(LAST_KEY);
    return APP_CONTEXTS.some((ctx) => ctx.id === value) ? (value as AppContextId) : null;
  } catch { return null; }
}
