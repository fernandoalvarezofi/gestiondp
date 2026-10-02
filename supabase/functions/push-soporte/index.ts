// Avisos del centro de soporte: ticket nuevo → equipo; mensaje → la otra parte; cierre → cliente.
// La llama el trigger delivery_notificar_soporte (pg_net) con el mismo secreto que enviar-push.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

type Message = { title: string; body: string; url: string; tag: string };
type Sends = { userIds: string[]; message: Message }[];

const tipoSoporte: Record<string, string> = {
  demora: "Demora", faltante: "Producto faltante", mal_estado: "Producto en mal estado", equivocado: "Pedido equivocado", cobro: "Problema con el cobro", repartidor: "Problema con el repartidor", otro: "Otro",
  cuenta: "Cuenta", pago: "Pagos", app: "Problema en la app", consulta: "Consulta", sugerencia: "Sugerencia",
};
const preview = (text: string) => (text.length > 110 ? `${text.slice(0, 107)}…` : text);

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: rows } = await supabase.from("app_config").select("clave, valor");
  const config = Object.fromEntries((rows || []).map((row) => [row.clave, row.valor]));
  if (!config.push_webhook_secret || req.headers.get("x-woref-secret") !== config.push_webhook_secret) return new Response("No autorizado", { status: 401 });

  const { evento, reclamo_id: ticketId, mensaje_id: messageId } = (await req.json()) as { evento: string; reclamo_id?: string; mensaje_id?: number | string };
  if (!ticketId) return new Response("Falta el ticket", { status: 400 });
  const { data: ticket } = await supabase.from("delivery_reclamos").select("id, tipo, estado, prioridad, cliente_id, asignado_a, resolucion").eq("id", ticketId).maybeSingle();
  if (!ticket) return new Response("Ticket no encontrado", { status: 404 });
  const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
  const adminIds = (admins || []).map((row) => row.user_id as string);
  const label = tipoSoporte[ticket.tipo as string] || (ticket.tipo as string);
  const sends: Sends = [];

  if (evento === "soporte_nuevo" && adminIds.length) {
    sends.push({ userIds: adminIds, message: { title: `Nuevo ticket${ticket.prioridad !== "normal" ? ` ${ticket.prioridad}` : ""} · ${label}`, body: "Entrá al centro de soporte para atenderlo.", url: "/app/admin/soporte", tag: `soporte-${ticket.id}` } });
  }
  if (evento === "soporte_mensaje" && messageId) {
    const { data: message } = await supabase.from("delivery_reclamo_mensajes").select("autor_rol, texto, interna").eq("id", messageId).maybeSingle();
    if (message && !message.interna) {
      if (message.autor_rol === "soporte") sends.push({ userIds: [ticket.cliente_id as string], message: { title: "Soporte te respondió", body: preview(String(message.texto)), url: `/app/ayuda/${ticket.id}`, tag: `soporte-${ticket.id}` } });
      if (message.autor_rol === "cliente") {
        const target = ticket.asignado_a ? [ticket.asignado_a as string] : adminIds;
        if (target.length) sends.push({ userIds: target, message: { title: `Nuevo mensaje · ${label}`, body: preview(String(message.texto)), url: "/app/admin/soporte", tag: `soporte-${ticket.id}` } });
      }
    }
  }
  if (evento === "soporte_cerrado") {
    sends.push({ userIds: [ticket.cliente_id as string], message: { title: ticket.estado === "resuelto" ? "Resolvimos tu consulta" : "Respondimos tu consulta", body: preview(ticket.resolucion ? String(ticket.resolucion) : "Mirá la respuesta en Ayuda."), url: `/app/ayuda/${ticket.id}`, tag: `soporte-${ticket.id}` } });
  }

  if (!sends.length) return Response.json({ enviados: 0 });
  webpush.setVapidDetails(config.vapid_subject, config.vapid_public_key, config.vapid_private_key);
  let sent = 0;
  const expired: string[] = [];
  for (const { userIds, message } of sends) {
    const { data: subscriptions } = await supabase.from("delivery_push_suscripciones").select("id, endpoint, p256dh, auth").in("perfil_id", userIds);
    await Promise.all((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, JSON.stringify(message), { TTL: 60 * 60, urgency: "high" });
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(subscription.id);
        else console.error("push error", status, (error as Error).message);
      }
    }));
  }
  if (expired.length) await supabase.from("delivery_push_suscripciones").delete().in("id", expired);
  return Response.json({ enviados: sent, vencidas: expired.length });
});
