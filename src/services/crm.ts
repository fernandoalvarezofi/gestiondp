import { db } from "@/lib/delivery";

/*
 * CRM del comercio. Contacto = una persona en relación con el local (con o sin cuenta de Woref).
 * Pedidos, turnos, conversaciones y reclamos no se copian: la ficha los reúne desde su origen.
 * Todo pasa por funciones del servidor que validan el permiso del local (dueño y encargados).
 */

export type Segmento = "nuevo" | "recurrente" | "vip" | "inactivo" | "interesado" | "ocasional";
export const SEGMENTOS: Record<Segmento, { texto: string; ayuda: string; clase: string }> = {
  nuevo: { texto: "Nuevo", ayuda: "Primera compra o turno en los últimos 30 días", clase: "bg-primary/10 text-primary" },
  recurrente: { texto: "Recurrente", ayuda: "Volvió a comprar o reservar", clase: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  vip: { texto: "VIP", ayuda: "3 o más operaciones y de los que más gastan en tu local", clase: "bg-brand-yellow/25 text-brand-yellow-foreground" },
  inactivo: { texto: "Inactivo", ayuda: "Sin compras ni turnos hace más de 60 días", clase: "bg-muted text-muted-foreground" },
  interesado: { texto: "Interesado", ayuda: "Escribió o se suscribió, todavía no compró", clase: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  ocasional: { texto: "Ocasional", ayuda: "Una compra o turno reciente", clase: "bg-muted text-foreground" },
};

export type Contacto = {
  id: string; nombre: string; telefono: string | null; email: string | null; etiquetas: string[]; notas: string | null;
  con_cuenta: boolean; cliente_id: string | null; origen: "pedido" | "turno" | "mensaje" | "tienda" | "manual";
  acepta_marketing: boolean; marketing_at: string | null;
  pedidos: number; turnos: number; operaciones: number; gastado: number; ticket_promedio: number;
  primera: string | null; ultima_compra: string | null; ultima_interaccion: string | null; proximo_turno: string | null;
  ausentes: number; tareas: number; tareas_vencidas: number; segmento: Segmento; creado: string;
};

export type TipoActividad = "nota" | "llamada" | "whatsapp" | "email" | "reunion" | "tarea";
export const ACTIVIDADES: Record<TipoActividad, string> = {
  nota: "Nota interna", llamada: "Llamada", whatsapp: "WhatsApp", email: "Email", reunion: "Reunión o visita", tarea: "Tarea de seguimiento",
};

/** Un evento de la línea de tiempo: algo que pasó (pedido, turno, conversación, reclamo) o algo que registró el equipo. */
export type EventoLinea = {
  tipo: "pedido" | "turno" | "mensaje" | "reclamo" | TipoActividad; id: string; fecha: string; titulo: string; detalle: string | null;
  estado: string | null; monto?: number; actividad?: boolean; vence_at?: string | null; completada_at?: string | null; autor?: string; creado?: string;
};
export type Duplicado = { id: string; nombre: string; telefono: string | null; email: string | null; con_cuenta: boolean; motivo: string };
export type Ficha = Contacto & { linea: EventoLinea[]; duplicados: Duplicado[]; comercio_id: string };

export type ResumenCrm = {
  total: number; segmentos: Partial<Record<Segmento, number>>; con_marketing: number; nuevos_30d: number;
  tareas_pendientes: number; tareas_vencidas: number; tareas_hoy: number; consultas_sin_responder: number; turnos_hoy: number;
};
export type Tarea = { id: string; titulo: string; detalle: string | null; vence_at: string; completada_at: string | null; contacto_id: string; contacto: string; telefono: string | null; autor: string };
export type FiltroLista = { q?: string; segmento?: Segmento | "con_tareas" | "marketing" | null; etiqueta?: string | null; orden?: "reciente" | "gasto" | "operaciones" | "nombre" | "antiguedad" };

const lanzar = (error: unknown) => { if (error) throw error; };

export async function listarClientes(comercio: string, filtro: FiltroLista, limite = 50, offset = 0): Promise<{ total: number; items: Contacto[] }> {
  const { data, error } = await db.rpc("crm_clientes", {
    p_comercio: comercio, p_q: filtro.q?.trim() || null, p_segmento: filtro.segmento ?? null, p_etiqueta: filtro.etiqueta ?? null,
    p_orden: filtro.orden ?? "reciente", p_limite: limite, p_offset: offset,
  });
  lanzar(error);
  return data;
}
export async function resumenCrm(comercio: string): Promise<ResumenCrm> { const { data, error } = await db.rpc("crm_resumen", { p_comercio: comercio }); lanzar(error); return data; }
export async function fichaCliente(id: string): Promise<Ficha | { fusionado_en: string }> { const { data, error } = await db.rpc("crm_ficha", { p_contacto: id }); lanzar(error); return data; }
export async function etiquetasCrm(comercio: string): Promise<{ etiqueta: string; cantidad: number }[]> { const { data, error } = await db.rpc("crm_etiquetas", { p_comercio: comercio }); lanzar(error); return data ?? []; }
export async function guardarContacto(comercio: string, id: string | null, datos: { nombre: string; telefono?: string | null; email?: string | null; etiquetas?: string[]; notas?: string | null; acepta_marketing?: boolean }): Promise<string> {
  const { data, error } = await db.rpc("crm_contacto_guardar", { p_comercio: comercio, p_id: id, p_datos: datos }); lanzar(error); return data;
}
export async function guardarActividad(contacto: string, id: string | null, datos: { tipo: TipoActividad; titulo: string; detalle?: string | null; vence_at?: string | null }): Promise<string> {
  const { data, error } = await db.rpc("crm_actividad_guardar", { p_contacto: contacto, p_id: id, p_datos: datos }); lanzar(error); return data;
}
export async function marcarTarea(id: string, completada: boolean) { const { error } = await db.rpc("crm_actividad_estado", { p_id: id, p_completada: completada }); lanzar(error); }
export async function eliminarActividad(id: string) { const { error } = await db.rpc("crm_actividad_eliminar", { p_id: id }); lanzar(error); }
export async function listarTareas(comercio: string, filtro: "pendientes" | "vencidas" | "hoy" | "proximas" | "completadas"): Promise<Tarea[]> {
  const { data, error } = await db.rpc("crm_tareas", { p_comercio: comercio, p_filtro: filtro }); lanzar(error); return data ?? [];
}
export async function fusionarContactos(origen: string, destino: string): Promise<string> { const { data, error } = await db.rpc("crm_fusionar", { p_origen: origen, p_destino: destino }); lanzar(error); return data; }
export async function contactoDeCliente(comercio: string, cliente: string): Promise<string> { const { data, error } = await db.rpc("crm_contacto_de_cliente", { p_comercio: comercio, p_cliente: cliente }); lanzar(error); return data; }

/** Iniciales para el avatar ("Carla Pérez" -> "CP"). */
export const iniciales = (nombre: string) => nombre.trim().split(/\s+/).slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
/** Enlace de WhatsApp para un teléfono argentino (agrega 54 si falta el código de país). */
export function whatsappUrl(telefono: string | null): string | null {
  const d = (telefono ?? "").replace(/\D/g, "");
  if (d.length < 8) return null;
  return `https://wa.me/${d.startsWith("54") ? d : `54${d.replace(/^0/, "")}`}`;
}
/** "hace 3 días", "en 2 horas"… en español. */
export function relativo(iso: string | null, ahora = Date.now()): string {
  if (!iso) return "—";
  const diff = new Date(iso).getTime() - ahora;
  const abs = Math.abs(diff);
  const rtf = new Intl.RelativeTimeFormat("es-AR", { numeric: "auto" });
  if (abs < 60_000) return rtf.format(Math.round(diff / 1000), "second");
  if (abs < 3_600_000) return rtf.format(Math.round(diff / 60_000), "minute");
  if (abs < 86_400_000) return rtf.format(Math.round(diff / 3_600_000), "hour");
  if (abs < 2_592_000_000) return rtf.format(Math.round(diff / 86_400_000), "day");
  if (abs < 31_536_000_000) return rtf.format(Math.round(diff / 2_592_000_000), "month");
  return rtf.format(Math.round(diff / 31_536_000_000), "year");
}
