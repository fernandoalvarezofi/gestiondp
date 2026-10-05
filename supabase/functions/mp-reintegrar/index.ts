// Devuelve el dinero de un pago de Mercado Pago (reintegro total). Solo administradores.
// Pide el reintegro a Mercado Pago con clave de idempotencia (un doble clic no devuelve dos veces) y recién después lo registra
// con pago_aplicar_notificacion, que lo asienta en el libro de pagos. El aviso posterior de Mercado Pago queda como duplicado.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: req.headers.get("Authorization") || "" } }, auth: { persistSession: false } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: userData } = await asUser.auth.getUser();
  if (!userData.user) return json({ error: "Tenés que iniciar sesión" }, 401);
  // Solo administradores: esta función de la base falla para cualquier otra persona.
  const { error: noAdmin } = await asUser.rpc("delivery_admin_pagos", { p_limite: 1 });
  if (noAdmin) return json({ error: "Solo administradores" }, 403);

  const { pago_id } = await req.json().catch(() => ({ pago_id: null }));
  if (!pago_id || !UUID.test(String(pago_id))) return json({ error: "Falta el pago" }, 400);

  const { data: pago } = await admin.from("pagos").select("id, referencia_id, proveedor, external_id, estado, monto").eq("id", pago_id).maybeSingle();
  if (!pago) return json({ error: "Pago no encontrado" }, 404);
  if (pago.estado !== "aprobado") return json({ error: "Solo se puede reintegrar un pago aprobado" }, 409);

  const { data: tokenRow } = await admin.from("app_config").select("valor").eq("clave", "mp_access_token").maybeSingle();
  if (!tokenRow?.valor) return json({ error: "Mercado Pago no está configurado" }, 400);

  const response = await fetch(`https://api.mercadopago.com/v1/payments/${encodeURIComponent(pago.external_id)}/refunds`, {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenRow.valor}`, "Content-Type": "application/json", "X-Idempotency-Key": `woref-reintegro-${pago.id}` },
    body: "{}",
  });
  if (!response.ok) {
    console.error("mercadopago refund", response.status);
    return json({ error: "Mercado Pago no pudo reintegrar el pago. Probá desde su panel y marcalo acá." }, 502);
  }

  const { error } = await admin.rpc("pago_aplicar_notificacion", {
    p_proveedor: pago.proveedor, p_external_id: pago.external_id, p_pedido: pago.referencia_id, p_estado_proveedor: "refunded", p_monto: Number(pago.monto), p_detalle: "reintegro desde Woref", p_preferencia: null,
  });
  if (error) console.error("pago_aplicar_notificacion", error.message);
  return json({ ok: true });
});
