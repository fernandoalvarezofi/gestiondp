import { db } from "@/lib/delivery";

export type Goal = { id: string; nombre: string; periodo: "dia" | "semana"; objetivo: number; bono: number; hora_desde: string | null; hora_hasta: string | null; termina: string; viajes: number; lograda: boolean };
export type Shift = { id: string; fecha: string; desde: string; hasta: string; nota: string | null; cupos: number; ocupados: number; mio: boolean; inicio: string };
export type ShiftsData = { ausencias: number; max_ausencias: number; cancelar_horas: number; turnos: Shift[] };

export async function loadGoals(): Promise<Goal[]> {
  const { data } = await db.rpc("delivery_mis_metas");
  return ((data || []) as Goal[]).map((goal) => ({ ...goal, bono: Number(goal.bono) }));
}

export async function loadShifts(): Promise<ShiftsData | null> {
  const { data, error } = await db.rpc("delivery_mis_turnos");
  return error || !data ? null : (data as ShiftsData);
}

/** Avance de una meta en porcentaje (tope 100). */
export const goalPercent = (viajes: number, objetivo: number) => Math.min(100, Math.round((viajes / Math.max(objetivo, 1)) * 100));

/** "Hoy", "Mañana" o el día de la semana con fecha, para un turno (la fecha viene como AAAA-MM-DD en hora de Argentina). */
export function shiftDayLabel(fecha: string, today = new Date()) {
  const todayKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(today);
  const tomorrowKey = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(today.getTime() + 86_400_000));
  if (fecha === todayKey) return "Hoy";
  if (fecha === tomorrowKey) return "Mañana";
  const label = new Date(`${fecha}T12:00:00`).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "short" });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

/** Descripción corta de la franja de una meta: "de 20:00 a 23:00" o "todo el día". */
export const goalWindow = (goal: Pick<Goal, "hora_desde" | "hora_hasta">) => (goal.hora_desde && goal.hora_hasta ? `de ${goal.hora_desde} a ${goal.hora_hasta}` : "todo el día");
