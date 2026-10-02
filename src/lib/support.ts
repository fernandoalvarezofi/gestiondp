import { ReclamoEstado, ReclamoTipo } from "@/lib/delivery";

export type TicketMessage = { id: number; reclamo_id: string; autor_id: string | null; autor_rol: "cliente" | "soporte" | "sistema"; interna: boolean; texto: string; created_at: string };
export type Prioridad = "normal" | "alta" | "urgente";

export type AdminTicket = {
  id: string; tipo: ReclamoTipo; estado: ReclamoEstado; prioridad: Prioridad; detalle: string; pedido_id: string | null;
  created_at: string; ultimo_mensaje_at: string; ultimo_autor: string | null; primera_respuesta_at: string | null; resuelto_at: string | null;
  asignado_a: string | null; csat: number | null; csat_comentario: string | null; credito_codigo: string | null; reembolso_monto: number;
  cliente_id: string; cliente: string; cliente_email: string | null; cliente_telefono: string | null; comercio: string | null; agente: string | null;
  pedido_total: number | null; pedido_estado: string | null; pedido_pago: string | null; pedido_repartidor: string | null; pedido_fecha: string | null; tickets_cliente: number;
};
export type SupportData = { sla: { respuesta_min: number; resolucion_horas: number }; agentes: { id: string; nombre: string }[]; tickets: AdminTicket[] };

/** Temas para consultas generales (no ligadas a un pedido). */
export const generalTopics: { value: ReclamoTipo; label: string; hint: string }[] = [
  { value: "cuenta", label: "Mi cuenta", hint: "Acceso, datos, seguridad" },
  { value: "pago", label: "Pagos y reintegros", hint: "Cobros, medios de pago" },
  { value: "app", label: "Falla en la app", hint: "Algo no funciona bien" },
  { value: "consulta", label: "Consulta general", hint: "Cualquier otra duda" },
  { value: "sugerencia", label: "Sugerencia", hint: "Ayudanos a mejorar" },
];

export const estadoLabel: Record<ReclamoEstado, string> = {
  abierto: "Abierto", en_curso: "En curso", esperando_cliente: "Esperando tu respuesta", resuelto: "Resuelto", rechazado: "Cerrado",
};
export const isOpenTicket = (estado: ReclamoEstado) => estado === "abierto" || estado === "en_curso" || estado === "esperando_cliente";

/** Estado del SLA de un ticket abierto: sin responder pasado el objetivo, o resolución vencida. */
export function slaState(ticket: Pick<AdminTicket, "estado" | "created_at" | "primera_respuesta_at" | "ultimo_autor" | "ultimo_mensaje_at">, sla: SupportData["sla"], now = Date.now()): "ok" | "riesgo" | "vencido" {
  if (!isOpenTicket(ticket.estado) || ticket.estado === "esperando_cliente") return "ok";
  const waitingSince = new Date(ticket.ultimo_autor === "cliente" || !ticket.primera_respuesta_at ? ticket.ultimo_mensaje_at || ticket.created_at : ticket.created_at).getTime();
  const needsReply = !ticket.primera_respuesta_at || ticket.ultimo_autor === "cliente";
  if (needsReply) {
    const minutes = (now - waitingSince) / 60000;
    if (minutes > sla.respuesta_min) return "vencido";
    if (minutes > sla.respuesta_min * 0.7) return "riesgo";
  }
  const hours = (now - new Date(ticket.created_at).getTime()) / 3600000;
  if (hours > sla.resolucion_horas) return "vencido";
  if (hours > sla.resolucion_horas * 0.75) return "riesgo";
  return "ok";
}

export function waitLabel(iso: string, now = Date.now()) {
  const minutes = Math.max(0, Math.round((now - new Date(iso).getTime()) / 60000));
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)} h`;
  return `${Math.floor(minutes / 1440)} d`;
}
