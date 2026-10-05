import { db } from "@/lib/delivery";

export const TZ = "America/Argentina/Buenos_Aires";
export type Modalidad = "en_local" | "a_domicilio" | "online";
export const MODALIDAD: Record<Modalidad, string> = { en_local: "En el local", a_domicilio: "A domicilio", online: "Online" };
export type EstadoTurno = "confirmado" | "completado" | "cancelado" | "ausente";
export const ESTADO_TURNO: Record<EstadoTurno, { texto: string; clase: string }> = {
  confirmado: { texto: "Confirmado", clase: "bg-primary/10 text-primary" },
  completado: { texto: "Realizado", clase: "bg-success/15 text-success" },
  cancelado: { texto: "Cancelado", clase: "bg-muted text-muted-foreground" },
  ausente: { texto: "No vino", clase: "bg-destructive/10 text-destructive" },
};
export const DIAS = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"] as const;

export type Servicio = {
  id: string; comercio_id: string; nombre: string; descripcion: string | null; duracion_min: number; precio: number; modalidad: Modalidad; categoria_id: string | null; imagen_url: string | null;
  anticipacion_horas: number; cancelar_hasta_horas: number; orden: number; activo: boolean;
};
export type Profesional = { id: string; comercio_id: string; nombre: string; bio: string | null; avatar_url: string | null; activo: boolean; usuario_id?: string | null };
export type Tramo = { id?: string; dia_semana: number; desde: string; hasta: string };
export type Bloqueo = { id: string; profesional_id: string; desde: string; hasta: string; motivo: string | null };
export type HorarioLibre = { inicio: string; profesional_id: string };
export type DiaLibre = { fecha: string; horarios: HorarioLibre[] };
export type Turno = {
  id: string; inicio: string; fin: string; estado: EstadoTurno; precio: number; notas: string | null; servicio: string; duracion_min: number; modalidad: Modalidad; profesional: string;
  comercio: string; comercio_slug: string; direccion: string | null; cancelar_hasta: string; puede_cancelar: boolean; cancelado_por: "cliente" | "comercio" | null;
};
export type TurnoAgenda = { id: string; inicio: string; fin: string; estado: EstadoTurno; precio: number; notas: string | null; telefono: string | null; servicio: string; profesional_id: string; profesional: string; cliente: string; puede_cerrar: boolean };

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
export async function reservarTurno(input: { servicio: string; inicio: string; profesional?: string | null; telefono?: string; notas?: string }) {
  const { data, error } = await db.rpc("turno_reservar", { p_servicio: input.servicio, p_inicio: input.inicio, p_profesional: input.profesional ?? null, p_telefono: input.telefono?.trim() || null, p_notas: input.notas?.trim() || null });
  if (error) throw error;
  return data as string;
}
export async function cancelarTurno(id: string, motivo?: string) { const { error } = await db.rpc("turno_cancelar", { p_id: id, p_motivo: motivo?.trim() || null }); if (error) throw error; }
export async function cerrarTurno(id: string, estado: "completado" | "ausente") { const { error } = await db.rpc("turno_cerrar", { p_id: id, p_estado: estado }); if (error) throw error; }
export async function fetchMisTurnos(): Promise<Turno[]> { const { data } = await db.rpc("mis_turnos"); return (data ?? []) as Turno[]; }
export async function fetchAgenda(comercio: string, desde: string, hasta: string, profesional?: string | null): Promise<TurnoAgenda[]> {
  const { data, error } = await db.rpc("delivery_turnos_agenda", { p_comercio: comercio, p_desde: desde, p_hasta: hasta, p_profesional: profesional ?? null });
  if (error) throw error;
  return (data ?? []) as TurnoAgenda[];
}
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
