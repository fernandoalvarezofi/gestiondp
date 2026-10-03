import { db } from "@/lib/delivery";

export type WalletMovement = { fecha: string; tipo: string; monto: number; pedido_id: string | null; detalle: { motivo?: string } | null };
export type Wallet = { saldo: number; movimientos: WalletMovement[] };

export const walletMovementLabel: Record<string, string> = {
  carga_admin: "Crédito de Woref",
  reintegro_soporte: "Reintegro de soporte",
  reintegro_cancelacion: "Devolución por cancelación",
  reintegro_ajuste: "Devolución por ajuste del pedido",
  pago_pedido: "Pago de un pedido",
};

export async function loadWallet(): Promise<Wallet | null> {
  const { data, error } = await db.rpc("delivery_billetera_cliente");
  if (error || !data) return null;
  const wallet = data as Wallet;
  return { saldo: Number(wallet.saldo), movimientos: wallet.movimientos.map((item) => ({ ...item, monto: Number(item.monto) })) };
}

/** Cuánto del total se paga con el saldo: nunca más que el saldo ni más que el total. */
export const walletApplied = (balance: number, total: number) => Math.max(0, Math.min(balance, total));
