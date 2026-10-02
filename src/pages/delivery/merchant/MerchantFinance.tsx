import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, CheckCircle2, Clock3, HelpCircle, Loader2, Percent, Wallet } from "lucide-react";
import { EmptyState, StatCard } from "@/components/delivery/Common";
import { periodLabel, Settlement, SettlementDetail } from "@/components/finance/SettlementDetail";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { useMerchant } from "./context";

type Finance = {
  comision_pct: number;
  pendiente: { pedidos: number; ventas: number; descuentos: number; comision: number; neto: number; cobrado_directo: number; balance: number; desde: string | null };
  liquidaciones: Settlement[];
};

/** Lo que Woref le debe al comercio o el comercio a Woref, con el detalle de cada liquidación. */
const balanceText = (balance: number) => (balance > 0 ? "Woref te paga" : balance < 0 ? "Le pagás a Woref" : "Sin saldo");

export default function MerchantFinance() {
  const { store } = useMerchant();
  const [data, setData] = useState<Finance | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Settlement | null>(null);

  useEffect(() => {
    let active = true;
    db.rpc("delivery_finanzas_comercio", { p_comercio: store.id }).then(({ data: result, error: failure }: { data: Finance | null; error: unknown }) => {
      if (!active) return;
      if (failure || !result) setError(errorMessage(failure, "No pudimos cargar tus finanzas")); else setData(result);
    });
    return () => { active = false; };
  }, [store.id]);

  if (error) return <EmptyState title="No pudimos cargar tus finanzas" text={error} />;
  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const pending = data.pendiente;
  const balance = Number(pending.balance);

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-brand-deep p-5 text-white">
        <p className="text-sm font-semibold text-white/70">Acumulado sin liquidar{pending.desde && ` · desde ${new Date(pending.desde).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}`}</p>
        <p className="font-display text-4xl font-black">{money(Math.abs(balance))}</p>
        <p className="mt-1 flex items-center gap-1.5 text-sm font-bold text-white/85">{balance >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}{balanceText(balance)}</p>
        <p className="mt-3 max-w-xl text-xs text-white/60">Es lo que queda de tus pedidos entregados una vez descontada la comisión y lo que cobraste directamente en el local. Administración cierra el período y te lo paga o cobra.</p>
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ventas" value={money(pending.ventas)} icon={<Wallet className="h-4 w-4" />} hint={`${pending.pedidos} pedidos entregados`} />
        <StatCard label={`Comisión de Woref (${data.comision_pct}%)`} value={`−${money(pending.comision)}`} icon={<Percent className="h-4 w-4" />} hint={Number(pending.descuentos) > 0 ? `Descuentos propios: ${money(pending.descuentos)}` : "Sobre tus ventas"} />
        <StatCard label="Neto para vos" value={money(pending.neto)} icon={<CheckCircle2 className="h-4 w-4" />} hint="Ventas − comisión" />
        <StatCard label="Cobrado en el local" value={money(pending.cobrado_directo)} icon={<Clock3 className="h-4 w-4" />} hint="Retiros pagados en mano" />
      </div>

      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="font-extrabold">Liquidaciones</h2>
        {data.liquidaciones.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Todavía no hay liquidaciones. Cuando administración cierre un período, vas a ver el detalle acá.</p>
        ) : (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="border-b text-left text-muted-foreground"><tr><th className="p-2.5">Período</th><th className="p-2.5 text-right">Pedidos</th><th className="p-2.5 text-right">Ventas</th><th className="p-2.5 text-right">Comisión</th><th className="p-2.5 text-right">Balance</th><th className="p-2.5">Estado</th><th className="p-2.5" /></tr></thead>
              <tbody className="divide-y">
                {data.liquidaciones.map((item) => (
                  <tr key={item.id}>
                    <td className="p-2.5 font-bold">{periodLabel(item)}</td>
                    <td className="p-2.5 text-right tabular-nums">{item.pedidos}</td>
                    <td className="p-2.5 text-right tabular-nums">{money(item.ventas)}</td>
                    <td className="p-2.5 text-right tabular-nums">−{money(item.comision)}</td>
                    <td className={cn("p-2.5 text-right font-bold tabular-nums", Number(item.balance) < 0 && "text-destructive")}>{money(Math.abs(Number(item.balance)))}<span className="block text-[11px] font-normal text-muted-foreground">{balanceText(Number(item.balance))}</span></td>
                    <td className="p-2.5"><span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", item.estado === "pagada" ? "bg-success/10 text-success" : "bg-warning/20")}>{item.estado === "pagada" ? "Saldada" : "Pendiente"}</span>{item.pagada_at && <span className="block text-[11px] text-muted-foreground">{formatDateTime(item.pagada_at)}</span>}</td>
                    <td className="p-2.5 text-right"><Button size="sm" variant="outline" className="rounded-full" onClick={() => setSelected(item)}>Ver detalle</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <Accordion type="single" collapsible className="rounded-3xl border bg-card px-4">
        <AccordionItem value="como" className="border-b-0">
          <AccordionTrigger className="font-extrabold hover:no-underline"><span className="flex items-center gap-2"><HelpCircle className="h-5 w-5 text-primary" />¿Cómo se calcula?</span></AccordionTrigger>
          <AccordionContent className="space-y-2 text-sm text-muted-foreground">
            <p><span className="font-bold text-foreground">Ventas:</span> el subtotal de los productos de cada pedido entregado (sin envío, propina ni tarifa de servicio).</p>
            <p><span className="font-bold text-foreground">Comisión:</span> {data.comision_pct}% de tus ventas, descontando los cupones que creaste vos. Los cupones de Woref los paga Woref.</p>
            <p><span className="font-bold text-foreground">Neto:</span> ventas menos comisión, lo que te corresponde.</p>
            <p><span className="font-bold text-foreground">Cobrado en el local:</span> en los retiros pagados en mano, el cliente te paga a vos. Eso se descuenta de tu neto: si es más de lo que te corresponde, le pagás la diferencia a Woref (tarifa de servicio y comisión).</p>
            <p>Los pedidos pagados online y los envíos se cobran a través de Woref (el repartidor rinde el efectivo), por eso Woref te los paga completos.</p>
            <p className="text-xs">El comprobante fiscal de la comisión lo emite administración al cerrar cada período.</p>
          </AccordionContent>
        </AccordionItem>
      </Accordion>

      <SettlementDetail settlement={selected} open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)} title={store.nombre} />
    </div>
  );
}
