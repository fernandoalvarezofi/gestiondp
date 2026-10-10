import { Banknote, Percent, XCircle, Timer } from "lucide-react";
import { useEffect, useState } from "react";
import { BarSeries, ListRow, Metric, MetricStrip, PageIntro, RowList, Section, Surface } from "@/components/panel/kit";
import { db, errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Analitica = {
  dias: number; pedidos: number; gmv: number; ticket_promedio: number; tarifa_servicio: number; cancelados: number; tasa_cancelacion: number;
  entrega_min: number | null; clientes_activos: number; clientes_nuevos: number; comercios_con_ventas: number;
  envios: { total: number; entregados: number; facturado: number }; viajes: { total: number; completados: number; facturado: number };
  por_dia: { dia: string; pedidos: number; gmv: number }[]; top_comercios: { nombre: string; pedidos: number; gmv: number }[];
  metodo_pago: Record<string, number>; tipo_entrega: Record<string, number>;
};
const RANGOS = [7, 30, 90] as const;
const etiqueta: Record<string, string> = { efectivo: "Efectivo", mercadopago: "Mercado Pago", transferencia: "Transferencia", delivery: "Envío a domicilio", retiro: "Retiro en el local" };

function Reparto({ title, data }: { title: string; data: Record<string, number> }) {
  const total = Object.values(data).reduce((a, b) => a + b, 0);
  return (
    <Surface>
      <p className="text-sm font-extrabold">{title}</p>
      {total === 0 ? <p className="mt-2 text-sm text-muted-foreground">Sin datos en el período.</p> : (
        <ul className="mt-3 space-y-2">
          {Object.entries(data).sort((a, b) => b[1] - a[1]).map(([clave, n]) => (
            <li key={clave}>
              <div className="flex justify-between text-sm"><span className="font-semibold">{etiqueta[clave] ?? clave}</span><span className="tabular-nums text-muted-foreground">{Math.round((n / total) * 100)}%</span></div>
              <div className="mt-1 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${(n / total) * 100}%` }} /></div>
            </li>
          ))}
        </ul>
      )}
    </Surface>
  );
}

/** Analytics de la plataforma (administración): evolución, clientes, comercios y los tres negocios (pedidos, envíos y viajes). */
export function AnalyticsPanel() {
  const [dias, setDias] = useState<(typeof RANGOS)[number]>(30);
  const [data, setData] = useState<Analitica | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setData(null); setError(null);
    db.rpc("delivery_admin_analitica", { p_dias: dias }).then(({ data: res, error: err }: { data: Analitica | null; error: unknown }) => {
      if (!active) return;
      if (err) setError(errorMessage(err)); else setData(res);
    });
    return () => { active = false; };
  }, [dias]);

  return (
    <div className="space-y-6">
      <PageIntro title="Analytics" description="Cómo evoluciona el negocio. Para el detalle contable, Contabilidad."
        actions={
          <div className="flex gap-1 rounded-full border bg-card p-1" role="group" aria-label="Período">
            {RANGOS.map((r) => <button key={r} type="button" onClick={() => setDias(r)} aria-pressed={dias === r} className={cn("rounded-full px-3 py-1 text-xs font-bold", dias === r ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground")}>{r} días</button>)}
          </div>
        } />
      {error && <p className="rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>}
      {!data && !error && <div className="h-40 animate-pulse rounded-3xl bg-muted" />}
      {data && (
        <>
          <MetricStrip cols={5}>
            <Metric featured icon={<Banknote />} label="Facturado en pedidos" value={money(data.gmv)} hint={`${data.pedidos} pedidos · ticket ${money(data.ticket_promedio)}`} spark={data.por_dia.map((d) => d.gmv)} />
            <Metric icon={<Percent />} tone="ink" label="Tarifa de servicio" value={money(data.tarifa_servicio)} hint="Cobrada a clientes" />
            <Metric icon={<XCircle />} tone="danger" label="Cancelados" value={`${data.tasa_cancelacion}%`} hint={`${data.cancelados} pedidos`} />
            <Metric icon={<Timer />} tone="info" label="Entrega promedio" value={data.entrega_min != null ? `${data.entrega_min} min` : "—"} hint="Desde que se pide" />
          </MetricStrip>
          <MetricStrip cols={4}>
            <Metric label="Clientes que compraron" value={data.clientes_activos} hint={`${data.clientes_nuevos} nuevos`} />
            <Metric label="Comercios con ventas" value={data.comercios_con_ventas} />
            <Metric label="Envíos de paquetes" value={data.envios.entregados} hint={`${data.envios.total} pedidos · ${money(data.envios.facturado)}`} />
            <Metric label="Viajes de remís" value={data.viajes.completados} hint={`${data.viajes.total} pedidos · ${money(data.viajes.facturado)}`} />
          </MetricStrip>
          <Section title="Pedidos por día">
            <Surface><BarSeries data={data.por_dia.map((d) => ({ key: d.dia, value: d.pedidos, label: new Date(`${d.dia}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "numeric" }), hint: money(d.gmv) }))} label={`Pedidos por día de los últimos ${data.dias} días`} height={190} /></Surface>
          </Section>
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <Section title="Comercios que más venden">
              <RowList>
                {data.top_comercios.map((c, i) => <ListRow key={c.nombre} lead={<span className="w-5 text-center text-sm font-black text-muted-foreground">{i + 1}</span>} title={c.nombre} meta={`${c.pedidos} pedidos`} trailing={<span className="font-extrabold tabular-nums">{money(c.gmv)}</span>} />)}
                {data.top_comercios.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">Sin ventas en el período.</p>}
              </RowList>
            </Section>
            <div className="space-y-4">
              <Reparto title="Cómo pagan" data={data.metodo_pago} />
              <Reparto title="Cómo reciben" data={data.tipo_entrega} />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
