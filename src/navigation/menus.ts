import {
  Banknote, BarChart3, Bike, Bug, Building2, CalendarCheck, Calculator, Car, CarTaxiFront, ClipboardList, Fingerprint, Flag, Globe, History,
  Landmark, LayoutDashboard, LifeBuoy, Map, MapPinOff, Megaphone, MessageCircle, MessageCircleQuestion, Network, Package, PackageOpen,
  Radio, Route, ScrollText, Send, Settings, Star, Store, Tags, Target, Undo2, UserCircle, Users, UsersRound, UtensilsCrossed, Wallet, BookUser, ShieldCheck, TrendingUp, type LucideIcon,
} from "lucide-react";
import type { PanelNavGroup } from "@/components/panel/PanelShell";
import type { Permission } from "@/pages/delivery/merchant/context";

/*
 * Menús de cada contexto, como datos. Los layouts solo los dibujan: así no hay componentes llenos de "si el rol es…"
 * y cada ruta, su ícono, su grupo y su permiso se definen en un único lugar.
 */

// Cliente: ver clientMenu.ts (se reexporta para no romper importaciones).
export { CLIENT_TABS, GUEST_TABS, type ClientTab } from "./clientMenu";

// ───────────────────────── Comercio ─────────────────────────

type MerchantSection = { path: string; label: string; short?: string; icon: LucideIcon; group: string; permission?: Permission; end?: boolean; hidden?: boolean; badge?: "pedidos" | "preguntas" | "mensajes" };

const MERCHANT_GROUPS = ["Operación", "Catálogo", "Tienda online", "Marketing", "Ventas", "Mi negocio"] as const;

/** Secciones del panel del comercio (ruta relativa a /app/comercio). `permission` es lo que exige el rol del equipo. */
export const MERCHANT_SECTIONS: MerchantSection[] = [
  { path: "", label: "Inicio", icon: LayoutDashboard, group: "Operación", end: true },
  { path: "pedidos", label: "Pedidos", icon: ClipboardList, group: "Operación", badge: "pedidos" },
  { path: "devoluciones", label: "Devoluciones", short: "Devol.", icon: PackageOpen, group: "Operación", permission: "pedidos" },
  { path: "turnos", label: "Reservas y turnos", short: "Turnos", icon: CalendarCheck, group: "Operación", permission: "pedidos" },
  { path: "mensajes", label: "Mensajes", icon: MessageCircle, group: "Operación", badge: "mensajes" },
  { path: "menu", label: "Productos y stock", short: "Catálogo", icon: UtensilsCrossed, group: "Catálogo", permission: "catalogo" },
  { path: "tienda", label: "Diseño de mi tienda", short: "Tienda", icon: Globe, group: "Tienda online", permission: "ajustes" },
  { path: "preguntas", label: "Preguntas", icon: MessageCircleQuestion, group: "Tienda online", permission: "opiniones", badge: "preguntas" },
  { path: "opiniones", label: "Opiniones", icon: Star, group: "Tienda online", permission: "opiniones" },
  { path: "promociones", label: "Promociones y cupones", short: "Promos", icon: Megaphone, group: "Marketing", permission: "promociones" },
  { path: "campanas", label: "Campañas", icon: Send, group: "Marketing", permission: "promociones" },
  { path: "clientes", label: "Clientes", icon: Users, group: "Ventas", permission: "estadisticas" },
  { path: "finanzas", label: "Finanzas y liquidaciones", short: "Finanzas", icon: Landmark, group: "Ventas", permission: "finanzas" },
  { path: "estadisticas", label: "Estadísticas", short: "Datos", icon: BarChart3, group: "Ventas", permission: "estadisticas" },
  { path: "equipo", label: "Equipo", icon: UsersRound, group: "Mi negocio", permission: "equipo" },
  { path: "sucursales", label: "Mis comercios", short: "Comercios", icon: Building2, group: "Mi negocio", permission: "equipo" },
  { path: "configuracion", label: "Configuración", short: "Ajustes", icon: Settings, group: "Mi negocio", permission: "ajustes" },
  { path: "nuevo", label: "Crear otro comercio", icon: Store, group: "Mi negocio", permission: "equipo", hidden: true },
];

