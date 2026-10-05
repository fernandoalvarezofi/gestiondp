import { db } from "@/lib/delivery";

export type OpinionProducto = { id: string; puntaje: number; comentario: string | null; respuesta: string | null; respondida_at: string | null; created_at: string; autor: string };
export type ResumenOpiniones = { promedio: number | null; cantidad: number; distribucion: Record<"1" | "2" | "3" | "4" | "5", number> };
export type OpinionesDeProducto = { resumen: ResumenOpiniones; items: OpinionProducto[] };
export type ProductoSinOpinar = { item_id: string; producto_id: string; nombre: string; imagen_url: string | null; pedido_id: string; comercio: string; entregado_at: string | null };
export type OpinionComercio = { id: string; producto_id: string; producto: string; puntaje: number; comentario: string | null; respuesta: string | null; respondida_at: string | null; created_at: string; visible: boolean; autor: string; reportada: boolean };
export type OpinionReportada = { id: string; producto: string; comercio: string; puntaje: number; comentario: string | null; visible: boolean; motivo: string; reportada_at: string };

export const PAGINA_OPINIONES = 10;

export async function fetchOpiniones(producto: string, desde = 0): Promise<OpinionesDeProducto> {
  const { data, error } = await db.rpc("producto_resenas", { p_producto: producto, p_limite: PAGINA_OPINIONES, p_desde: desde });
  if (error) throw error;
  return data as OpinionesDeProducto;
}
export async function crearOpinion(item: string, puntaje: number, comentario?: string) {
  const { data, error } = await db.rpc("producto_resena_crear", { p_item: item, p_puntaje: puntaje, p_comentario: comentario?.trim() || null });
  if (error) throw error;
  return data as string;
}
export async function fetchProductosSinOpinar(pedido?: string): Promise<ProductoSinOpinar[]> {
  const { data } = await db.rpc("delivery_mis_productos_sin_opinar", { p_pedido: pedido ?? null });
  return (data ?? []) as ProductoSinOpinar[];
}
export async function fetchOpinionesComercio(comercio: string): Promise<OpinionComercio[]> {
  const { data, error } = await db.rpc("delivery_resenas_producto_comercio", { p_comercio: comercio, p_limite: 100 });
  if (error) throw error;
  return (data ?? []) as OpinionComercio[];
}
export async function responderOpinion(id: string, respuesta: string) { const { error } = await db.rpc("producto_resena_responder", { p_id: id, p_respuesta: respuesta }); if (error) throw error; }
export async function reportarOpinion(id: string, motivo: string) { const { error } = await db.rpc("producto_resena_reportar", { p_id: id, p_motivo: motivo }); if (error) throw error; }
export async function fetchOpinionesReportadas(): Promise<OpinionReportada[]> { const { data, error } = await db.rpc("delivery_admin_resenas_reportadas"); if (error) throw error; return (data ?? []) as OpinionReportada[]; }
export async function moderarOpinion(id: string, visible: boolean) { const { error } = await db.rpc("delivery_admin_resena_moderar", { p_id: id, p_visible: visible }); if (error) throw error; }

/** "4,6" en formato argentino. */
export const promedioTexto = (promedio: number | null | undefined) => (promedio == null ? "" : Number(promedio).toFixed(1).replace(".", ","));
/** Porcentaje (0–100) de la barra de cada puntaje. */
export const porcentajeBarra = (n: number, total: number) => (total > 0 ? Math.round((n / total) * 100) : 0);
