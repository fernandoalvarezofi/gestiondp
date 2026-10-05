import { db } from "@/lib/delivery";
import type { TrabajoFila } from "@/services/jobs";

export type Componentes = { distancia: number; carga: number; rechazos: number; velocidad: number; ocupado: number; total: number };
export type Candidato = {
  proveedor_id: string; nombre: string; vehiculo: string | null; elegible: boolean; motivo_no: string | null; ocupado: boolean;
  distancia_km: number | null; ubicacion_hace_min: number | null; componentes: Componentes | null; puntaje: number;
};
export type ProveedorRed = {
  proveedor_id: string; nombre: string; vehiculo: string | null; activo: boolean; verificado: boolean; conectado: boolean; conductor_remis: boolean; ocupado: boolean;
  ubicacion_hace_min: number | null; completados: number; cancelados: number; ganancia: number; minutos_promedio: number | null; aceptacion_pct: number | null; soltados: number;
};
export type RedProveedores = { dias: number; resumen: { total: number; conectados: number; en_revision: number }; items: ProveedorRed[] };

export async function fetchCandidatos(tipo: TrabajoFila["origen_tipo"], id: string): Promise<Candidato[]> {
  const { data, error } = await db.rpc("despacho_candidatos", { p_origen_tipo: tipo, p_origen_id: id, p_limite: 12 });
  if (error) throw error;
  return (data ?? []) as Candidato[];
}
export async function asignarTrabajo(tipo: TrabajoFila["origen_tipo"], id: string, proveedor: string) {
  const { error } = await db.rpc("delivery_admin_asignar_trabajo", { p_origen_tipo: tipo, p_origen_id: id, p_proveedor: proveedor });
  if (error) throw error;
}
export async function fetchRed(dias: number): Promise<RedProveedores> {
  const { data, error } = await db.rpc("delivery_admin_red_proveedores", { p_dias: dias });
  if (error) throw error;
  return data as RedProveedores;
}

/** Texto corto del desglose del puntaje (menor puntaje = mejor candidato). */
export function explicarPuntaje(c: Componentes): string {
  const partes: string[] = [];
  partes.push(c.distancia >= 9999 ? "sin ubicación reciente" : `${c.distancia.toFixed(1)} km al local`);
  if (c.carga > 0) partes.push(`+${c.carga.toFixed(2)} por pedidos recientes`);
  if (c.rechazos > 0) partes.push(`+${c.rechazos.toFixed(2)} por rechazos`);
  if (c.velocidad !== 0) partes.push(`${c.velocidad > 0 ? "+" : ""}${c.velocidad.toFixed(2)} por velocidad`);
  if (c.ocupado !== 0) partes.push(`${c.ocupado.toFixed(0)} por estar en reparto`);
  return partes.join(" · ");
}