const merchantTo = (path: string) => (path ? `/app/comercio/${path}` : "/app/comercio");

/** Permiso que exige una ruta del panel del comercio (primer tramo después de /app/comercio). */
export const merchantSectionPermission = (section: string) => MERCHANT_SECTIONS.find((item) => item.path === section)?.permission;

export function merchantNav(can: (permission: Permission) => boolean, badges: { pedidos: number; preguntas: number; mensajes?: number }): PanelNavGroup[] {
  const allowed = MERCHANT_SECTIONS.filter((item) => !item.hidden && (!item.permission || can(item.permission)));
  return MERCHANT_GROUPS.map((label) => ({
    label,
    items: allowed.filter((item) => item.group === label).map((item) => ({ to: merchantTo(item.path), label: item.label, short: item.short, icon: item.icon, end: item.end, badge: item.badge ? badges[item.badge] : undefined })),
  })).filter((group) => group.items.length > 0);
}

/** Barra de abajo del comercio en el celular: lo más usado que el rol permite. */
export const merchantTabs = (can: (permission: Permission) => boolean) =>
  ["", "pedidos", "menu", "estadisticas", "configuracion"].filter((path) => { const need = merchantSectionPermission(path); return !need || can(need); }).map(merchantTo);

// ───────────────────────── Repartidor ─────────────────────────

/** Barra de abajo del repartidor en el celular (Metas y turnos queda en el menú lateral). */
export const COURIER_TABS = ["/app/repartidor", "/app/repartidor/mapa", "/app/repartidor/ganancias", "/app/repartidor/historial", "/app/repartidor/perfil"];

export const courierNav = (offers: number | undefined, mensajes?: number): PanelNavGroup[] => [{ items: [
  { to: "/app/repartidor", label: "Trabajos", icon: ClipboardList, end: true, badge: offers },
  { to: "/app/repartidor/mapa", label: "Mapa", icon: Map },
  { to: "/app/repartidor/mensajes", label: "Mensajes", icon: MessageCircle, badge: mensajes },
  { to: "/app/repartidor/ganancias", label: "Ganancias", icon: Wallet },
  { to: "/app/repartidor/incentivos", label: "Metas y turnos", short: "Metas", icon: Target },
  { to: "/app/repartidor/historial", label: "Historial", icon: History },
  { to: "/app/repartidor/perfil", label: "Mi perfil", short: "Perfil", icon: UserCircle },
] }];

// ───────────────────────── Conductor ─────────────────────────

export const driverNav = (offers: number | undefined, mensajes?: number): PanelNavGroup[] => [{ items: [
  { to: "/app/conductor", label: "Viajes", icon: CarTaxiFront, end: true, badge: offers },
  { to: "/app/conductor/mapa", label: "Mapa", icon: Map },
  { to: "/app/conductor/mensajes", label: "Mensajes", icon: MessageCircle, badge: mensajes },
  { to: "/app/conductor/ganancias", label: "Ganancias", icon: Wallet },
  { to: "/app/conductor/historial", label: "Historial", icon: History },
  { to: "/app/conductor/perfil", label: "Mi perfil", short: "Perfil", icon: UserCircle },
] }];

// ───────────────────────── Administración ─────────────────────────

export type AdminBadge = "pedidos" | "soporte" | "comercios" | "identidades" | "pagos" | "opiniones" | "mensajes";
export type AdminSection = { id: string; label: string; icon: LucideIcon; group: string; badge?: AdminBadge };

const ADMIN_GROUPS = ["General", "Operación", "Personas", "Dinero", "Marketing y catálogo", "Soporte y confianza", "Sistema"] as const;

