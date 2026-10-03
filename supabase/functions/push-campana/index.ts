// Reparte una campaña: avisos push de un comercio a sus clientes o anuncios de la plataforma.
// La llama el trigger delivery_notificar_campana (pg_net) con el mismo secreto que enviar-push.
// Los destinatarios los decide la base (consentimiento, bloqueos y tope de frecuencia); acá solo se envían los avisos.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: rows } = await supabase.from("app_config").select("clave, valor");
  const config = Object.fromEntries((rows || []).map((row) => [row.clave, row.valor]));
  if (!config.push_webhook_secret || req.headers.get("x-woref-secret") !== config.push_webhook_secret) return new Response("No autorizado", { status: 401 });

  const { campana_id: campaignId } = (await req.json()) as { campana_id?: string };
  if (!campaignId) return new Response("Falta la campaña", { status: 400 });
  const { data: campaign } = await supabase.from("delivery_campanas").select("id, comercio_id, titulo, mensaje, cupon_codigo, estado").eq("id", campaignId).maybeSingle();
  if (!campaign || campaign.estado !== "enviando") return new Response("Campaña no disponible", { status: 404 });

  let url = "/app";
  if (campaign.comercio_id) {
    const { data: store } = await supabase.from("delivery_comercios").select("slug").eq("id", campaign.comercio_id).maybeSingle();
    if (store?.slug) url = `/app/tienda/${store.slug}`;
  }
  const body = campaign.cupon_codigo ? `${campaign.mensaje} Cupón: ${campaign.cupon_codigo}` : campaign.mensaje;
  const message = JSON.stringify({ title: campaign.titulo, body, url, tag: `campana-${campaign.id}` });

  const { data: recipients } = await supabase.rpc("delivery_campana_destinatarios", { p_campana: campaign.id });
  const ids = [...new Set(((recipients || []) as { perfil_id: string }[]).map((row) => row.perfil_id))];
  webpush.setVapidDetails(config.vapid_subject, config.vapid_public_key, config.vapid_private_key);

  const reached: string[] = [];
  const expired: string[] = [];
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    const { data: subscriptions } = await supabase.from("delivery_push_suscripciones").select("id, perfil_id, endpoint, p256dh, auth").in("perfil_id", batch);
    await Promise.all((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } }, message, { TTL: 6 * 60 * 60, urgency: "normal" });
        reached.push(subscription.perfil_id as string);
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) expired.push(subscription.id as string);
        else console.error("push error", status, (error as Error).message);
      }
    }));
  }
  if (expired.length) await supabase.from("delivery_push_suscripciones").delete().in("id", expired);
  const uniqueReached = [...new Set(reached)];
  await supabase.rpc("delivery_campana_cerrar", { p_campana: campaign.id, p_enviados: uniqueReached.length, p_ids: uniqueReached });
  return Response.json({ destinatarios: ids.length, enviados: uniqueReached.length });
});
