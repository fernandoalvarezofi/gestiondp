/** Remises: viajes en auto de un punto a otro, con precio cerrado antes de pedir y conductor habilitado de Woref. */
/** Categorías de vehículo: capacidad y tarifa propias (el multiplicador lo fija administración). */
export type CategoriaViaje = "estandar" | "confort" | "familiar";
export const CATEGORIAS: { id: CategoriaViaje; label: string; capacidad: number; detalle: string }[] = [
  { id: "estandar", label: "Estándar", capacidad: 4, detalle: "Auto común, hasta 4 pasajeros" },
  { id: "confort", label: "Confort", capacidad: 4, detalle: "Auto más nuevo y espacioso, hasta 4" },
  { id: "familiar", label: "Familiar", capacidad: 6, detalle: "Auto grande o van, hasta 6" },
];
export const categoriaLabel = (id: string) => CATEGORIAS.find((c) => c.id === id)?.label ?? id;
export const capacidadDe = (id: CategoriaViaje) => CATEGORIAS.find((c) => c.id === id)?.capacidad ?? 4;

export type ViajeEstado = "buscando" | "asignado" | "en_origen" | "a_bordo" | "completado" | "cancelado";

export type Viaje = {
  id: string; cliente_id: string; estado: ViajeEstado;
  origen_direccion: string; origen_lat: number; origen_lng: number; destino_direccion: string; destino_lat: number; destino_lng: number;
  pasajeros: number; categoria?: CategoriaViaje; notas?: string | null; telefono: string; programado_para?: string | null; metodo_pago: "efectivo";
  distancia_km: number; minutos_estimados: number; tarifa: number; propina: number; total: number; comision_pct: number; ganancia_conductor: number;
  conductor_id?: string | null; asignado_at?: string | null; llego_at?: string | null; abordo_at?: string | null; completado_at?: string | null; cancelado_at?: string | null;
  motivo_cancelacion?: string | null; calificacion?: number | null; created_at: string;
};

export type ViajeOferta = {
  id: string; origen_zona: string; destino_zona: string; pasajeros: number; distancia_km: number; dist_recogida_km: number | null; ganancia: number; programado_para: string | null; created_at: string; categoria?: CategoriaViaje;
};

export type ViajeQuote = { ok: true; km: number; minutos: number; costo: number; nocturno: boolean; ganancia: number; categoria?: CategoriaViaje; capacidad?: number } | { ok: false; km?: number; motivo: string };

export const viajeActivo = (estado: ViajeEstado) => ["buscando", "asignado", "en_origen", "a_bordo"].includes(estado);

export const viajeEstadoLabel: Record<ViajeEstado, string> = {
  buscando: "Buscando conductor", asignado: "Tu remís va a buscarte", en_origen: "Tu remís llegó", a_bordo: "Viaje en curso", completado: "Viaje terminado", cancelado: "Cancelado",
};

export const viajePasos: { id: ViajeEstado; label: string }[] = [
  { id: "buscando", label: "Buscando" }, { id: "asignado", label: "En camino" }, { id: "en_origen", label: "Llegó" }, { id: "a_bordo", label: "En viaje" }, { id: "completado", label: "Llegaste" },
];

/** Hora mínima para reservar: 30 minutos desde ahora, en formato para <input type="datetime-local">. */
export function minScheduleValue(now = new Date()) {
  const date = new Date(now.getTime() + 31 * 60_000);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

/** ¿El valor de datetime-local es una reserva válida (de 30 min a 7 días)? */
export function validSchedule(value: string, now = new Date()) {
  const time = new Date(value).getTime();
  return Number.isFinite(time) && time >= now.getTime() + 30 * 60_000 && time <= now.getTime() + 7 * 86_400_000;
}
