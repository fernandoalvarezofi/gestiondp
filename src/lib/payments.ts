import { supabase } from "@/integrations/supabase/client";

/** Pide a Mercado Pago el link de cobro de un pedido y lleva al cliente a pagar. */
export async function startOnlinePayment(orderId: string) {
  const { data, error } = await supabase.functions.invoke("mp-crear-preferencia", { body: { pedido_id: orderId } });
  if (error) {
    // El error de la función viene en el cuerpo de la respuesta.
    const context = (error as { context?: Response }).context;
    const detail = context ? await context.json().catch(() => null) : null;
    throw new Error(detail?.error || "No pudimos abrir Mercado Pago. Probá de nuevo.");
  }
  const url = (data as { init_point?: string } | null)?.init_point;
  if (!url) throw new Error("Mercado Pago no devolvió el link de pago");
  window.location.assign(url);
}
