// Envía notificaciones push cuando entra un pedido, cambia de estado o lo toma un repartidor.
// La llama el trigger delivery_pedidos_notificar (pg_net) con un secreto compartido guardado en app_config.
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

type Payload = { pedido_id?: string; envio_id?: string; evento: "nuevo" | "estado" | "asignado" | "liberado" | "llegada" | "demora" | "mensaje" | "reclamo_nuevo" | "reclamo_resuelto" | "envio_nuevo" | "envio_estado" | "ajuste_nuevo" | "ajuste_respuesta"; estado_anterior?: string | null; mensaje_id?: string; reclamo_id?: string; ajuste_id?: string };

const tipoReclamo: Record<string, string> = { demora: "Demora", faltante: "Producto faltante", mal_estado: "Producto en mal estado", equivocado: "Pedido equivocado", cobro: "Problema con el cobro", repartidor: "Problema con el repartidor", otro: "Otro" };
type Message = { title: string; body: string; url: string; tag: string };

const estadoCliente: Record<string, Omit<Message, "url" | "tag"> | undefined> = {
  confirmado: { title: "¡Tu pedido fue aceptado!", body: "El comercio ya lo está organizando." },
  preparando: { title: "Están preparando tu pedido", body: "En breve sale para tu casa." },
  listo: { title: "¡Tu pedido está listo para retirar!", body: "Pasá por el local con tu código de retiro." },
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

  const { pedido_id, envio_id, evento, estado_anterior, mensaje_id, reclamo_id, ajuste_id } = (await req.json()) as Payload;
  if (envio_id) return await handleEnvio(supabase, config, envio_id, evento, estado_anterior);
  const { data: order } = await supabase
    .from("delivery_pedidos")
    .select("id, comercio_id, asignado_por, estado, total, cliente_id, repartidor_id, motivo_cancelacion, tipo_entrega, programado_para, entrega_estimada, demora_extra_min, comercio:delivery_comercios(nombre, propietario_id), items:delivery_pedido_items(cantidad)")
    .eq("id", pedido_id)
    .maybeSingle();
  if (!order) return new Response("Pedido no encontrado", { status: 404 });

  const store = order.comercio as unknown as { nombre: string; propietario_id: string | null } | null;
  const units = ((order.items as { cantidad: number }[]) || []).reduce((total, item) => total + item.cantidad, 0);
  const sends: { userIds: string[]; message: Message }[] = [];

  // El aviso del local le llega al dueño y a todo el equipo activo (todos los roles reciben pedidos).
  const { data: team } = await supabase.from("delivery_comercio_equipo").select("user_id").eq("comercio_id", order.comercio_id as string).eq("estado", "activo");
  const staff = [...new Set([store?.propietario_id, ...(team || []).map((row) => row.user_id as string | null)].filter((id): id is string => Boolean(id)))];

  if (evento === "nuevo" && staff.length) {
    sends.push({
      userIds: staff,
      message: { title: `🔔 Nuevo pedido ${shortId(order.id)}`, body: `${units} ${units === 1 ? "producto" : "productos"} · ${money(Number(order.total))}. Aceptalo desde tu panel.`, url: "/app/comercio", tag: `pedido-${order.id}` },
    });
  }

  // Oferta de reparto para el repartidor mejor ubicado (el servidor decide quién; los demás la ven si no responde).
  async function offerToCourier() {
    const { data: candidate } = await supabase.rpc("delivery_candidato_oferta", { p_pedido: order!.id });
    if (candidate) sends.push({ userIds: [candidate as string], message: { title: "Nueva oferta de reparto 🛵", body: `${store?.nombre || "Un comercio"} · tenés 45 segundos para aceptar.`, url: "/app/repartidor", tag: "oferta-reparto" } });
  }

  if (evento === "liberado" && order.estado !== "cancelado" && order.tipo_entrega === "delivery") await offerToCourier();

  if (evento === "llegada") {
    sends.push({ userIds: [order.cliente_id], message: { title: "¡Tu repartidor llegó! 🛵", body: "Salí a recibir tu pedido y tené a mano el código de entrega.", url: `/app/pedidos/${order.id}`, tag: `pedido-${order.id}` } });
  }

  if (evento === "estado") {
    const copy = order.tipo_entrega === "retiro" && order.estado === "preparando"
      ? { title: "Están preparando tu pedido", body: "Te avisamos apenas esté listo para retirar." }
      : order.tipo_entrega === "retiro" && order.estado === "entregado"
        ? { title: "¡Pedido retirado!", body: "Que lo disfrutes. Contanos qué tal estuvo." }
        : estadoCliente[order.estado];
    if (copy) sends.push({ userIds: [order.cliente_id], message: { ...copy, body: order.estado === "cancelado" && order.motivo_cancelacion ? order.motivo_cancelacion : copy.body, url: `/app/pedidos/${order.id}`, tag: `pedido-${order.id}` } });

    // Si lo canceló el cliente, también se entera el comercio.
    if (order.estado === "cancelado" && estado_anterior === "pendiente" && staff.length && order.motivo_cancelacion === "Cancelado por el cliente") {
      sends.push({ userIds: staff, message: { title: `Pedido ${shortId(order.id)} cancelado`, body: "El cliente canceló el pedido antes de que lo aceptaras.", url: "/app/comercio", tag: `pedido-${order.id}` } });
    }

    // Pedido recién aceptado y sin repartidor: la oferta va primero al repartidor libre más cercano al comercio.
    // (los retiros no usan repartidor y los programados se avisan recién cuando se acerca la hora)
    const soon = !order.programado_para || new Date(order.programado_para as string).getTime() <= Date.now() + 50 * 60 * 1000;
    if (order.estado === "confirmado" && !order.repartidor_id && order.tipo_entrega === "delivery" && soon) await offerToCourier();
  }

  if (evento === "mensaje" && mensaje_id) {
    const { data: msg } = await supabase.from("delivery_mensajes").select("autor_id, canal, texto").eq("id", mensaje_id).maybeSingle();
    if (msg) {
      const { data: author } = await supabase.from("perfiles").select("nombre").eq("id", msg.autor_id).maybeSingle();
      const first = (author?.nombre as string | undefined)?.split(" ")[0] || "Alguien";
      const preview = msg.texto.length > 110 ? `${msg.texto.slice(0, 107)}…` : msg.texto;
      if (msg.autor_id === order.cliente_id) {
        // Escribió el cliente: le avisamos al comercio o al repartidor según el canal.
        const target = msg.canal === "comercio" ? staff : order.repartidor_id ? [order.repartidor_id as string] : [];
        if (target.length) sends.push({ userIds: target, message: { title: `💬 ${first} · pedido ${shortId(order.id)}`, body: preview, url: msg.canal === "comercio" ? "/app/comercio" : "/app/repartidor", tag: `chat-${order.id}-${msg.canal}` } });
      } else {
        const from = msg.canal === "comercio" ? store?.nombre || "El comercio" : "Tu repartidor";
        sends.push({ userIds: [order.cliente_id], message: { title: `💬 ${from}`, body: preview, url: `/app/pedidos/${order.id}?chat=${msg.canal}`, tag: `chat-${order.id}-${msg.canal}` } });
      }
    }
  }

  if ((evento === "reclamo_nuevo" || evento === "reclamo_resuelto") && reclamo_id) {
    const { data: claim } = await supabase.from("delivery_reclamos").select("tipo, estado, resolucion, cliente_id").eq("id", reclamo_id).maybeSingle();
    if (claim && evento === "reclamo_nuevo") {
      const { data: admins } = await supabase.from("user_roles").select("user_id").eq("role", "admin");
      const ids = (admins || []).map((row) => row.user_id as string);
      if (ids.length) sends.push({ userIds: ids, message: { title: `Nuevo reclamo · ${tipoReclamo[claim.tipo] || claim.tipo}`, body: `Pedido ${shortId(order.id)} de ${store?.nombre || "un comercio"}.`, url: "/app/admin", tag: `reclamo-${reclamo_id}` } });
    }
    if (claim && evento === "reclamo_resuelto") {
      const text = claim.resolucion ? String(claim.resolucion) : "Revisá la respuesta en tu pedido.";
      sends.push({ userIds: [claim.cliente_id as string], message: { title: claim.estado === "resuelto" ? "Resolvimos tu reclamo" : "Respondimos tu reclamo", body: text.length > 110 ? `${text.slice(0, 107)}…` : text, url: `/app/pedidos/${order.id}`, tag: `reclamo-${reclamo_id}` } });
    }
  }

  if (evento === "demora") {
    const hora = order.entrega_estimada
      ? new Date(order.entrega_estimada as string).toLocaleTimeString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", hour: "2-digit", minute: "2-digit", hour12: false })
      : null;
    sends.push({ userIds: [order.cliente_id], message: { title: "Tu pedido se demora un poco más", body: `${store?.nombre || "El comercio"} te avisa una demora${hora ? `. Nueva hora estimada: ${hora}` : ""}.`, url: `/app/pedidos/${order.id}`, tag: `pedido-${order.id}` } });
  }

  if (evento === "asignado") {
    sends.push({ userIds: [order.cliente_id], message: { title: "Un repartidor tomó tu pedido", body: "Ya podés seguirlo en el mapa.", url: `/app/pedidos/${order.id}`, tag: `pedido-${order.id}` } });
    // Si lo asignó administración, el repartidor no lo aceptó él mismo: hay que avisarle.
    if (order.asignado_por && order.repartidor_id) {
      sends.push({ userIds: [order.repartidor_id as string], message: { title: "Te asignaron un pedido 🛵", body: `${store?.nombre || "Un comercio"}: andá a retirarlo. Lo ves en tu panel.`, url: "/app/repartidor", tag: `asignacion-${order.id}` } });
    }
  }

  // Falta de stock: el comercio propone un cambio y el cliente responde.
  if ((evento === "ajuste_nuevo" || evento === "ajuste_respuesta") && ajuste_id) {
    const { data: aj } = await supabase.from("delivery_pedido_ajustes").select("tipo, item_nombre, reemplazo_nombre, estado").eq("id", ajuste_id).maybeSingle();
    if (aj && evento === "ajuste_nuevo") {
      const body = aj.tipo === "reemplazo"
        ? `${aj.item_nombre} no está disponible. ${store?.nombre || "El comercio"} te ofrece ${aj.reemplazo_nombre}. Tenés 10 minutos para responder.`
        : `${aj.item_nombre} no está disponible. Confirmá si seguís sin ese producto (10 minutos).`;
      sends.push({ userIds: [order.cliente_id], message: { title: "Falta un producto de tu pedido", body, url: `/app/pedidos/${order.id}`, tag: `pedido-${order.id}` } });
    }
    if (aj && evento === "ajuste_respuesta" && staff.length) {
      sends.push({ userIds: staff, message: { title: `Pedido ${shortId(order.id)}: el cliente respondió`, body: aj.estado === "aceptado" ? "Aceptó el cambio." : "No aceptó el cambio.", url: "/app/comercio", tag: `pedido-${order.id}` } });
    }
  }

  return await dispatch(supabase, config, sends);
});

