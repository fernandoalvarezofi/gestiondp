// Push genérico para la bandeja de notificaciones: la llama notificar() (pg_net) con el secreto compartido de app_config.
// Lee la notificación por id (nunca recibe el texto por la red) y la manda a los dispositivos de esa persona.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const UUID_OR_INT = /^\d{1,18}$/;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: rows } = await supabase.from("app_config").select("clave, valor");
  const config = Object.fromEntries((rows || []).map((row) => [row.clave, row.valor]));
  if (!config.push_webhook_secret || req.headers.get("x-woref-secret") !== config.push_webhook_secret) return new Response("No autorizado", { status: 401 });

  const body = await req.json().catch(() => null) as { id?: number | string } | null;
  const id = String(body?.id ?? "");
  if (!UUID_OR_INT.test(id)) return new Response("Solicitud inválida", { status: 400 });

  const { data: notif } = await supabase.from("notificaciones").select("id, usuario_id, categoria, titulo, cuerpo, url").eq("id", id).maybeSingle();
  if (!notif) return new Response("No encontrada", { status: 404 });

  // La preferencia se vuelve a verificar acá por si cambió entre el aviso y el envío.
  const { data: pref } = await supabase.from("notificaciones_preferencias").select("push").eq("usuario_id", notif.usuario_id).eq("categoria", notif.categoria).maybeSingle();
  if (pref && pref.push === false) return Response.json({ enviados: 0, silenciada: true });

  const { data: subs } = await supabase.from("delivery_push_suscripciones").select("id, endpoint, p256dh, auth").eq("perfil_id", notif.usuario_id);
  if (!subs?.length) return Response.json({ enviados: 0 });

  webpush.setVapidDetails(config.vapid_subject, config.vapid_public_key, config.vapid_private_key);
  const message = JSON.stringify({ title: notif.titulo, body: notif.cuerpo || "", url: notif.url || "/app/notificaciones", tag: `notif-${notif.id}` });
  let sent = 0;
  const expired: string[] = [];
  await Promise.all(subs.map(async (sub) => {
    try {
      await webpush.sendNotification({ endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } }, message, { TTL: 60 * 60 * 6, urgency: "normal" });
      sent += 1;
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) expired.push(sub.id as string);
      else console.error("push error", status, (error as Error).message);
    }
  }));
  if (expired.length) await supabase.from("delivery_push_suscripciones").delete().in("id", expired);
  return Response.json({ enviados: sent, vencidas: expired.length });
});
