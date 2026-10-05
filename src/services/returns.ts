import { db } from "@/lib/delivery";

export type MotivoDevolucion = "danado" | "incorrecto" | "faltante" | "no_conforme" | "arrepentimiento" | "otro";
export type EstadoDevolucion = "solicitada" | "aprobada" | "rechazada" | "cancelada" | "reintegrada";
export type DestinoDevolucion = "billetera" | "medio_original";

export type ItemDevolucion = { item_id: string; nombre: string; cantidad: number; precio_unitario: number };
export type Devolucion = {
  id: string; pedido_id: string; estado: EstadoDevolucion; motivo: MotivoDevolucion; detalle: string | null; destino: DestinoDevolucion; items: ItemDevolucion[];
  monto: number; respuesta: string | null; created_at: string; reintegrado_at: string | null; comercio?: string; repuso_stock?: boolean;
};

export const MOTIVOS: { id: MotivoDevolucion; label: string }[] = [
  { id: "danado", label: "Llegó dañado" },
  { id: "incorrecto", label: "No es lo que pedí" },
  { id: "faltante", label: "Faltó un producto" },
  { id: "no_conforme", label: "No me gustó o no me sirve" },
  { id: "arrepentimiento", label: "Me arrepentí" },
  { id: "otro", label: "Otro motivo" },
];
export const ESTADO_DEVOLUCION: Record<EstadoDevolucion, { texto: string; clase: string }> = {
  solicitada: { texto: "Esperando respuesta", clase: "bg-warning/15 text-warning" },
  aprobada: { texto: "Aprobada", clase: "bg-primary/10 text-primary" },
  rechazada: { texto: "Rechazada", clase: "bg-destructive/10 text-destructive" },
  cancelada: { texto: "Cancelada", clase: "bg-muted text-muted-foreground" },
  reintegrada: { texto: "Reintegrada", clase: "bg-success/15 text-success" },
};
export const motivoLabel = (id: string) => MOTIVOS.find((m) => m.id === id)?.label ?? id;

/** Pide la devolución de productos de un pedido entregado. Las reglas (plazo, cantidades, montos) las valida el servidor. */
export async function solicitarDevolucion(input: { pedido: string; items: { item_id: string; cantidad: number }[]; motivo: MotivoDevolucion; detalle?: string; destino: DestinoDevolucion }) {
  const { data, error } = await db.rpc("devolucion_solicitar", { p_pedido: input.pedido, p_items: input.items, p_motivo: input.motivo, p_detalle: input.detalle?.trim() || null, p_destino: input.destino });
  if (error) throw error;
  return data as string;
}
export async function cancelarDevolucion(id: string) { const { error } = await db.rpc("devolucion_cancelar", { p_id: id }); if (error) throw error; }
export async function responderDevolucion(id: string, aprobar: boolean, respuesta?: string) { const { error } = await db.rpc("devolucion_responder", { p_id: id, p_aprobar: aprobar, p_respuesta: respuesta?.trim() || null }); if (error) throw error; }
export async function reintegrarDevolucion(id: string, reponerStock: boolean) { const { error } = await db.rpc("devolucion_reintegrar", { p_id: id, p_reponer_stock: reponerStock }); if (error) throw error; }
export async function fetchMisDevoluciones(): Promise<Devolucion[]> { const { data } = await db.rpc("delivery_mis_devoluciones"); return (data ?? []) as Devolucion[]; }
export async function fetchDevolucionesComercio(comercio: string): Promise<Devolucion[]> {
  const { data, error } = await db.rpc("delivery_devoluciones_comercio", { p_comercio: comercio });
  if (error) throw error;
  return (data ?? []) as Devolucion[];
}

/** Unidades de cada producto que todavía se pueden devolver (descuenta lo ya pedido en devoluciones activas). */
export function unidadesDisponibles(items: { id?: string; cantidad: number }[], devoluciones: Pick<Devolucion, "estado" | "items">[]) {
  const usadas = new Map<string, number>();
  for (const d of devoluciones) {
    if (d.estado === "rechazada" || d.estado === "cancelada") continue;
    for (const it of d.items) usadas.set(it.item_id, (usadas.get(it.item_id) ?? 0) + it.cantidad);
  }
  return new Map(items.filter((i) => i.id).map((i) => [i.id as string, Math.max(i.cantidad - (usadas.get(i.id as string) ?? 0), 0)]));
}