/** Secciones de administración: cada una es una ruta /app/admin/:id (la de "resumen" es /app/admin). */
export const ADMIN_SECTIONS: AdminSection[] = [
  { id: "resumen", label: "Resumen", icon: LayoutDashboard, group: "General" },
  { id: "operaciones", label: "Centro de operaciones", icon: Radio, group: "General" },
  { id: "analytics", label: "Analytics", icon: TrendingUp, group: "General" },
  { id: "pedidos", label: "Pedidos", icon: ClipboardList, group: "Operación", badge: "pedidos" },
  { id: "viajes", label: "Viajes de remís", icon: CarTaxiFront, group: "Operación" },
  { id: "envios", label: "Mensajería", icon: Package, group: "Operación" },
  { id: "trabajos", label: "Trabajos de logística", icon: Route, group: "Operación" },
  { id: "zonas", label: "Zonas y tarifas", icon: Map, group: "Operación" },
  { id: "demanda", label: "Zonas sin cobertura", icon: MapPinOff, group: "Operación" },
  { id: "clientes", label: "Clientes", icon: Users, group: "Personas" },
  { id: "comercios", label: "Comercios", icon: Store, group: "Personas", badge: "comercios" },
  { id: "repartidores", label: "Repartidores", icon: Bike, group: "Personas" },
  { id: "conductores", label: "Conductores", icon: Car, group: "Personas" },
  { id: "identidades", label: "Verificar identidad", icon: Fingerprint, group: "Personas", badge: "identidades" },
  { id: "incentivos", label: "Metas y turnos", icon: Target, group: "Personas" },
  { id: "red", label: "Red de proveedores", icon: Network, group: "Personas" },
  { id: "pagos", label: "Pagos y reintegros", icon: Banknote, group: "Dinero", badge: "pagos" },
  { id: "contabilidad", label: "Contabilidad", icon: Calculator, group: "Dinero" },
  { id: "liquidaciones", label: "Liquidaciones y comisiones", icon: Landmark, group: "Dinero" },
  { id: "cupones", label: "Cupones", icon: Megaphone, group: "Marketing y catálogo" },
  { id: "anuncios", label: "Anuncios y campañas", icon: Send, group: "Marketing y catálogo" },
  { id: "categorias", label: "Categorías del Market", icon: Tags, group: "Marketing y catálogo" },
  { id: "directorio", label: "Directorio de la ciudad", icon: BookUser, group: "Marketing y catálogo" },
  { id: "soporte", label: "Soporte", icon: LifeBuoy, group: "Soporte y confianza", badge: "soporte" },
  { id: "arrepentimientos", label: "Arrepentimientos", icon: Undo2, group: "Soporte y confianza" },
  { id: "opiniones", label: "Opiniones reportadas", icon: Flag, group: "Soporte y confianza", badge: "opiniones" },
  { id: "mensajes", label: "Mensajes reportados", icon: MessageCircle, group: "Soporte y confianza", badge: "mensajes" },
  { id: "seguridad", label: "Seguridad", icon: ShieldCheck, group: "Sistema" },
  { id: "auditoria", label: "Auditoría", icon: ScrollText, group: "Sistema" },
  { id: "errores", label: "Errores de la app", icon: Bug, group: "Sistema" },
  { id: "configuracion", label: "Configuración", icon: Settings, group: "Sistema" },
];

/** Rutas viejas de administración que ahora tienen otro nombre. */
export const ADMIN_REDIRECTS: Record<string, string> = { remises: "conductores" };

export const adminTo = (id: string) => (id === "resumen" ? "/app/admin" : `/app/admin/${id}`);

export function adminNav(badges: Partial<Record<AdminBadge, number>>): PanelNavGroup[] {
  return ADMIN_GROUPS.map((label) => ({
    label,
    items: ADMIN_SECTIONS.filter((item) => item.group === label).map((item) => ({ to: adminTo(item.id), label: item.label, icon: item.icon, end: item.id === "resumen", badge: item.badge ? badges[item.badge] : undefined })),
  }));
}
