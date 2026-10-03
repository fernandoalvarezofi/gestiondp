import { db } from "@/lib/delivery";

export type PagoPreferido = "auto" | "efectivo" | "mercadopago";
export type OrderPreferences = { pago_preferido: PagoPreferido; propina_default: number; entrega_sin_contacto: boolean; entrega_instrucciones: string | null };

export const defaultOrderPreferences: OrderPreferences = { pago_preferido: "auto", propina_default: 500, entrega_sin_contacto: false, entrega_instrucciones: null };
export const TIP_OPTIONS = [0, 500, 1000, 1500];

export async function loadOrderPreferences(userId: string): Promise<OrderPreferences> {
  const { data } = await db.from("delivery_preferencias").select("pago_preferido,propina_default,entrega_sin_contacto,entrega_instrucciones").eq("perfil_id", userId).maybeSingle();
  return { ...defaultOrderPreferences, ...(data ?? {}) };
}

/** Texto que se le muestra al repartidor, armado con las preferencias de entrega de la persona. */
export function deliveryNote(prefs: Pick<OrderPreferences, "entrega_sin_contacto" | "entrega_instrucciones">): string {
  const parts: string[] = [];
  if (prefs.entrega_sin_contacto) parts.push("Entrega sin contacto: dejar en la puerta y avisar.");
  if (prefs.entrega_instrucciones?.trim()) parts.push(prefs.entrega_instrucciones.trim());
  return parts.join(" ");
}

/** Método de pago inicial según la preferencia y si el pago online está disponible. */
export function initialPayment(pref: PagoPreferido, onlineEnabled: boolean): "efectivo" | "mercadopago" {
  if (pref === "efectivo") return "efectivo";
  return onlineEnabled ? "mercadopago" : "efectivo";
}
