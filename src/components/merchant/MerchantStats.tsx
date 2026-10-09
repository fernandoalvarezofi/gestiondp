import { useEffect, useState } from "react";
import { Globe, Loader2 } from "lucide-react";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { BarSeries, Delta, Metric, MetricStrip, PageIntro, Section, Surface } from "@/components/panel/kit";
import { db, errorMessage, metodoPagoLabel, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Stats = {
  dias: number; pedidos: number; ventas: number; descuentos: number; ticket_promedio: number; entregados: number;
  cancelados_cliente: number; rechazados: number; sin_respuesta: number; respuesta_seg: number | null; preparacion_min: number | null;
  pedidos_previo: number; ventas_previo: number;
  por_dia: { dia: string; pedidos: number; ventas: number }[];
  por_hora: { hora: number; pedidos: number }[];
  top_productos: { nombre: string; unidades: number; ingresos: number }[];
  tipo_entrega: Record<string, number>;
  metodo_pago: Record<string, number>;
  calificacion: { promedio: number; total: number; distribucion: Record<string, number> };
};

const PERIODS = [7, 30, 90] as const;

const seconds = (value: number | null) => (value == null ? "—" : value < 60 ? `${value} s` : `${Math.round(value / 60)} min`);

export function MerchantStats({ storeId, rating, reviews }: { storeId: string; rating: number; reviews: number }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tienda, setTienda] = useState<{ pedidos: number; ventas: number } | null>(null);
  const [reintento, setReintento] = useState(0);

  // Lo vendido a través de la tienda online (pedidos entregados cuyo cliente llegó desde /t/...).
  useEffect(() => {
    let active = true;
    db.rpc("delivery_ventas_tienda_online", { p_comercio: storeId, p_dias: days })
      .then(({ data }: { data: { pedidos: number; ventas: number } | null }) => { if (active && data) setTienda({ pedidos: Number(data.pedidos), ventas: Number(data.ventas) }); }, () => undefined);
    return () => { active = false; };
  }, [storeId, days]);

  useEffect(() => {
    let active = true;
    setStats(null);
    setError(null);
    db.rpc("delivery_estadisticas_comercio", { p_comercio: storeId, p_dias: days }).then(({ data, error: failure }: { data: Stats | null; error: unknown }) => {
      if (!active) return;
      if (failure || !data) setError(errorMessage(failure, "No pudimos cargar las estadísticas"));
      else setStats(data);
    });
    return () => { active = false; };
  }, [storeId, days, reintento]);

  const period = (
    <div className="inline-flex rounded-full border bg-card p-0.5" role="tablist" aria-label="Período">
      {PERIODS.map((value) => (
        <button key={value} type="button" role="tab" aria-selected={days === value} onClick={() => setDays(value)} className={cn("rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-colors", days === value ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>{value} días</button>
      ))}
    </div>
  );
  const intro = <PageIntro description="Cómo le va a tu local, comparado con el período anterior." actions={period} />;

  if (error) return <div className="space-y-5">{intro}<ErrorState title="No pudimos cargar las estadísticas" error={new Error(error)} onRetry={() => { setError(null); setDays((d) => d); setReintento((n) => n + 1); }} /></div>;
  if (!stats) return <div className="space-y-5">{intro}<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></div>;

  const answered = stats.pedidos + stats.rechazados + stats.sin_respuesta;
  const acceptance = answered ? Math.round((stats.pedidos / answered) * 100) : null;
  const maxUnits = stats.top_productos[0]?.unidades || 1;
  const totalPayments = Object.values(stats.metodo_pago).reduce((total, value) => total + value, 0);
  const pickupShare = stats.pedidos ? Math.round(((stats.tipo_entrega.retiro || 0) / stats.pedidos) * 100) : 0;
  const ratingTotal = stats.calificacion.total;
  const daily = stats.por_dia.map((item) => ({ key: item.dia, value: item.ventas, label: new Date(`${item.dia}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }), hint: `${item.pedidos} ${item.pedidos === 1 ? "pedido" : "pedidos"}` }));
  const hourly = stats.por_hora.map((item) => ({ key: String(item.hora), value: item.pedidos, label: item.hora % 6 === 0 ? `${item.hora} h` : "", hint: `${item.hora}:00 h` }));
  const peak = stats.por_hora.reduce((best, item) => (item.pedidos > best.pedidos ? item : best), stats.por_hora[0] ?? { hora: 0, pedidos: 0 });
  const empty = stats.pedidos === 0 && stats.rechazados === 0 && stats.sin_respuesta === 0;

  return (
    <div className="space-y-6">
      {intro}

      <MetricStrip cols={5}>
        <Metric featured label="Ventas" value={money(stats.ventas)} delta={<Delta current={stats.ventas} previous={stats.ventas_previo} suffix="vs. período anterior" />} spark={stats.por_dia.map((d) => d.ventas)} />
        <Metric label="Pedidos" value={stats.pedidos} delta={<Delta current={stats.pedidos} previous={stats.pedidos_previo} />} />
        <Metric label="Ticket promedio" value={money(stats.ticket_promedio)} hint={stats.descuentos > 0 ? `Descuentos: ${money(stats.descuentos)}` : "Sin envío ni propinas"} />
        <Metric label="Calificación" value={ratingTotal ? Number(stats.calificacion.promedio).toFixed(1) : reviews ? Number(rating).toFixed(1) : "—"} hint={ratingTotal ? `${ratingTotal} en el período` : `${reviews} en total`} />
      </MetricStrip>

      {tienda && tienda.pedidos > 0 && (
        <p className="flex items-center gap-2 rounded-2xl border bg-card px-4 py-3 text-sm"><Globe className="h-4 w-4 shrink-0 text-muted-foreground" /><span><span className="font-bold">Tienda online:</span> {tienda.pedidos} {tienda.pedidos === 1 ? "pedido entregado" : "pedidos entregados"} por {money(tienda.ventas)} en este período.</span></p>
      )}

      {empty ? (
        <EmptyState title="Todavía no hay datos en este período" text="Cuando recibas pedidos vas a ver ventas, horarios pico, productos estrella y tu desempeño acá." />
      ) : (
        <>
          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Section title="Ventas por día" description="En pesos, sin envío ni propinas. El día más alto va resaltado.">
              <Surface><BarSeries data={daily} label={`Ventas diarias de los últimos ${stats.dias} días`} format={money} height={200} /></Surface>
            </Section>
            <Section title="Horarios con más pedidos" description={peak.pedidos ? `Tu hora pico es a las ${peak.hora}:00` : "Para organizar tu cocina y tu personal"}>
              <Surface><BarSeries data={hourly} label="Pedidos por hora del día" height={200} /></Surface>
            </Section>
          </div>

          <Section title="Tu desempeño" description="Lo que los clientes y la plataforma tienen en cuenta">
            <MetricStrip>
              <Metric label="Aceptación" value={acceptance == null ? "—" : `${acceptance}%`} hint={`${stats.rechazados} rechazados · ${stats.sin_respuesta} sin respuesta`} />
              <Metric label="Tiempo de respuesta" value={seconds(stats.respuesta_seg)} hint="Hasta que aceptás" />
              <Metric label="Preparación real" value={stats.preparacion_min == null ? "—" : `${stats.preparacion_min} min`} hint="De aceptado a listo" />
              <Metric label="Cancelados por clientes" value={stats.cancelados_cliente} hint={`${stats.entregados} entregados`} />
            </MetricStrip>
          </Section>

          <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
            <Section title="Productos más vendidos">
              <Surface flush>
                {stats.top_productos.length ? (
                  <ol className="divide-y">
                    {stats.top_productos.map((item, index) => (
                      <li key={item.nombre} className="px-4 py-3">
                        <div className="flex items-baseline justify-between gap-3 text-sm"><span className="min-w-0 truncate font-bold"><span className="mr-2 inline-block w-4 tabular-nums text-muted-foreground">{index + 1}</span>{item.nombre}</span><span className="shrink-0 tabular-nums text-muted-foreground">{item.unidades} u. · <span className="font-bold text-foreground">{money(item.ingresos)}</span></span></div>
                        <div className="mt-1.5 h-1.5 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-foreground/70" style={{ width: `${(item.unidades / maxUnits) * 100}%` }} /></div>
                      </li>
                    ))}
                  </ol>
                ) : <p className="p-4 text-sm text-muted-foreground">Sin ventas en el período.</p>}
              </Surface>
            </Section>

            <div className="space-y-6">
              <Section title="Cómo te piden">
                <Surface>
                  <div className="flex h-2.5 overflow-hidden rounded-full bg-muted"><div className="h-full bg-foreground/80" style={{ width: `${100 - pickupShare}%` }} /></div>
                  <p className="mt-2 flex justify-between text-[13px]"><span><span className="font-bold">Envío</span> <span className="tabular-nums text-muted-foreground">{100 - pickupShare}%</span></span><span><span className="font-bold">Retiro</span> <span className="tabular-nums text-muted-foreground">{pickupShare}%</span></span></p>
                  <ul className="mt-4 space-y-2 border-t pt-3 text-[13px]">
                    {Object.entries(stats.metodo_pago).sort((a, b) => b[1] - a[1]).map(([method, count]) => (
                      <li key={method} className="flex justify-between"><span>{metodoPagoLabel[method as keyof typeof metodoPagoLabel] ?? method}</span><span className="tabular-nums text-muted-foreground">{count} · {totalPayments ? Math.round((count / totalPayments) * 100) : 0}%</span></li>
                    ))}
                  </ul>
                </Surface>
              </Section>
              {ratingTotal > 0 && (
                <Section title="Opiniones del período">
                  <Surface>
                    <ul className="space-y-2">
                      {[5, 4, 3, 2, 1].map((star) => {
                        const count = stats.calificacion.distribucion[String(star)] || 0;
                        return <li key={star} className="flex items-center gap-2 text-[13px]"><span className="w-6 tabular-nums">{star}★</span><div className="h-1.5 flex-1 rounded-full bg-muted"><div className="h-1.5 rounded-full bg-warning" style={{ width: `${(count / ratingTotal) * 100}%` }} /></div><span className="w-6 text-right tabular-nums text-muted-foreground">{count}</span></li>;
                      })}
                    </ul>
                  </Surface>
                </Section>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
