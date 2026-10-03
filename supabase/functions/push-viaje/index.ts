// Avisos de remises: viaje nuevo → conductores habilitados y libres; cambios de estado → pasajero (y conductor si cancelan).
// La llama el trigger delivery_notificar_viaje (pg_net) con el mismo secreto que enviar-push.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

type Message = { title: string; body: string; url: string; tag: string };
type Sends = { userIds: string[]; message: Message }[];

const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);

const viajeCliente: Record<string, { title: string; body: string } | undefined> = {
  asignado: { title: "¡Tu remís está en camino! 🚗", body: "Ya hay un conductor yendo a buscarte." },
  en_origen: { title: "Tu remís llegó", body: "Salí: te está esperando. Tené a mano el código del viaje." },
  a_bordo: { title: "Viaje en curso", body: "¡Buen viaje!" },
  completado: { title: "Llegaste a destino", body: "Contanos qué tal estuvo el viaje." },
  cancelado: { title: "Tu viaje fue cancelado", body: "No se te cobró nada." },
};

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: rows } = await supabase.from("app_config").select("clave, valor");
  const config = Object.fromEntries((rows || []).map((row) => [row.clave, row.valor]));
  if (!config.push_webhook_secret || req.headers.get("x-woref-secret") !== config.push_webhook_secret) return new Response("No autorizado", { status: 401 });

  const { viaje_id: viajeId, evento, estado_anterior: estadoAnterior } = (await req.json()) as { viaje_id?: string; evento?: string; estado_anterior?: string | null };
  if (!viajeId) return new Response("Falta el viaje", { status: 400 });
  const { data: viaje } = await supabase.from("delivery_viajes").select("id, estado, cliente_id, conductor_id, ganancia_conductor, distancia_km, motivo_cancelacion").eq("id", viajeId).maybeSingle();
  if (!viaje) return new Response("Viaje no encontrado", { status: 404 });
  const sends: Sends = [];

  if (evento === "viaje_nuevo" && viaje.estado === "buscando") {
    const { data: drivers } = await supabase.from("delivery_repartidores").select("perfil_id").eq("activo", true).eq("verificado", true).eq("disponible", true).eq("acepta_remis", true).eq("remis_estado", "aprobado").is("control_estado", null).limit(100);
    const free: string[] = [];
    for (const driver of drivers || []) {
      const { data: busy } = await supabase.rpc("delivery_repartidor_ocupado", { p_repartidor: driver.perfil_id });
      if (!busy) free.push(driver.perfil_id as string);
    }
    if (free.length) sends.push({ userIds: free, message: { title: "Nuevo viaje de remís 🚗", body: `${money(Number(viaje.ganancia_conductor))} de ganancia · ${Number(viaje.distancia_km).toFixed(1)} km. El primero que lo acepta se lo queda.`, url: "/app/repartidor", tag: `viaje-${viaje.id}` } });
  }

  if (evento === "viaje_estado") {
    const copy = viajeCliente[viaje.estado as string];
    if (copy) sends.push({ userIds: [viaje.cliente_id as string], message: { ...copy, body: viaje.estado === "cancelado" && viaje.motivo_cancelacion ? (viaje.motivo_cancelacion as string) : copy.body, url: `/app/remis/${viaje.id}`, tag: `viaje-${viaje.id}` } });
    if (viaje.estado === "cancelado" && (estadoAnterior === "asignado" || estadoAnterior === "en_origen") && viaje.conductor_id) {
      sends.push({ userIds: [viaje.conductor_id as string], message: { title: "Viaje cancelado", body: "El pasajero canceló el viaje.", url: "/app/repartidor", tag: `viaje-${viaje.id}` } });
    }
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
