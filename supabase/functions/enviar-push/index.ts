// Envía notificaciones push cuando entra un pedido, cambia de estado o lo toma un repartidor.
// La llama el trigger delivery_pedidos_notificar (pg_net) con un secreto compartido guardado en app_config.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

type Payload = { pedido_id: string; evento: "nuevo" | "estado" | "asignado"; estado_anterior?: string | null };
type Message = { title: string; body: string; url: string; tag: string };

const estadoCliente: Record<string, Omit<Message, "url" | "tag"> | undefined> = {
  confirmado: { title: "¡Tu pedido fue aceptado!", body: "El comercio ya lo está organizando." },
  preparando: { title: "Están preparando tu pedido", body: "En breve sale para tu casa." },
  en_camino: { title: "Tu pedido va en camino 🛵", body: "Tené a mano el código de entrega." },
  entregado: { title: "¡Pedido entregado!", body: "Que lo disfrutes. Contanos qué tal estuvo." },
  cancelado: { title: "Tu pedido fue cancelado", body: "No se te cobró nada." },
};

const money = (value: number) => new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 }).format(value);
const shortId = (id: string) => `#${id.slice(0, 6).toUpperCase()}`;

Deno.serve(async (req) => {
  if (req.method !== "POST") return new Response("Método no permitido", { status: 405 });

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: rows } = await supabase.from("app_config").select("clave, valor");
  const config = Object.fromEntries((rows || []).map((row) => [row.clave, row.valor]));

  if (!config.push_webhook_secret || req.headers.get("x-woref-secret") !== config.push_webhook_secret) {
    return new Response("No autorizado", { status: 401 });
  }

  const { pedido_id, evento, estado_anterior } = (await req.json()) as Payload;
  const { data: order } = await supabase
    .from("delivery_pedidos")
    .select("id, estado, total, cliente_id, repartidor_id, motivo_cancelacion, comercio:delivery_comercios(nombre, propietario_id), items:delivery_pedido_items(cantidad)")
    .eq("id", pedido_id)
    .maybeSingle();
  if (!order) return new Response("Pedido no encontrado", { status: 404 });

  const store = order.comercio as unknown as { nombre: string; propietario_id: string | null } | null;
  const units = ((order.items as { cantidad: number }[]) || []).reduce((total, item) => total + item.cantidad, 0);
  const sends: { userIds: string[]; message: Message }[] = [];

  if (evento === "nuevo" && store?.propietario_id) {
    sends.push({
      userIds: [store.propietario_id],
      message: { title: `🔔 Nuevo pedido ${shortId(order.id)}`, body: `${units} ${units === 1 ? "producto" : "productos"} · ${money(Number(order.total))}. Aceptalo desde tu panel.`, url: "/app/comercio", tag: `pedido-${order.id}` },
    });
  }

  if (evento === "estado") {
    const copy = estadoCliente[order.estado];
    if (copy) sends.push({ userIds: [order.cliente_id], message: { ...copy, body: order.estado === "cancelado" && order.motivo_cancelacion ? order.motivo_cancelacion : copy.body, url: `/app/pedidos/${order.id}`, tag: `pedido-${order.id}` } });

    // Si lo canceló el cliente, también se entera el comercio.
    if (order.estado === "cancelado" && estado_anterior === "pendiente" && store?.propietario_id && order.motivo_cancelacion === "Cancelado por el cliente") {
      sends.push({ userIds: [store.propietario_id], message: { title: `Pedido ${shortId(order.id)} cancelado`, body: "El cliente canceló el pedido antes de que lo aceptaras.", url: "/app/comercio", tag: `pedido-${order.id}` } });
    }

    // Pedido recién aceptado y sin repartidor: avisamos a los repartidores conectados.
    if (order.estado === "confirmado" && !order.repartidor_id) {
      const { data: couriers } = await supabase.from("delivery_repartidores").select("perfil_id").eq("disponible", true).eq("activo", true);
      const ids = (couriers || []).map((courier) => courier.perfil_id).filter((id) => id !== store?.propietario_id);
      if (ids.length) sends.push({ userIds: ids, message: { title: "Pedido disponible para retirar", body: `${store?.nombre || "Un comercio"} tiene un pedido listo para tomar.`, url: "/app/repartidor", tag: "pedidos-disponibles" } });
    }
  }

  if (evento === "asignado") {
    sends.push({ userIds: [order.cliente_id], message: { title: "Un repartidor tomó tu pedido", body: "Ya podés seguirlo en el mapa.", url: `/app/pedidos/${order.id}`, tag: `pedido-${order.id}` } });
  }

  if (!sends.length) return Response.json({ enviados: 0 });

  webpush.setVapidDetails(config.vapid_subject, config.vapid_public_key, config.vapid_private_key);
  let sent = 0;
  const expired: string[] = [];

  for (const { userIds, message } of sends) {
    const { data: subscriptions } = await supabase.from("delivery_push_suscripciones").select("id, endpoint, p256dh, auth").in("perfil_id", userIds);
    await Promise.all((subscriptions || []).map(async (subscription) => {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify(message),
          { TTL: 60 * 60, urgency: "high" },
        );
        sent += 1;
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        // 404/410: el navegador dio de baja la suscripción; la borramos.
        if (status === 404 || status === 410) expired.push(subscription.id);
        else console.error("push error", status, (error as Error).message);
      }
    }));
  }

  if (expired.length) await supabase.from("delivery_push_suscripciones").delete().in("id", expired);
  return Response.json({ enviados: sent, vencidas: expired.length });
});
