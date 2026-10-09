import { toast } from "sonner";
import { confirmar } from "@/components/ui/dialogos";
import { db, errorMessage } from "@/lib/delivery";

export const TZ = "America/Argentina/Buenos_Aires";
export type Modalidad = "en_local" | "a_domicilio" | "online";
export const MODALIDAD: Record<Modalidad, string> = { en_local: "En el local", a_domicilio: "A domicilio", online: "Online" };
export type EstadoTurno = "pendiente" | "confirmado" | "en_curso" | "completado" | "cancelado" | "ausente";
export const ESTADO_TURNO: Record<EstadoTurno, { texto: string; clase: string }> = {
  pendiente: { texto: "Por confirmar", clase: "bg-brand-yellow/25 text-brand-yellow-foreground" },
  confirmado: { texto: "Confirmado", clase: "bg-primary/10 text-primary" },
  en_curso: { texto: "En curso", clase: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  completado: { texto: "Realizado", clase: "bg-success/15 text-success" },
  cancelado: { texto: "Cancelado", clase: "bg-muted text-muted-foreground" },
  ausente: { texto: "No vino", clase: "bg-destructive/10 text-destructive" },
};
export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

export type Servicio = {
  id: string; comercio_id: string; nombre: string; descripcion: string | null; duracion_min: number; precio: number; modalidad: Modalidad; categoria_id: string | null; imagen_url: string | null;
  anticipacion_horas: number; cancelar_hasta_horas: number; orden: number; activo: boolean;
  /** Preparación antes y limpieza después (bloquean la agenda, no se cobran). */
  buffer_antes_min?: number; buffer_despues_min?: number;
  /** Cada cuántos minutos se ofrece un horario. */
  intervalo_min?: number;
  /** Hasta cuántos días antes se puede reservar. */
  reserva_max_dias?: number;
  /** Personas por horario: 1 = individual, más = grupal. */
  capacidad?: number;
  /** Si el local confirma a mano cada turno (nace "por confirmar"). */
  requiere_confirmacion?: boolean;
  recurso_id?: string | null; color?: string | null;
};
export type Recurso = { id: string; comercio_id: string; nombre: string; descripcion: string | null; orden: number; activo: boolean };
export type Cierre = { id: string; comercio_id: string; desde: string; hasta: string; motivo: string | null };
export type AjustesAgenda = { comercio_id: string; recordatorio_24h: boolean; recordatorio_2h: boolean; cliente_reprograma: boolean; max_reprogramaciones: number; lista_espera: boolean };
export const AJUSTES_AGENDA_BASE: Omit<AjustesAgenda, "comercio_id"> = { recordatorio_24h: true, recordatorio_2h: true, cliente_reprograma: true, max_reprogramaciones: 2, lista_espera: true };
export type Profesional = { id: string; comercio_id: string; nombre: string; bio: string | null; avatar_url: string | null; activo: boolean; usuario_id?: string | null };
export type Tramo = { id?: string; dia_semana: number; desde: string; hasta: string };
export type Bloqueo = { id: string; profesional_id: string; desde: string; hasta: string; motivo: string | null };
export type HorarioLibre = { inicio: string; profesional_id: string; lugares?: number | null };
export type DiaLibre = { fecha: string; horarios: HorarioLibre[] };
export type Turno = {
  id: string; inicio: string; fin: string; estado: EstadoTurno; precio: number; notas: string | null; servicio: string; duracion_min: number; modalidad: Modalidad; profesional: string;
  comercio: string; comercio_slug: string; direccion: string | null; cancelar_hasta: string; puede_cancelar: boolean; cancelado_por: "cliente" | "comercio" | null;
  servicio_id?: string; profesional_id?: string; comercio_id?: string; personas?: number; puede_reprogramar?: boolean; motivo_cancelacion?: string | null;
};
export type TurnoAgenda = {
  id: string; inicio: string; fin: string; estado: EstadoTurno; precio: number; notas: string | null; telefono: string | null; servicio: string; profesional_id: string; profesional: string; cliente: string; puede_cerrar: boolean;
  servicio_id?: string; color?: string | null; recurso?: string | null; cliente_id?: string | null; personas?: number; origen?: "online" | "panel"; grupal?: boolean;
  nota_interna?: string | null; reprogramaciones?: number; cancelado_por?: "cliente" | "comercio" | null; motivo_cancelacion?: string | null; puede_empezar?: boolean;
};
export type FichaCliente = {
  cliente_id: string | null; nombre: string; telefono: string | null; con_cuenta: boolean; nota: string | null; total: number; completados: number; ausentes: number; cancelados: number;
  gastado: number; pedidos: number; primera_visita: string | null;
  turnos: { id: string; inicio: string; estado: EstadoTurno; servicio: string; profesional: string; precio: number }[];
  historial: { evento: string; detalle: Record<string, unknown>; fecha: string; por: string }[];
};
export type MetricasAgenda = {
  total: number; por_estado: Partial<Record<EstadoTurno, number>>; ingresos: number; ingresos_previstos: number; perdido_ausencias: number; online: number; panel: number; clientes_unicos: number;
  minutos_ocupados: number; minutos_disponibles: number;
  por_servicio: { servicio: string; turnos: number; completados: number; cancelados: number; ausentes: number; ingresos: number }[];
  por_profesional: { profesional: string; turnos: number; minutos_ocupados: number; minutos_disponibles: number; ingresos: number }[];
  por_dia_semana: { dia: number; turnos: number }[]; por_hora: { hora: number; turnos: number }[];
};
export type AccionMasiva = "confirmar" | "cancelar" | "completar" | "ausente" | "empezar";
export const EVENTO_TURNO: Record<string, string> = {
  creado: "Turno creado", pendiente: "Quedó por confirmar", confirmado: "Confirmado", en_curso: "Empezó", completado: "Se realizó", ausente: "No vino", cancelado: "Cancelado", reprogramado: "Cambió de horario", nota: "Nota interna actualizada",
};
/** Ocupación en porcentaje (0 si no hay horas disponibles). */
export const ocupacion = (ocupados: number, disponibles: number) => (disponibles > 0 ? Math.min(100, Math.round((ocupados / disponibles) * 100)) : 0);

// --- Formato (siempre en horario de Argentina, sin importar dónde esté el navegador) ---
export const horaLocal = (iso: string) => new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: TZ }).format(new Date(iso));
export const fechaCorta = (iso: string) => new Intl.DateTimeFormat("es-AR", { weekday: "short", day: "numeric", month: "short", timeZone: TZ }).format(new Date(iso));
export const fechaLarga = (iso: string) => new Intl.DateTimeFormat("es-AR", { weekday: "long", day: "numeric", month: "long", timeZone: TZ }).format(new Date(iso));
/** "YYYY-MM-DD" de hoy en Argentina. */
export const hoyLocal = (ahora = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: TZ }).format(ahora);
export const sumarDias = (fecha: string, dias: number) => { const d = new Date(`${fecha}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + dias); return d.toISOString().slice(0, 10); };
export const diaDeSemana = (fecha: string) => new Date(`${fecha}T12:00:00Z`).getUTCDay();
/** "09:00:00" -> "09:00" */
export const hhmm = (t: string) => t.slice(0, 5);
export const duracionTexto = (min: number) => (min < 60 ? `${min} min` : `${Math.floor(min / 60)} h${min % 60 ? ` ${min % 60} min` : ""}`);

/** Valida un tramo de agenda (lo mismo que exige la base: desde < hasta) y que no se pise con otros del mismo día. */
export function tramosValidos(tramos: Tramo[]): string | null {
  for (const t of tramos) if (!(t.desde < t.hasta)) return `En ${DIAS[t.dia_semana]}, la hora de inicio tiene que ser anterior a la de fin`;
  for (let d = 0; d < 7; d++) {
    const del = tramos.filter((t) => t.dia_semana === d).sort((a, b) => a.desde.localeCompare(b.desde));
    for (let i = 1; i < del.length; i++) if (del[i].desde < del[i - 1].hasta) return `En ${DIAS[d]} hay horarios que se pisan`;
  }
  return null;
}

export async function fetchHorarios(servicio: string, profesional: string | null, desde: string, dias = 14): Promise<DiaLibre[]> {
  const { data, error } = await db.rpc("servicio_horarios_libres", { p_servicio: servicio, p_profesional: profesional, p_desde: desde, p_dias: dias });
  if (error) throw error;
  return (data ?? []) as DiaLibre[];
}
export async function reservarTurno(input: { servicio: string; inicio: string; profesional?: string | null; telefono?: string; notas?: string; personas?: number }) {
  const { data, error } = await db.rpc("turno_reservar", { p_servicio: input.servicio, p_inicio: input.inicio, p_profesional: input.profesional ?? null, p_telefono: input.telefono?.trim() || null, p_notas: input.notas?.trim() || null, p_personas: input.personas ?? 1 });
  if (error) throw error;
  return data as string;
}
export async function cancelarTurno(id: string, motivo?: string) { const { error } = await db.rpc("turno_cancelar", { p_id: id, p_motivo: motivo?.trim() || null }); if (error) throw error; }
export async function cerrarTurno(id: string, estado: "completado" | "ausente") { const { error } = await db.rpc("turno_cerrar", { p_id: id, p_estado: estado }); if (error) throw error; }
export async function cambiarEstadoTurno(id: string, estado: "confirmado" | "en_curso" | "completado" | "ausente" | "cancelado", motivo?: string) {
  const { error } = await db.rpc("turno_cambiar_estado", { p_id: id, p_estado: estado, p_motivo: motivo?.trim() || null });
  if (error) throw error;
}
export async function reprogramarTurno(id: string, inicio: string, profesional?: string | null) {
  const { error } = await db.rpc("turno_reprogramar", { p_id: id, p_inicio: inicio, p_profesional: profesional ?? null });
  if (error) throw error;
}
export async function turnoMasivo(ids: string[], accion: AccionMasiva, motivo?: string): Promise<{ aplicados: number; errores: { id: string; error: string }[] }> {
  const { data, error } = await db.rpc("turno_masivo", { p_ids: ids, p_accion: accion, p_motivo: motivo?.trim() || null });
  if (error) throw error;
  return data;
}
export async function crearTurnoPanel(input: { servicio: string; profesional: string; inicio: string; cliente?: string | null; nombre?: string; telefono?: string; notas?: string; personas?: number; notaInterna?: string }) {
  const { data, error } = await db.rpc("turno_crear_panel", {
    p_servicio: input.servicio, p_profesional: input.profesional, p_inicio: input.inicio, p_cliente: input.cliente ?? null, p_cliente_nombre: input.nombre?.trim() || null,
    p_telefono: input.telefono?.trim() || null, p_notas: input.notas?.trim() || null, p_personas: input.personas ?? 1, p_nota_interna: input.notaInterna?.trim() || null,
  });
  if (error) throw error;
  return data as string;
}
export async function guardarNotaInterna(id: string, nota: string) { const { error } = await db.rpc("turno_nota_interna", { p_id: id, p_nota: nota }); if (error) throw error; }
export async function guardarNotaCliente(comercio: string, cliente: string, nota: string) { const { error } = await db.rpc("cliente_nota_guardar", { p_comercio: comercio, p_cliente: cliente, p_nota: nota }); if (error) throw error; }
export async function fetchFicha(turno: string): Promise<FichaCliente> { const { data, error } = await db.rpc("turno_cliente_ficha", { p_turno: turno }); if (error) throw error; return data; }
export async function fetchMetricas(comercio: string, desde: string, hasta: string): Promise<MetricasAgenda> {
  const { data, error } = await db.rpc("turnos_metricas", { p_comercio: comercio, p_desde: desde, p_hasta: hasta });
  if (error) throw error;
  return data;
}
export async function unirseEspera(servicio: string, fecha: string, profesional?: string | null) {
  const { error } = await db.rpc("turno_espera_unirse", { p_servicio: servicio, p_fecha: fecha, p_profesional: profesional ?? null });
  if (error) throw error;
}
export async function fetchMisTurnos(): Promise<Turno[]> { const { data } = await db.rpc("mis_turnos"); return (data ?? []) as Turno[]; }
export async function fetchAgenda(comercio: string, desde: string, hasta: string, filtros: { profesional?: string | null; servicio?: string | null; estado?: EstadoTurno | null } = {}): Promise<TurnoAgenda[]> {
  const { data, error } = await db.rpc("delivery_turnos_agenda", { p_comercio: comercio, p_desde: desde, p_hasta: hasta, p_profesional: filtros.profesional ?? null, p_servicio: filtros.servicio ?? null, p_estado: filtros.estado ?? null });
  if (error) throw error;
  return (data ?? []) as TurnoAgenda[];
}
export async function fetchAjustesAgenda(comercio: string): Promise<AjustesAgenda> {
  const { data } = await db.from("agenda_ajustes").select("*").eq("comercio_id", comercio).maybeSingle();
  return { comercio_id: comercio, ...AJUSTES_AGENDA_BASE, ...(data ?? {}) };
}

// --- Calendario de la agenda (semana empieza el lunes) ---
/** Lunes de la semana de una fecha "YYYY-MM-DD". */
export const inicioSemana = (fecha: string) => sumarDias(fecha, -((diaDeSemana(fecha) + 6) % 7));
/** Días que se muestran en la grilla mensual (de lunes a domingo, semanas completas). */
export function diasDelMes(fecha: string): string[] {
  const primero = `${fecha.slice(0, 7)}-01`;
  const desde = inicioSemana(primero);
  const siguiente = sumarDias(primero, 32).slice(0, 7);
  const ultimo = sumarDias(`${siguiente}-01`, -1);
  const hasta = sumarDias(inicioSemana(ultimo), 6);
  const out: string[] = [];
  for (let d = desde; d <= hasta; d = sumarDias(d, 1)) out.push(d);
  return out;
}
/** Minutos desde la medianoche (hora de Argentina) de un instante. */
export const minutosDelDia = (iso: string) => { const [h, m] = horaLocal(iso).split(":").map(Number); return h * 60 + m; };
/** "YYYY-MM-DD" (Argentina) de un instante. */
export const fechaLocal = (iso: string) => hoyLocal(new Date(iso));
export async function fetchServiciosDeTienda(comercio: string): Promise<{ servicios: Servicio[]; profesionales: (Profesional & { servicios: string[] })[] }> {
  const [{ data: s }, { data: p }, { data: ps }] = await Promise.all([
    db.from("servicios").select("*").eq("comercio_id", comercio).eq("activo", true).order("orden").order("nombre"),
    db.from("profesionales").select("*").eq("comercio_id", comercio).eq("activo", true).order("nombre"),
    db.from("profesional_servicios").select("profesional_id, servicio_id"),
  ]);
  const relaciones = (ps ?? []) as { profesional_id: string; servicio_id: string }[];
  return { servicios: (s ?? []) as Servicio[], profesionales: ((p ?? []) as Profesional[]).map((x) => ({ ...x, servicios: relaciones.filter((r) => r.profesional_id === x.id).map((r) => r.servicio_id) })) };
}

// --- Calendario ---
const icsFecha = (iso: string) => new Date(iso).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
const icsTexto = (t: string) => t.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
/** Archivo .ics para sumar el turno al calendario del teléfono. */
export function icsDeTurno(t: { id: string; inicio: string; fin: string; servicio: string; comercio: string; direccion?: string | null; profesional?: string }): string {
  return [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Woref//Turnos//ES", "CALSCALE:GREGORIAN", "BEGIN:VEVENT",
    `UID:${t.id}@woref`, `DTSTAMP:${icsFecha(new Date().toISOString())}`, `DTSTART:${icsFecha(t.inicio)}`, `DTEND:${icsFecha(t.fin)}`,
    `SUMMARY:${icsTexto(`${t.servicio} · ${t.comercio}`)}`, ...(t.direccion ? [`LOCATION:${icsTexto(t.direccion)}`] : []),
    ...(t.profesional ? [`DESCRIPTION:${icsTexto(`Con ${t.profesional}`)}`] : []), "END:VEVENT", "END:VCALENDAR",
  ].join("\r\n");
}
export function googleCalendarUrl(t: { inicio: string; fin: string; servicio: string; comercio: string; direccion?: string | null }): string {
  const q = new URLSearchParams({ action: "TEMPLATE", text: `${t.servicio} · ${t.comercio}`, dates: `${icsFecha(t.inicio)}/${icsFecha(t.fin)}`, ...(t.direccion ? { location: t.direccion } : {}) });
  return `https://calendar.google.com/calendar/render?${q.toString()}`;
}

/** "2026-10-06T10:30" (hora de Argentina, de un campo datetime-local) -> ISO con su desfase, para guardarlo en la base. */
export const localAIso = (valor: string) => (valor ? `${valor}:00-03:00` : "");
/** ISO -> "YYYY-MM-DDTHH:mm" en Argentina (para precargar un campo datetime-local). */
export function isoALocal(iso: string): string {
  const p = new Intl.DateTimeFormat("sv-SE", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso));
  return p.replace(" ", "T");
}

