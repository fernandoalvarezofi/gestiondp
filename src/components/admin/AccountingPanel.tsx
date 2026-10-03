import { useCallback, useEffect, useMemo, useState } from "react";
import { CheckCircle2, Download, Loader2, TriangleAlert } from "lucide-react";
import { toast } from "sonner";
import { StatCard } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toCsv } from "@/lib/csv";
import { db, errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Accounting = {
  periodo: { pedidos: number; cobrado: number; distribuido: number; diferencia: number; ventas_comercios: number; comisiones: number; servicio: number; margen_envio: number; descuentos_plataforma: number; ingresos_netos: number; iva: number; repartidores: number };
  por_dia: { dia: string; pedidos: number; cobrado: number; distribuido: number; diferencia: number }[];
  por_metodo: { metodo: string; pedidos: number; total: number }[];
  saldos: { a_pagar_comercios: number; a_pagar_repartidores: number; efectivo_en_repartidores: number; iva_a_pagar: number; billeteras_clientes: number };
  sin_asiento: { cantidad: number; pedidos: string[] };
  comercios: { id: string; nombre: string; frecuencia: "manual" | "diaria" | "semanal"; periodo: number; saldo: number }[];
};

const isoDay = (date: Date) => new Date(date.getTime() - date.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
const frequencyLabel = { manual: "Manual", diaria: "Todos los días", semanal: "Cada lunes" } as const;
const methodLabel: Record<string, string> = { efectivo: "Efectivo", transferencia: "Transferencia", tarjeta: "Tarjeta", mercadopago: "Mercado Pago" };

/** Contabilidad: reparto de cada pedido entre comercio, repartidor, Woref e impuestos, con conciliación diaria y exportación. */
export function AccountingPanel() {
  const today = useMemo(() => new Date(), []);
  const [from, setFrom] = useState(isoDay(new Date(today.getTime() - 29 * 86400000)));
  const [to, setTo] = useState(isoDay(today));
  const [data, setData] = useState<Accounting | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const { data: result, error } = await db.rpc("delivery_admin_contabilidad", { p_desde: from, p_hasta: to });
    setLoading(false);
    if (error) return toast.error(errorMessage(error));
    setData(result as unknown as Accounting);
  }, [from, to]);
  useEffect(() => { load(); }, [load]);

  const preset = (days: number) => { const end = new Date(); setTo(isoDay(end)); setFrom(isoDay(new Date(end.getTime() - (days - 1) * 86400000))); };
  const rebuild = async () => {
    setBusy(true);
    const { data: n, error } = await db.rpc("delivery_admin_rehacer_libro");
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(`Se reconstruyeron los asientos de ${n} pedidos`);
    load();
  };
  const setFrequency = async (id: string, value: string) => {
    const { error } = await db.rpc("delivery_admin_liquidacion_frecuencia", { p_comercio: id, p_frecuencia: value });
    if (error) return toast.error(errorMessage(error));
    toast.success(value === "manual" ? "Las liquidaciones de este comercio vuelven a ser manuales" : "Liquidación automática activada: se genera sola a las 6:00");
    load();
  };
  const exportCsv = () => {
    if (!data) return;
    const rows = [
      ...data.por_dia.map((day) => ["Día", day.dia, day.pedidos, day.cobrado, day.distribuido, day.diferencia]),
      ...data.comercios.map((store) => ["Comercio", store.nombre, "", store.periodo, store.saldo, frequencyLabel[store.frecuencia]]),
    ];
    const blob = new Blob([toCsv(["Tipo", "Detalle", "Pedidos", "Monto", "Distribuido / saldo", "Diferencia / frecuencia"], rows)], { type: "text/csv;charset=utf-8" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `contabilidad-${from}-a-${to}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  const balanced = data ? Math.abs(Number(data.periodo.diferencia)) < 1 && data.sin_asiento.cantidad === 0 : true;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-end gap-3">
        <div><label htmlFor="acc-from" className="text-xs font-bold">Desde</label><Input id="acc-from" type="date" value={from} max={to} onChange={(event) => setFrom(event.target.value)} /></div>
        <div><label htmlFor="acc-to" className="text-xs font-bold">Hasta</label><Input id="acc-to" type="date" value={to} min={from} onChange={(event) => setTo(event.target.value)} /></div>
        {[7, 30, 90].map((days) => <button key={days} type="button" onClick={() => preset(days)} className="rounded-full border bg-card px-3 py-2 text-sm font-bold hover:bg-muted">Últimos {days} días</button>)}
        <Button variant="outline" className="ml-auto rounded-full" onClick={exportCsv} disabled={!data}><Download className="h-4 w-4" />Exportar CSV</Button>
      </div>

      {loading && !data ? <div className="flex justify-center py-14"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : data && (
        <>
          <div className={cn("flex items-center gap-3 rounded-2xl border p-3 text-sm", balanced ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5")}>
            {balanced ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <TriangleAlert className="h-5 w-5 shrink-0 text-destructive" />}
            <p className="flex-1">
              {balanced ? <><span className="font-extrabold">Conciliado.</span> Lo cobrado a los clientes ({money(data.periodo.cobrado)}) coincide con lo repartido entre comercios, repartidores, Woref e impuestos.</>
                : <><span className="font-extrabold">Hay diferencias.</span> {data.sin_asiento.cantidad > 0 ? `${data.sin_asiento.cantidad} pedidos entregados no tienen asiento contable. ` : ""}{Math.abs(Number(data.periodo.diferencia)) >= 1 ? `Diferencia de ${money(data.periodo.diferencia)} entre lo cobrado y lo repartido.` : ""}</>}
            </p>
            {data.sin_asiento.cantidad > 0 && <Button size="sm" className="rounded-full" disabled={busy} onClick={rebuild}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Reconstruir asientos</Button>}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard label="Cobrado a clientes" value={money(data.periodo.cobrado)} hint={`${data.periodo.pedidos} pedidos entregados`} />
            <StatCard label="Ingresos netos de Woref" value={money(data.periodo.ingresos_netos)} hint={`Comisiones ${money(data.periodo.comisiones)} · servicio ${money(data.periodo.servicio)}`} />
            <StatCard label="IVA incluido (a pagar)" value={money(data.periodo.iva)} hint="Sobre los ingresos de Woref" />
            <StatCard label="Para comercios / repartidores" value={`${money(data.periodo.ventas_comercios)} / ${money(data.periodo.repartidores)}`} hint="Netos de comisión; incluye propinas" />
          </div>

          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <h2 className="font-extrabold">Saldos hoy</h2>
            <dl className="mt-3 grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-5">
              {[
                ["A pagar a comercios", data.saldos.a_pagar_comercios, "Ventas menos comisión, sin liquidar"],
                ["A pagar a repartidores", data.saldos.a_pagar_repartidores, "Ganancias menos pagos"],
                ["Efectivo en repartidores", data.saldos.efectivo_en_repartidores, "Cobrado que falta rendir"],
                ["IVA acumulado", data.saldos.iva_a_pagar, "Todo el historial"],
                ["Billeteras de clientes", data.saldos.billeteras_clientes, "Saldo a favor de clientes"],
              ].map(([label, value, hint]) => (
                <div key={String(label)} className="rounded-2xl bg-muted/50 p-3"><dt className="text-xs font-bold text-muted-foreground">{label}</dt><dd className="mt-1 font-display text-lg font-extrabold tabular-nums">{money(Number(value))}</dd><p className="text-[11px] text-muted-foreground">{hint}</p></div>
              ))}
            </dl>
          </section>

          <div className="grid gap-4 lg:grid-cols-2">
            <section className="overflow-x-auto rounded-3xl border bg-card">
              <h2 className="p-4 pb-2 font-extrabold">Conciliación por día</h2>
              <table className="w-full min-w-[420px] text-sm">
                <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Día</th><th className="p-3 text-right">Pedidos</th><th className="p-3 text-right">Cobrado</th><th className="p-3 text-right">Diferencia</th></tr></thead>
                <tbody className="divide-y">
                  {data.por_dia.length === 0 && <tr><td colSpan={4} className="p-4 text-center text-muted-foreground">No hay pedidos entregados en el período.</td></tr>}
                  {data.por_dia.map((day) => (
                    <tr key={day.dia}><td className="p-3 font-semibold">{day.dia}</td><td className="p-3 text-right">{day.pedidos}</td><td className="p-3 text-right tabular-nums">{money(day.cobrado)}</td><td className={cn("p-3 text-right font-bold tabular-nums", Math.abs(Number(day.diferencia)) >= 1 ? "text-destructive" : "text-success")}>{Math.abs(Number(day.diferencia)) >= 1 ? money(day.diferencia) : "OK"}</td></tr>
                  ))}
                </tbody>
              </table>
              {data.por_metodo.length > 0 && <p className="border-t p-3 text-xs text-muted-foreground">{data.por_metodo.map((method) => `${methodLabel[method.metodo] || method.metodo}: ${money(method.total)} (${method.pedidos})`).join(" · ")}</p>}
            </section>

            <section className="overflow-x-auto rounded-3xl border bg-card">
              <h2 className="p-4 pb-2 font-extrabold">Comercios y liquidación automática</h2>
              <table className="w-full min-w-[480px] text-sm">
                <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Comercio</th><th className="p-3 text-right">Neto del período</th><th className="p-3 text-right">Saldo</th><th className="p-3">Liquidar</th></tr></thead>
                <tbody className="divide-y">
                  {data.comercios.map((store) => (
                    <tr key={store.id}>
                      <td className="p-3 font-semibold">{store.nombre}</td>
                      <td className="p-3 text-right tabular-nums">{money(store.periodo)}</td>
                      <td className="p-3 text-right font-bold tabular-nums">{money(store.saldo)}</td>
                      <td className="p-3"><select aria-label={`Frecuencia de liquidación de ${store.nombre}`} value={store.frecuencia} onChange={(event) => setFrequency(store.id, event.target.value)} className="rounded-lg border bg-background px-2 py-1.5 text-xs font-semibold">{(Object.keys(frequencyLabel) as (keyof typeof frequencyLabel)[]).map((key) => <option key={key} value={key}>{frequencyLabel[key]}</option>)}</select></td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="border-t p-3 text-xs text-muted-foreground">Las automáticas se generan a las 6:00 (hora de Argentina) con las entregas hasta las 00:00 de ese día. Luego las marcás como pagadas en Liquidaciones.</p>
            </section>
          </div>
        </>
      )}
    </div>
  );
}
