import { db } from "@/lib/delivery";

export type CampaignSegment = "todos_clientes" | "recientes" | "inactivos" | "nuevos";
export type Campaign = { id: string; comercio_id: string | null; segmento: string; titulo: string; mensaje: string; cupon_codigo: string | null; estado: "enviando" | "enviada" | "fallida"; destinatarios: number; enviados: number; created_at: string };
export type CampaignCounts = Record<CampaignSegment, number> & { proxima_campana: string | null };

export const segments: { id: CampaignSegment; label: string; hint: string }[] = [
  { id: "recientes", label: "Pidieron hace poco", hint: "Clientes con un pedido entregado en los últimos 30 días." },
  { id: "inactivos", label: "Hace tiempo que no piden", hint: "Clientes cuyo último pedido fue hace más de 30 días: ideal para reactivar." },
  { id: "nuevos", label: "Clientes de una sola compra", hint: "Pidieron una vez: invitalos a volver." },
  { id: "todos_clientes", label: "Todos mis clientes", hint: "Todos los que alguna vez te compraron." },
];

export const platformSegmentLabel: Record<string, string> = { todos: "Todos los usuarios", repartidores: "Repartidores y conductores", comercios: "Comercios" };
export const segmentLabel = (id: string) => segments.find((item) => item.id === id)?.label ?? platformSegmentLabel[id] ?? id;

const LINK = /(https?:\/\/|www\.|\.com\b|\.ar\b|bit\.ly|wa\.me|t\.me)/i;

/** Mismas reglas que la base: título de 3 a 50, mensaje de 5 a 140 y sin enlaces. */
export function validateCampaign(title: string, message: string): string | null {
  const t = title.trim().replace(/\s+/g, " ");
  const m = message.trim().replace(/\s+/g, " ");
  if (t.length < 3 || t.length > 50) return "El título tiene entre 3 y 50 caracteres";
  if (m.length < 5 || m.length > 140) return "El mensaje tiene entre 5 y 140 caracteres";
  if (LINK.test(t) || LINK.test(m)) return "Por seguridad no se pueden enviar enlaces ni sitios web";
  return null;
}

export async function loadCampaignCounts(storeId: string): Promise<CampaignCounts | null> {
  const { data, error } = await db.rpc("delivery_campana_conteo", { p_comercio: storeId });
  return error || !data ? null : (data as CampaignCounts);
}
