import { db } from "@/lib/delivery";

export type TipoTrabajo = "delivery" | "envio" | "viaje" | "retiro" | "servicio" | "otro";
export type EstadoTrabajo = "pendiente" | "asignado" | "en_curso" | "completado" | "cancelado";

export const TIPO_TRABAJO: Record<TipoTrabajo, string> = { delivery: "Entrega de pedido", envio: "Mensajería", viaje: "Viaje", retiro: "Retiro", servicio: "Servicio", otro: "Otro" };
export const ESTADO_TRABAJO: Record<EstadoTrabajo, { texto: string; clase: string }> = {
  pendiente: { texto: "Sin asignar", clase: "bg-warning/15 text-warning" },
  asignado: { texto: "Asignado", clase: "bg-primary/10 text-primary" },
  en_curso: { texto: "En curso", clase: "bg-primary text-primary-foreground" },
  completado: { texto: "Completado", clase: "bg-success/15 text-success" },
  cancelado: { texto: "Cancelado", clase: "bg-muted text-muted-foreground" },
};
export const ESTADOS_ORDEN: EstadoTrabajo[] = ["pendiente", "asignado", "en_curso", "completado", "cancelado"];

export type TrabajoFila = { id: string; origen_tipo: "pedido" | "envio" | "viaje"; origen_id: string; tipo: TipoTrabajo; estado: EstadoTrabajo; estado_origen: string; proveedor: string | null; recogida: string | null; entrega: string | null; distancia_km: number | null; monto: number | null; creado: string; minutos_sin_asignar: number | null };
export type TableroTrabajos = { por_estado: Partial<Record<EstadoTrabajo, number>>; por_tipo: Partial<Record<TipoTrabajo, number>>; items: TrabajoFila[] };
export type Seguimiento = {
  tipo: TipoTrabajo; estado: EstadoTrabajo; estado_origen: string; creado: string; actualizado: string;
  recogida: { direccion: string | null; lat: number | null; lng: number | null }; entrega: { direccion: string | null; lat: number | null; lng: number | null };
  proveedor: { nombre: string | null; vehiculo: string | null } | null; ubicacion: { lat: number; lng: number; hace_seg: number } | null; eta_min: number | null;
  eventos: { estado: EstadoTrabajo; desde: EstadoTrabajo | null; cuando: string }[];
};

/** Minutos sin asignar a partir de los cuales un trabajo se marca como atrasado. */
export const UMBRAL_SIN_ASIGNAR_MIN = 10;
export const estaAtrasado = (t: Pick<TrabajoFila, "estado" | "minutos_sin_asignar">) => t.estado === "pendiente" && (t.minutos_sin_asignar ?? 0) >= UMBRAL_SIN_ASIGNAR_MIN;

export async function fetchTablero(estado: EstadoTrabajo | null, tipo: TipoTrabajo | null): Promise<TableroTrabajos> {
  const { data, error } = await db.rpc("delivery_admin_trabajos", { p_estado: estado, p_tipo: tipo, p_limite: 150 });
  if (error) throw error;
  return data as TableroTrabajos;
}
export async function fetchSeguimiento(origenTipo: TrabajoFila["origen_tipo"], origenId: string): Promise<Seguimiento> {
  const { data, error } = await db.rpc("trabajo_seguimiento", { p_origen_tipo: origenTipo, p_origen_id: origenId });
  if (error) throw error;
  return data as Seguimiento;
}