/** Primera letra en mayúscula ("viernes 9 de octubre" -> "Viernes 9 de octubre"). */
export const cap1 = (t: string) => (t ? t.charAt(0).toUpperCase() + t.slice(1) : t);

/**
 * Elimina un servicio o un profesional de la agenda, pidiendo confirmación. El servidor decide: sin turnos se borra; con turnos
 * pasados se archiva (el historial queda); con turnos por venir lo rechaza y explica por qué.
 */
export async function eliminarDeAgenda(tipo: "servicio" | "profesional", item: { id: string; nombre: string }): Promise<boolean> {
  const ok = await confirmar({
    titulo: `¿Eliminar ${tipo === "servicio" ? "el servicio" : "a"} “${item.nombre}”?`,
    descripcion: tipo === "servicio"
      ? "Deja de ofrecerse en tu página de reservas. Si ya tuvo turnos, se archiva y el historial se conserva."
      : "Deja de recibir turnos. Si ya atendió turnos, se archiva y el historial se conserva. Primero reprogramá o cancelá sus turnos por venir.",
    confirmar: "Eliminar", peligro: true,
  });
  if (!ok) return false;
  const { data, error } = await db.rpc("agenda_eliminar", { p_tipo: tipo, p_id: item.id });
  if (error) { toast.error(errorMessage(error)); return false; }
  toast.success((data as { resultado: string }).resultado === "eliminado" ? `Eliminaste “${item.nombre}”` : `Archivamos “${item.nombre}”: su historial de turnos se conserva`);
  return true;
}
