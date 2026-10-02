import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownRight, ArrowUpRight, Clock3, Loader2, Receipt, ShieldCheck, Star, Timer, TrendingUp, Wallet } from "lucide-react";
import { EmptyState, StatCard } from "@/components/delivery/Common";
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
const axis = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };

/** Variación contra el período anterior de la misma duración. */
function Delta({ current, previous }: { current: number; previous: number }) {
  if (!previous) return <span className="text-muted-foreground">{current ? "Nuevo en este período" : "Sin datos previos"}</span>;
  const change = Math.round(((current - previous) / previous) * 100);
  const up = change >= 0;
  return <span className={cn("inline-flex items-center gap-0.5 font-bold", up ? "text-success" : "text-destructive")}>{up ? <ArrowUpRight className="h-3.5 w-3.5" /> : <ArrowDownRight className="h-3.5 w-3.5" />}{Math.abs(change)}% vs. período anterior</span>;
}

const seconds = (value: number | null) => (value == null ? "—" : value < 60 ? `${value} s` : `${Math.round(value / 60)} min`);

export function MerchantStats({ storeId, rating, reviews }: { storeId: string; rating: number; reviews: number }) {
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

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
  }, [storeId, days]);

  const period = (
    <div className="flex gap-2" role="tablist" aria-label="Período">
      {PERIODS.map((value) => (
        <button key={value} type="button" role="tab" aria-selected={days === value} onClick={() => setDays(value)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", days === value ? "border-foreground bg-foreground text-background" : "bg-card")}>Últimos {value} días</button>
      ))}
    </div>
  );

  if (error) return <div>{period}<EmptyState className="mt-4" title="No pudimos cargar las estadísticas" text={error} /></div>;
  if (!stats) return <div>{period}<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></div>;

  const answered = stats.pedidos + stats.rechazados + stats.sin_respuesta;
  const acceptance = answered ? Math.round((stats.pedidos / answered) * 100) : null;
  const maxHour = Math.max(1, ...stats.por_hora.map((item) => item.pedidos));
  const maxUnits = stats.top_productos[0]?.unidades || 1;
  const totalPayments = Object.values(stats.metodo_pago).reduce((total, value) => total + value, 0);
  const pickupShare = stats.pedidos ? Math.round(((stats.tipo_entrega.retiro || 0) / stats.pedidos) * 100) : 0;
  const ratingTotal = stats.calificacion.total;
  const chart = stats.por_dia.map((item) => ({ ...item, etiqueta: new Date(`${item.dia}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) }));
  const empty = stats.pedidos === 0 && stats.rechazados === 0 && stats.sin_respuesta === 0;

  return (
    <div className="space-y-6">
      {period}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ventas" value={money(stats.ventas)} icon={<Wallet className="h-4 w-4" />} hint={<Delta current={stats.ventas} previous={stats.ventas_previo} />} />
        <StatCard label="Pedidos" value={stats.pedidos} icon={<Receipt className="h-4 w-4" />} hint={<Delta current={stats.pedidos} previous={stats.pedidos_previo} />} />
        <StatCard label="Ticket promedio" value={money(stats.ticket_promedio)} icon={<TrendingUp className="h-4 w-4" />} hint={stats.descuentos > 0 ? `Descuentos aplicados: ${money(stats.descuentos)}` : "Sin envío ni propinas"} />
        <StatCard label="Calificación" value={ratingTotal ? Number(stats.calificacion.promedio).toFixed(1) : reviews ? Number(rating).toFixed(1) : "—"} icon={<Star className="h-4 w-4" />} hint={ratingTotal ? `${ratingTotal} opiniones en el período` : `${reviews} opiniones en total`} />
      </div>

      {empty ? (
        <EmptyState title="Todavía no hay datos en este período" text="Cuando recibas pedidos vas a ver ventas, horarios pico, productos estrella y tu desempeño acá." />
      ) : (
        <>
          <section className="rounded-3xl border bg-card p-4 sm:p-5">
            <h3 className="flex items-center gap-2 font-extrabold"><ShieldCheck className="h-5 w-5 text-primary" />Tu desempeño</h3>
            <p className="text-sm text-muted-foreground">Lo que los clientes y la plataforma tienen en cuenta.</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <div className="rounded-2xl bg-muted/60 p-3"><p className="text-xs font-semibold text-muted-foreground">Aceptación</p><p className="font-display text-2xl font-extrabold">{acceptance == null ? "—" : `${acceptance}%`}</p><p className="text-xs text-muted-foreground">{stats.rechazados} rechazados · {stats.sin_respuesta} sin respuesta</p></div>
              <div className="rounded-2xl bg-muted/60 p-3"><p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Timer className="h-3.5 w-3.5" />Tiempo de respuesta</p><p className="font-display text-2xl font-extrabold">{seconds(stats.respuesta_seg)}</p><p className="text-xs text-muted-foreground">Desde que llega hasta que aceptás</p></div>
              <div className="rounded-2xl bg-muted/60 p-3"><p className="flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Preparación real</p><p className="font-display text-2xl font-extrabold">{stats.preparacion_min == null ? "—" : `${stats.preparacion_min} min`}</p><p className="text-xs text-muted-foreground">Promedio de aceptado a listo</p></div>
              <div className="rounded-2xl bg-muted/60 p-3"><p className="text-xs font-semibold text-muted-foreground">Cancelados por clientes</p><p className="font-display text-2xl font-extrabold">{stats.cancelados_cliente}</p><p className="text-xs text-muted-foreground">{stats.entregados} entregados</p></div>
            </div>
          </section>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Ventas por día</h3>
              <p className="text-sm text-muted-foreground">En pesos, sin envío ni propinas</p>
              <div className="mt-4 h-64" role="img" aria-label={`Ventas diarias de los últimos ${stats.dias} días`}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chart} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={axis} interval="preserveStartEnd" minTickGap={24} />
                    <YAxis tickLine={false} axisLine={false} width={56} tick={axis} tickFormatter={(value: number) => (value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`)} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-pop"><p className="font-bold">{label}</p><p>{money(payload[0].payload.ventas)}</p><p className="text-muted-foreground">{payload[0].payload.pedidos} pedidos</p></div>
                    ) : null} />
                    <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={32} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>

            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Horarios con más pedidos</h3>
              <p className="text-sm text-muted-foreground">Para organizar tu cocina y tu personal</p>
              <div className="mt-4 flex h-40 items-end gap-0.5" role="img" aria-label="Pedidos por hora del día">
                {stats.por_hora.map((item) => (
                  <div key={item.hora} className="group relative flex h-full flex-1 items-end" title={`${item.hora}:00 · ${item.pedidos} pedidos`}>
                    <div className={cn("w-full rounded-t", item.pedidos === maxHour && item.pedidos > 0 ? "bg-primary" : "bg-primary/35")} style={{ height: `${Math.max(item.pedidos ? 6 : 2, (item.pedidos / maxHour) * 100)}%` }} />
                  </div>
                ))}
              </div>
              <div className="mt-1 flex justify-between text-[11px] text-muted-foreground"><span>0 h</span><span>6 h</span><span>12 h</span><span>18 h</span><span>23 h</span></div>
              {stats.por_hora.some((item) => item.pedidos) && <p className="mt-3 text-sm">Tu hora pico: <span className="font-extrabold">{stats.por_hora.reduce((best, item) => (item.pedidos > best.pedidos ? item : best)).hora}:00 h</span></p>}
            </section>
          </div>

          <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h3 className="font-extrabold">Productos más vendidos</h3>
              {stats.top_productos.length ? (
                <ol className="mt-4 space-y-3">
                  {stats.top_productos.map((item, index) => (
                    <li key={item.nombre}>
                      <div className="flex items-baseline justify-between gap-2 text-sm"><span className="truncate font-semibold">{index + 1}. {item.nombre}</span><span className="shrink-0 tabular-nums text-muted-foreground">{item.unidades} u. · {money(item.ingresos)}</span></div>
                      <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(item.unidades / maxUnits) * 100}%` }} /></div>
                    </li>
                  ))}
                </ol>
              ) : <p className="mt-4 text-sm text-muted-foreground">Sin ventas en el período.</p>}
            </section>

            <section className="space-y-6">
              <div className="rounded-3xl border bg-card p-4 sm:p-5">
                <h3 className="font-extrabold">Cómo te piden</h3>
                <div className="mt-3 h-3 overflow-hidden rounded-full bg-muted"><div className="h-full bg-primary" style={{ width: `${100 - pickupShare}%` }} /></div>
                <p className="mt-2 flex justify-between text-sm"><span>Envío {100 - pickupShare}%</span><span>Retiro {pickupShare}%</span></p>
                <h3 className="mt-5 font-extrabold">Medios de pago</h3>
                <ul className="mt-2 space-y-1.5 text-sm">
                  {Object.entries(stats.metodo_pago).sort((a, b) => b[1] - a[1]).map(([method, count]) => (
                    <li key={method} className="flex justify-between"><span>{metodoPagoLabel[method as keyof typeof metodoPagoLabel] ?? method}</span><span className="tabular-nums text-muted-foreground">{count} · {totalPayments ? Math.round((count / totalPayments) * 100) : 0}%</span></li>
                  ))}
                </ul>
              </div>
              {ratingTotal > 0 && (
                <div className="rounded-3xl border bg-card p-4 sm:p-5">
                  <h3 className="font-extrabold">Opiniones del período</h3>
                  <ul className="mt-3 space-y-1.5">
                    {[5, 4, 3, 2, 1].map((star) => {
                      const count = stats.calificacion.distribucion[String(star)] || 0;
                      return <li key={star} className="flex items-center gap-2 text-sm"><span className="w-6 tabular-nums">{star}★</span><div className="h-2 flex-1 rounded-full bg-muted"><div className="h-2 rounded-full bg-warning" style={{ width: `${(count / ratingTotal) * 100}%` }} /></div><span className="w-6 text-right tabular-nums text-muted-foreground">{count}</span></li>;
                    })}
                  </ul>
                </div>
              )}
            </section>
          </div>
        </>
      )}
    </div>
  );
}
