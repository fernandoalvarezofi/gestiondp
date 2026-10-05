// Recibe los avisos de Mercado Pago. No confía en el contenido del aviso: (1) si hay clave secreta configurada, verifica la firma;
// (2) consulta el pago al proveedor con nuestra credencial; (3) recién ahí lo registra con pago_aplicar_notificacion,
// que valida monto y orden de los estados y deja todo en el historial y en el libro de pagos.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";
import { mercadoPago } from "../_shared/pagos/mercadopago.ts";

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
  if (!token) return new Response("sin configurar", { status: 200 });
  const proveedor = mercadoPago({ token, secretoWebhook: config?.find((c) => c.clave === "mp_webhook_secret")?.valor });

  // Con clave secreta configurada, un aviso sin firma válida se descarta. El id firmado es el de la URL (data.id).
  const firma = await proveedor.verificarAviso({
    cabeceraFirma: req.headers.get("x-signature"), idPeticion: req.headers.get("x-request-id"), idDato: url.searchParams.get("data.id") ?? String(paymentId),
  });
  if (firma !== "ok") {
    await admin.rpc("pago_registrar_incidente", { p_proveedor: proveedor.id, p_external_id: String(paymentId).slice(0, 64), p_tipo: firma === "ausente" ? "firma_ausente" : "firma_invalida", p_detalle: { motivo: firma } });
    return new Response("firma inválida", { status: 401 });
  }

  let pago;
  try {
    pago = await proveedor.obtenerPago(String(paymentId));
  } catch (error) {
    console.error("consulta de pago", (error as { estadoHttp?: number }).estadoHttp);
    return new Response("reintentar", { status: 500 });
  }
  if (!pago.referencia || !/^[0-9a-f-]{36}$/i.test(pago.referencia)) return new Response("ok");

  const { error } = await admin.rpc("pago_aplicar_notificacion", {
    p_proveedor: proveedor.id, p_external_id: pago.externalId, p_pedido: pago.referencia, p_estado_proveedor: pago.estado,
    p_monto: pago.monto, p_detalle: pago.detalle, p_preferencia: null,
  });
  if (error) {
    console.error("pago_aplicar_notificacion", error.message);
    return new Response("reintentar", { status: 500 });
  }
  return new Response("ok");
});
