// Recibe los avisos de Mercado Pago. No confía en el contenido del aviso: consulta el pago a la API de
// Mercado Pago con nuestra credencial y recién ahí actualiza el pedido.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const statusMap: Record<string, string> = {
  approved: "aprobado",
  authorized: "pendiente",
  in_process: "pendiente",
  pending: "pendiente",
  rejected: "rechazado",
  cancelled: "rechazado",
  refunded: "reintegrado",
  charged_back: "reintegrado",
};

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const type = url.searchParams.get("type") || url.searchParams.get("topic") || body.type || body.topic;
  const paymentId = url.searchParams.get("data.id") || url.searchParams.get("id") || body?.data?.id;

  // Mercado Pago espera un 200 rápido aunque el aviso no sea de un pago.
  if (type !== "payment" || !paymentId) return new Response("ok");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: tokenRow } = await admin.from("app_config").select("valor").eq("clave", "mp_access_token").maybeSingle();
  if (!tokenRow?.valor) return new Response("sin configurar", { status: 200 });

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
    headers: { Authorization: `Bearer ${tokenRow.valor}` },
  });
  if (!response.ok) {
    console.error("mercadopago payment lookup", response.status);
    return new Response("reintentar", { status: 500 });
  }
  const payment = await response.json();
  const orderId = payment.external_reference;
  const newStatus = statusMap[payment.status];
  if (!orderId || !newStatus) return new Response("ok");

  const { data: order } = await admin.from("delivery_pedidos").select("id, total, pago_estado, estado").eq("id", orderId).maybeSingle();
  if (!order) return new Response("ok");

  // El monto cobrado tiene que coincidir con el total del pedido.
  if (newStatus === "aprobado" && Math.abs(Number(payment.transaction_amount) - Number(order.total)) > 1) {
    console.error("monto distinto", orderId, payment.transaction_amount, order.total);
    return new Response("ok");
  }
  // No pisamos estados finales con avisos viejos que llegan desordenados.
  if (order.pago_estado === "aprobado" && newStatus === "pendiente") return new Response("ok");
  if (order.pago_estado === "a_reintegrar" && newStatus !== "reintegrado") return new Response("ok");

  // Si el pago se aprueba después de que el pedido se canceló por falta de pago, queda para reintegrar.
  const pagoEstado = newStatus === "aprobado" && order.estado === "cancelado" ? "a_reintegrar" : newStatus;
  await admin.from("delivery_pedidos").update({ pago_estado: pagoEstado, pago_id: String(payment.id) }).eq("id", orderId);
  return new Response("ok");
});
