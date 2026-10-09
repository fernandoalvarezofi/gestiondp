import { useEffect, useState } from "react";
import { ArrowDownLeft, ArrowUpRight, HelpCircle, Loader2 } from "lucide-react";
import { EmptyState } from "@/components/delivery/Common";
import { PageIntro, Section, StatusPill, Surface } from "@/components/panel/kit";
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

  const ventasN = Number(pending.ventas);
  // Reparto de cada $100: con ventas, el real del período (incluye el efecto de los cupones); sin ventas, el nominal de la comisión.
  const pctComision = ventasN ? Math.max(0, Math.min(100, (Number(pending.comision) / ventasN) * 100)) : Number(data.comision_pct);
  const pctVos = ventasN ? Math.max(0, Math.min(100, (Number(pending.neto) / ventasN) * 100)) : 100 - Number(data.comision_pct);
  const waterfall: { label: string; hint?: string; value: number; sign?: "−" | "="; strong?: boolean }[] = [
    { label: "Ventas", hint: `${pending.pedidos} ${pending.pedidos === 1 ? "pedido entregado" : "pedidos entregados"}`, value: Number(pending.ventas) },
    { label: `Comisión de Woref (${data.comision_pct}%)`, hint: Number(pending.descuentos) > 0 ? `Descontando tus cupones: ${money(pending.descuentos)}` : "Sobre tus ventas", value: Number(pending.comision), sign: "−" },
    { label: "Neto para vos", value: Number(pending.neto), sign: "=", strong: true },
    { label: "Cobrado en el local", hint: "Retiros pagados en mano", value: Number(pending.cobrado_directo), sign: "−" },
  ];

  return (
    <div className="space-y-6">
      <PageIntro description="Lo que te corresponde por tus pedidos entregados y cómo se calcula." />

      <div className="grid gap-4 lg:grid-cols-[minmax(0,5fr)_minmax(0,7fr)]">
        <section className="flex flex-col justify-between rounded-2xl bg-brand-deep p-5 text-white sm:p-6">
          <div>
            <p className="text-[13px] font-semibold text-white/65">Acumulado sin liquidar{pending.desde && ` · desde el ${new Date(pending.desde).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}`}</p>
            <p className="mt-2 font-display text-[44px] font-extrabold leading-none tracking-tight tabular-nums">{money(Math.abs(balance))}</p>
            <p className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-1 text-[13px] font-bold">{balance >= 0 ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}{balanceText(balance)}</p>
          </div>
          <div className="mt-8">
            <p className="mb-2 text-[12.5px] font-semibold text-white/65">De cada $100 que vendés</p>
            <div className="flex h-2.5 overflow-hidden rounded-full bg-white/15"><div className="h-full bg-white" style={{ width: `${pctVos}%` }} /><div className="h-full bg-brand-yellow" style={{ width: `${pctComision}%` }} /></div>
            <p className="mt-2 flex justify-between text-[12.5px] text-white/70"><span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-white" />Para vos {Math.round(pctVos)}%</span><span><span className="mr-1.5 inline-block h-2 w-2 rounded-full bg-brand-yellow" />Comisión {data.comision_pct}%</span></p>
          </div>
          <p className="mt-6 max-w-md text-xs leading-relaxed text-white/55">Administración cierra el período y te lo paga o cobra. Hasta entonces, este número puede cambiar con cada pedido.</p>
        </section>

        <Surface flush className="self-stretch">
          <div className="border-b px-5 py-3.5"><h3 className="text-[15px] font-extrabold">Cómo se llega a ese número</h3></div>
          <dl className="divide-y">
            {waterfall.map((row) => (
              <div key={row.label} className={cn("flex items-center gap-3 px-5 py-3", row.strong && "bg-muted/50")}>
                <span className="w-5 shrink-0 text-center text-lg font-medium leading-none text-muted-foreground">{row.sign ?? ""}</span>
                <div className="min-w-0 flex-1"><dt className={cn("text-sm", row.strong ? "font-extrabold" : "font-semibold")}>{row.label}</dt>{row.hint && <dd className="text-[12.5px] text-muted-foreground">{row.hint}</dd>}</div>
                <span className={cn("shrink-0 tabular-nums", row.strong ? "text-lg font-extrabold" : "font-bold")}>{money(row.value)}</span>
              </div>
            ))}
            <div className="flex items-center gap-3 border-t-2 border-foreground/80 px-5 py-3.5">
              <span className="w-5 shrink-0 text-center text-lg font-medium leading-none">=</span>
              <dt className="flex-1 text-sm font-extrabold">{balanceText(balance)}</dt>
              <dd className="shrink-0 text-xl font-extrabold tabular-nums">{money(Math.abs(balance))}</dd>
            </div>
          </dl>
        </Surface>
      </div>

      <Section title="Liquidaciones" description="Cada período cerrado por administración">
        {data.liquidaciones.length === 0 ? (
          <div className="rounded-2xl border border-dashed bg-card px-5 py-9 text-center"><p className="font-bold">Todavía no hay liquidaciones</p><p className="mt-0.5 text-sm text-muted-foreground">Cuando administración cierre un período, vas a ver el detalle acá.</p></div>
        ) : (
          <Surface flush className="overflow-x-auto">
            <table className="w-full min-w-[680px] text-sm">
              <thead><tr className="border-b bg-muted/40 text-left text-[12px] font-semibold uppercase tracking-wide text-muted-foreground"><th className="px-4 py-2.5">Período</th><th className="px-4 py-2.5 text-right">Pedidos</th><th className="px-4 py-2.5 text-right">Ventas</th><th className="px-4 py-2.5 text-right">Comisión</th><th className="px-4 py-2.5 text-right">Balance</th><th className="px-4 py-2.5">Estado</th><th className="px-4 py-2.5" /></tr></thead>
              <tbody className="divide-y">
                {data.liquidaciones.map((item) => (
                  <tr key={item.id} className="transition-colors hover:bg-muted/40">
                    <td className="px-4 py-3 font-bold">{periodLabel(item)}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{item.pedidos}</td>
                    <td className="px-4 py-3 text-right tabular-nums">{money(item.ventas)}</td>
                    <td className="px-4 py-3 text-right tabular-nums text-muted-foreground">−{money(item.comision)}</td>
                    <td className={cn("px-4 py-3 text-right font-bold tabular-nums", Number(item.balance) < 0 && "text-destructive")}>{money(Math.abs(Number(item.balance)))}<span className="block text-[11px] font-normal text-muted-foreground">{balanceText(Number(item.balance))}</span></td>
                    <td className="px-4 py-3"><StatusPill tone={item.estado === "pagada" ? "success" : "warning"} dot>{item.estado === "pagada" ? "Saldada" : "Pendiente"}</StatusPill>{item.pagada_at && <span className="mt-0.5 block text-[11px] text-muted-foreground">{formatDateTime(item.pagada_at)}</span>}</td>
                    <td className="px-4 py-3 text-right"><Button size="sm" variant="ghost" className="rounded-full font-bold" onClick={() => setSelected(item)}>Ver detalle</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Surface>
        )}
      </Section>

      <Accordion type="single" collapsible className="rounded-2xl border bg-card px-4">
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
