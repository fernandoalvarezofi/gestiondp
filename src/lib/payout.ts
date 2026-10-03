import { db } from "@/lib/delivery";

export type Payout = { entidad: "comercio" | "repartidor"; entidad_id: string; titular: string; cuit: string; cbu: string | null; alias: string | null; updated_at: string };

/** CBU de 22 dígitos con los dos dígitos verificadores correctos (misma regla que la base). */
export function isValidCbu(raw: string): boolean {
  const cbu = raw.replace(/\s/g, "");
  if (!/^\d{22}$/.test(cbu)) return false;
  const d = [...cbu].map(Number);
  const check = (digits: number[], weights: number[], expected: number) => (10 - (digits.reduce((sum, value, index) => sum + value * weights[index], 0) % 10)) % 10 === expected;
  return check(d.slice(0, 7), [7, 1, 3, 9, 7, 1, 3], d[7]) && check(d.slice(8, 21), [3, 9, 7, 1, 3, 9, 7, 1, 3, 9, 7, 1, 3], d[21]);
}

export const isValidAlias = (raw: string) => /^[A-Za-z0-9.-]{6,20}$/.test(raw.trim());

export async function loadPayout(entidad: Payout["entidad"], entidadId: string): Promise<Payout | null> {
  const { data } = await db.from("delivery_datos_cobro").select("*").eq("entidad", entidad).eq("entidad_id", entidadId).maybeSingle();
  return (data as Payout | null) ?? null;
}

/** Oculta el número de cuenta salvo los últimos 4 dígitos. */
export const maskCbu = (cbu: string | null) => (cbu ? `•••• •••• •••• •••• ${cbu.slice(-4)}` : "—");
