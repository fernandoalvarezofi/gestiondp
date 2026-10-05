// Recibe los avisos de Mercado Pago. No confía en el contenido del aviso: (1) si hay clave secreta configurada, verifica la firma;
// (2) consulta el pago a la API de Mercado Pago con nuestra credencial; (3) recién ahí lo registra con pago_aplicar_notificacion,
// que valida monto y orden de los estados y deja todo en el historial de pagos.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { verificarFirma } from "./firma.ts";

Deno.serve(async (req) => {
  const url = new URL(req.url);
  const body = req.method === "POST" ? await req.json().catch(() => ({})) : {};
  const type = url.searchParams.get("type") || url.searchParams.get("topic") || body.type || body.topic;
  const paymentId = url.searchParams.get("data.id") || url.searchParams.get("id") || body?.data?.id;

  // Mercado Pago espera un 200 rápido aunque el aviso no sea de un pago.
  if (type !== "payment" || !paymentId) return new Response("ok");

  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: config } = await admin.from("app_config").select("clave, valor").in("clave", ["mp_access_token", "mp_webhook_secret"]);
  const token = config?.find((c) => c.clave === "mp_access_token")?.valor;
  const secreto = config?.find((c) => c.clave === "mp_webhook_secret")?.valor;
  if (!token) return new Response("sin configurar", { status: 200 });

  // Con clave secreta configurada, un aviso sin firma válida se descarta. El id firmado es el de la URL (data.id).
  if (secreto) {
    const resultado = await verificarFirma({
      secreto, xSignature: req.headers.get("x-signature"), xRequestId: req.headers.get("x-request-id"),
      dataId: url.searchParams.get("data.id") ?? String(paymentId),
    });
    if (resultado !== "ok") {
      await admin.rpc("pago_registrar_incidente", { p_proveedor: "mercadopago", p_external_id: String(paymentId).slice(0, 64), p_tipo: resultado === "ausente" ? "firma_ausente" : "firma_invalida", p_detalle: { motivo: resultado } });
      return new Response("firma inválida", { status: 401 });
    }
  }

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(String(paymentId))}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    console.error("mercadopago payment lookup", response.status);
    return new Response("reintentar", { status: 500 });
  }
  const payment = await response.json();
  const orderId = payment.external_reference;
  if (!orderId || !/^[0-9a-f-]{36}$/i.test(String(orderId))) return new Response("ok");

  const { error } = await admin.rpc("pago_aplicar_notificacion", {
    p_proveedor: "mercadopago", p_external_id: String(payment.id), p_pedido: orderId, p_estado_proveedor: String(payment.status),
    p_monto: Number(payment.transaction_amount), p_detalle: payment.status_detail ?? null, p_preferencia: null,
  });
  if (error) {
    console.error("pago_aplicar_notificacion", error.message);
    return new Response("reintentar", { status: 500 });
  }
  return new Response("ok");
});
