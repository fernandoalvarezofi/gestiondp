// Crea el cobro de Mercado Pago (Checkout Pro) para un pedido del cliente que llama y devuelve el link de pago.
import { createClient } from "npm:@supabase/supabase-js@2.49.4";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

// Solo se vuelve a estas direcciones después de pagar (evita redirecciones a sitios ajenos).
const ALLOWED_ORIGINS = [/^https:\/\/woref\.vercel\.app$/, /^https:\/\/woref-[a-z0-9-]+\.vercel\.app$/, /^http:\/\/localhost:\d+$/];

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return json({ error: "Método no permitido" }, 405);

  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") || "";
  // Cliente con la sesión del usuario: las políticas de la base garantizan que solo vea sus pedidos.
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } }, auth: { persistSession: false } });
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });

  const { data: userData } = await asUser.auth.getUser();
  if (!userData.user) return json({ error: "Tenés que iniciar sesión" }, 401);

  const { pedido_id } = await req.json().catch(() => ({ pedido_id: null }));
  if (!pedido_id) return json({ error: "Falta el pedido" }, 400);

  const { data: order } = await asUser
    .from("delivery_pedidos")
    .select("id, cliente_id, total, estado, metodo_pago, pago_estado, comercio:delivery_comercios(nombre)")
    .eq("id", pedido_id)
    .maybeSingle();
  if (!order || order.cliente_id !== userData.user.id) return json({ error: "Pedido no encontrado" }, 404);
  if (order.metodo_pago !== "mercadopago") return json({ error: "Este pedido no se paga online" }, 400);
  if (order.pago_estado === "aprobado") return json({ error: "Este pedido ya está pagado" }, 409);
  if (order.estado !== "pendiente") return json({ error: "Este pedido ya no se puede pagar" }, 409);

  const { data: tokenRow } = await admin.from("app_config").select("valor").eq("clave", "mp_access_token").maybeSingle();
  if (!tokenRow?.valor) return json({ error: "El pago online no está disponible por ahora" }, 503);

  const originHeader = req.headers.get("Origin") || "";
  const origin = ALLOWED_ORIGINS.some((pattern) => pattern.test(originHeader)) ? originHeader : "https://woref.vercel.app";
  const back = `${origin}/app/pedidos/${order.id}`;
  const store = order.comercio as unknown as { nombre: string } | null;

  const response = await fetch("https://api.mercadopago.com/checkout/preferences", {
    method: "POST",
    headers: { Authorization: `Bearer ${tokenRow.valor}`, "Content-Type": "application/json", "X-Idempotency-Key": `pref-${order.id}-${Date.now()}` },
    body: JSON.stringify({
      items: [{ id: order.id, title: `Pedido #${order.id.slice(0, 6).toUpperCase()} · ${store?.nombre || "Woref"}`, quantity: 1, unit_price: Number(order.total), currency_id: "ARS" }],
      payer: { email: userData.user.email },
      external_reference: order.id,
      notification_url: `${url}/functions/v1/mp-webhook`,
      back_urls: { success: `${back}?pago=aprobado`, pending: `${back}?pago=pendiente`, failure: `${back}?pago=rechazado` },
      auto_return: "approved",
      statement_descriptor: "WOREF",
      expires: true,
      expiration_date_to: new Date(Date.now() + 30 * 60 * 1000).toISOString(),
    }),
  });
  const preference = await response.json();
  if (!response.ok) {
    console.error("mercadopago preference error", response.status, JSON.stringify(preference).slice(0, 500));
    return json({ error: response.status === 401 ? "La credencial de Mercado Pago no es válida. Revisala en Administración → Pagos." : "Mercado Pago no respondió. Probá de nuevo en unos minutos." }, 502);
  }

  await admin.from("delivery_pedidos").update({ pago_preferencia: preference.id }).eq("id", order.id);
  return json({ init_point: preference.init_point, sandbox_init_point: preference.sandbox_init_point });
});
