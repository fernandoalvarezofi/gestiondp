import { db } from "@/lib/delivery";

export type ConversacionCliente = { id: string; comercio: string; comercio_slug: string; logo_url: string | null; producto: string | null; ultimo_texto: string | null; ultimo_mensaje_at: string; sin_leer: boolean };
export type ConversacionLocal = { id: string; cliente: string; producto: string | null; ultimo_texto: string | null; ultimo_mensaje_at: string; sin_leer: boolean };
export type MensajeConversacion = { id: number; de_comercio: boolean; texto: string; created_at: string };

export const MAX_MENSAJE = 1000;

export async function iniciarConversacion(comercio: string, texto: string, producto?: string) {
  const { data, error } = await db.rpc("conversacion_iniciar", { p_comercio: comercio, p_texto: texto.trim(), p_producto: producto ?? null });
  if (error) throw error;
  return data as string;
}
export async function enviarMensaje(conversacion: string, texto: string) { const { error } = await db.rpc("conversacion_enviar", { p_conv: conversacion, p_texto: texto.trim() }); if (error) throw error; }
export async function marcarConversacionLeida(conversacion: string) { await db.rpc("conversacion_marcar_leida", { p_conv: conversacion }); }
export async function fetchMensajes(conversacion: string): Promise<MensajeConversacion[]> { const { data, error } = await db.rpc("conversacion_mensajes", { p_conv: conversacion }); if (error) throw error; return (data ?? []) as MensajeConversacion[]; }
export async function fetchMisConversaciones(): Promise<ConversacionCliente[]> { const { data } = await db.rpc("mis_conversaciones"); return (data ?? []) as ConversacionCliente[]; }
export async function fetchConversacionesLocal(comercio: string): Promise<ConversacionLocal[]> { const { data } = await db.rpc("conversaciones_comercio", { p_comercio: comercio }); return (data ?? []) as ConversacionLocal[]; }

/** Un mensaje se puede enviar si tiene texto y no pasa el límite. */
export const mensajeValido = (texto: string) => { const t = texto.trim(); return t.length > 0 && t.length <= MAX_MENSAJE; };
