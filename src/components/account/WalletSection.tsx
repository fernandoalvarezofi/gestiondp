import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowDownLeft, ArrowUpRight, Loader2, PiggyBank } from "lucide-react";
import { formatDateTime, money } from "@/lib/delivery";
import { loadWallet, Wallet, walletMovementLabel } from "@/lib/wallet";
import { cn } from "@/lib/utils";

/** Saldo a favor del cliente (créditos y reintegros) y sus movimientos; se usa al pedir. */
export function WalletSection() {
  const [wallet, setWallet] = useState<Wallet | null | undefined>(undefined);
  useEffect(() => { loadWallet().then(setWallet); }, []);

  if (wallet === undefined) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (wallet === null) return <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No pudimos cargar tu billetera. Probá de nuevo en un rato.</p>;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-brand-deep p-5 text-white">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/70"><PiggyBank className="h-4 w-4" />Saldo disponible</p>
        <p className="font-display text-4xl font-black">{money(wallet.saldo)}</p>
        <p className="mt-2 max-w-md text-xs text-white/65">Se usa solo cuando lo elegís al confirmar un pedido (no aplica a pagos con Mercado Pago). Si cancelan un pedido que pagaste con saldo, vuelve acá.</p>
        <Link to="/app" className="mt-4 inline-block rounded-full bg-white px-4 py-2 text-sm font-extrabold text-foreground">Pedir ahora</Link>
      </section>

      <section>
        <h3 className="font-extrabold">Movimientos</h3>
        {wallet.movimientos.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Todavía no tenés movimientos. Cuando te acrediten un reintegro o un crédito, lo vas a ver acá.</p>
        ) : (
          <ul className="mt-3 divide-y rounded-2xl border">
            {wallet.movimientos.map((item, index) => (
              <li key={`${item.fecha}-${index}`} className="flex items-center gap-3 p-3">
                <span className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-full", item.monto >= 0 ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{item.monto >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
                <span className="min-w-0 flex-1"><span className="block text-sm font-bold">{walletMovementLabel[item.tipo] ?? "Movimiento"}</span><span className="block truncate text-xs text-muted-foreground">{formatDateTime(item.fecha)}{item.detalle?.motivo ? ` · ${item.detalle.motivo}` : ""}</span></span>
                <span className={cn("font-extrabold tabular-nums", item.monto >= 0 ? "text-success" : "")}>{item.monto >= 0 ? "+" : "−"}{money(Math.abs(item.monto))}</span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