type Sends = { userIds: string[]; message: Message }[];

async function dispatch(supabase: ReturnType<typeof createClient>, config: Record<string, string>, sends: Sends) {
  if (!sends.length) return Response.json({ enviados: 0 });

  webpush.setVapidDetails(config.vapid_subject, config.vapid_public_key, config.vapid_private_key);
  let sent = 0;
  const expired: string[] = [];

  for (const { userIds: allUserIds, message } of sends) {
    // Quien silenció los mensajes de chat en su cuenta no los recibe (los avisos de estado siempre se envían).
    let userIds = allUserIds;
    if (message.tag.startsWith("chat-")) {
      const { data: muted } = await supabase.from("delivery_preferencias").select("perfil_id").in("perfil_id", allUserIds).eq("push_mensajes", false);
      const off = new Set((muted || []).map((row) => row.perfil_id as string));
      userIds = allUserIds.filter((id) => !off.has(id));
      if (!userIds.length) continue;
    }
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
}

const envioCliente: Record<string, { title: string; body: string } | undefined> = {
  asignado: { title: "Un repartidor tomó tu envío", body: "Ya va camino a retirar el paquete." },
  retirado: { title: "Tu paquete va en camino 📦", body: "Tené a mano el código de entrega para el destinatario." },
  entregado: { title: "¡Paquete entregado!", body: "Tu envío llegó a destino." },
  cancelado: { title: "Tu envío fue cancelado", body: "No se te cobró nada." },
};

/** Avisos de la mensajería: ofertas a repartidores libres y estados al cliente. */
async function handleEnvio(supabase: ReturnType<typeof createClient>, config: Record<string, string>, envioId: string, evento: string, estadoAnterior?: string | null) {
  const { data: envio } = await supabase.from("delivery_envios").select("id, estado, cliente_id, repartidor_id, ganancia_repartidor, distancia_km, motivo_cancelacion, tamano").eq("id", envioId).maybeSingle();
  if (!envio) return new Response("Envío no encontrado", { status: 404 });
  const sends: Sends = [];

  if (evento === "envio_nuevo" && envio.estado === "buscando") {
    // Solo quien trabaja en modo entregas (panel de repartidor); los conectados como conductor no reciben envíos.
    const { data: couriers } = await supabase.from("delivery_repartidores").select("perfil_id").eq("activo", true).eq("verificado", true).eq("disponible", true).eq("modo_trabajo", "entregas").limit(100);
    const free: string[] = [];
    for (const courier of couriers || []) {
      const { data: busy } = await supabase.rpc("delivery_repartidor_ocupado", { p_repartidor: courier.perfil_id });
      if (!busy) free.push(courier.perfil_id as string);
    }
    if (free.length) sends.push({ userIds: free, message: { title: "Nuevo envío de paquete 📦", body: `${money(Number(envio.ganancia_repartidor))} de ganancia · ${Number(envio.distancia_km).toFixed(1)} km. El primero que lo acepta se lo queda.`, url: "/app/repartidor", tag: `envio-${envio.id}` } });
  }

  if (evento === "envio_estado") {
    const copy = envioCliente[envio.estado as string];
    if (copy) sends.push({ userIds: [envio.cliente_id as string], message: { ...copy, body: envio.estado === "cancelado" && envio.motivo_cancelacion ? envio.motivo_cancelacion as string : copy.body, url: `/app/envios/${envio.id}`, tag: `envio-${envio.id}` } });
    // Si el cliente cancela con un repartidor asignado, el repartidor se entera.
    if (envio.estado === "cancelado" && estadoAnterior === "asignado" && envio.repartidor_id) {
      sends.push({ userIds: [envio.repartidor_id as string], message: { title: "Envío cancelado", body: "El cliente canceló el envío antes de que lo retires.", url: "/app/repartidor", tag: `envio-${envio.id}` } });
    }
  }
  return await dispatch(supabase, config, sends);
}
