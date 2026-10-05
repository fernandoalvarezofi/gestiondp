import { db } from "@/lib/delivery";

export type CategoriaNotificacion = "pedidos" | "pagos" | "turnos" | "devoluciones" | "opiniones" | "mensajes" | "sistema";
export type Notificacion = { id: number; categoria: CategoriaNotificacion; tipo: string; titulo: string; cuerpo: string | null; url: string | null; leida_at: string | null; created_at: string };

export const CATEGORIAS_NOTIFICACION: { id: CategoriaNotificacion; label: string; ayuda: string }[] = [
  { id: "pedidos", label: "Pedidos", ayuda: "Cambios de estado, repartidor asignado, pedidos nuevos en tu local." },
  { id: "pagos", label: "Pagos", ayuda: "Pagos aprobados, rechazados y reintegros." },
  { id: "turnos", label: "Turnos", ayuda: "Confirmaciones, cancelaciones y recordatorios." },
  { id: "devoluciones", label: "Devoluciones", ayuda: "Solicitudes y respuestas." },
  { id: "opiniones", label: "Opiniones", ayuda: "Opiniones nuevas y respuestas del vendedor." },
  { id: "mensajes", label: "Mensajes", ayuda: "Mensajes de compradores y vendedores." },
  { id: "sistema", label: "Avisos de Woref", ayuda: "Novedades importantes de tu cuenta." },
];

/** Solo se navega a rutas internas; el servidor ya lo exige, acá se vuelve a verificar por seguridad. */
export const rutaSegura = (url: string | null | undefined) => (url && /^\/(?!\/)[A-Za-z0-9/_?=&.#%-]*$/.test(url) ? url : null);

export async function fetchNotificaciones(limite = 30, antes?: number): Promise<Notificacion[]> {
  const { data, error } = await db.rpc("mis_notificaciones", { p_limite: limite, p_antes: antes ?? null });
  if (error) throw error;
  return (data ?? []) as Notificacion[];
}
export async function fetchNoLeidas(): Promise<number> { const { data } = await db.rpc("notificaciones_no_leidas"); return Number(data ?? 0); }
export async function marcarLeidas(ids?: number[]) { const { error } = await db.rpc("notificaciones_marcar_leidas", { p_ids: ids ?? null }); if (error) throw error; }
export async function fetchPreferencias(): Promise<Record<CategoriaNotificacion, boolean>> { const { data } = await db.rpc("mis_preferencias_notificaciones"); return (data ?? {}) as Record<CategoriaNotificacion, boolean>; }
export async function guardarPreferencia(categoria: CategoriaNotificacion, push: boolean) { const { error } = await db.rpc("guardar_preferencia_notificacion", { p_categoria: categoria, p_push: push }); if (error) throw error; }

/** "hace 5 min", "ayer", "12/10" — texto corto para la lista. */
export function hace(fecha: string, ahora = Date.now()): string {
  const s = Math.max(0, Math.round((ahora - new Date(fecha).getTime()) / 1000));
  if (s < 60) return "ahora";
  if (s < 3600) return `hace ${Math.floor(s / 60)} min`;
  if (s < 86400) return `hace ${Math.floor(s / 3600)} h`;
  if (s < 172800) return "ayer";
  return new Date(fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" });
}
