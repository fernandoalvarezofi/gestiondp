import { useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowDownLeft, ArrowUpRight, Bike, Clock3, Gauge, Loader2, Route, Wallet } from "lucide-react";
import { EmptyState, StatCard } from "@/components/delivery/Common";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Wallet = {
  dias: number;
  hoy: { viajes: number; ganancia: number };
  periodo: { viajes: number; ganancia: number; propinas: number; km: number; minutos_promedio: number | null; por_dia: { dia: string; viajes: number; ganancia: number }[] };
  cuenta: { ganancias_total: number; pagos: number; efectivo_cobrado: number; rendiciones: number };
  desempeno: { aceptadas: number; rechazadas: number; soltados: number } | null;
  movimientos: { id: string; tipo: "pago" | "rendicion"; monto: number; nota: string | null; fecha: string }[];
};

const PERIODS = [7, 30, 90] as const;
const axis = { fill: "hsl(var(--muted-foreground))", fontSize: 12 };

/** Ganancias, saldo con Woref y efectivo a rendir. Sirve para el propio repartidor y, con `courierId`, para administración. */
/** `unidad`: cómo se llama cada trabajo para quien mira (entregas para el repartidor, viajes para el conductor). */
export function CourierWallet({ courierId, refreshKey, unidad = ["trabajo", "trabajos"] }: { courierId?: string; refreshKey?: number; unidad?: [string, string] }) {
  const cuantos = (n: number) => `${n} ${n === 1 ? unidad[0] : unidad[1]}`;
  const [days, setDays] = useState<(typeof PERIODS)[number]>(30);
  const [wallet, setWallet] = useState<Wallet | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setWallet(null);
    setError(null);
    db.rpc("delivery_billetera_repartidor", { p_repartidor: courierId ?? null, p_dias: days }).then(({ data, error: failure }: { data: Wallet | null; error: unknown }) => {
      if (!active) return;
      if (failure || !data) setError(errorMessage(failure, "No pudimos cargar tu billetera"));
      else setWallet(data);
    });
    return () => { active = false; };
  }, [courierId, days, refreshKey]);

  const period = (
    <div className="flex gap-2" role="tablist" aria-label="Período">
      {PERIODS.map((value) => (
        <button key={value} type="button" role="tab" aria-selected={days === value} onClick={() => setDays(value)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", days === value ? "border-foreground bg-foreground text-background" : "bg-card")}>{value} días</button>
      ))}
    </div>
  );

  if (error) return <div>{period}<EmptyState className="mt-4" title="No pudimos cargar la billetera" text={error} /></div>;
  if (!wallet) return <div>{period}<div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div></div>;

  const toCollect = Number(wallet.cuenta.ganancias_total) - Number(wallet.cuenta.pagos);
  const toSettle = Number(wallet.cuenta.efectivo_cobrado) - Number(wallet.cuenta.rendiciones);
  const balance = toCollect - toSettle;
  const chart = wallet.periodo.por_dia.map((item) => ({ ...item, etiqueta: new Date(`${item.dia}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short" }) }));
  const answered = wallet.desempeno ? wallet.desempeno.aceptadas + wallet.desempeno.rechazadas : 0;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl bg-brand-deep p-5 text-white">
        <p className="text-sm font-semibold text-white/70">{balance >= 0 ? "Woref te debe" : "Tenés que rendir a Woref"}</p>
        <p className="font-display text-4xl font-black">{money(Math.abs(balance))}</p>
        <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
          <div className="rounded-2xl bg-white/10 p-3"><p className="text-white/70">Ganancias a cobrar</p><p className="text-lg font-extrabold">{money(toCollect)}</p><p className="text-xs text-white/60">{money(wallet.cuenta.ganancias_total)} ganados − {money(wallet.cuenta.pagos)} ya pagados</p></div>
          <div className="rounded-2xl bg-white/10 p-3"><p className="text-white/70">Efectivo que tenés que rendir</p><p className="text-lg font-extrabold">{money(toSettle)}</p><p className="text-xs text-white/60">{money(wallet.cuenta.efectivo_cobrado)} cobrados − {money(wallet.cuenta.rendiciones)} ya rendidos</p></div>
        </div>
        <p className="mt-3 text-xs text-white/60">Los pagos y las rendiciones los registra administración cuando se concretan.</p>
      </section>

      {period}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Hoy" value={money(wallet.hoy.ganancia)} icon={<Wallet className="h-4 w-4" />} hint={cuantos(wallet.hoy.viajes)} />
        <StatCard label={`Últimos ${wallet.dias} días`} value={money(wallet.periodo.ganancia)} icon={<Bike className="h-4 w-4" />} hint={`${cuantos(wallet.periodo.viajes)} · ${money(wallet.periodo.propinas)} en propinas`} />
        <StatCard label="Recorrido" value={`${Number(wallet.periodo.km).toLocaleString("es-AR")} km`} icon={<Route className="h-4 w-4" />} hint={wallet.periodo.viajes ? `${money(Number(wallet.periodo.ganancia) / wallet.periodo.viajes)} por viaje` : undefined} />
        <StatCard label="Tiempo de entrega" value={wallet.periodo.minutos_promedio == null ? "—" : `${wallet.periodo.minutos_promedio} min`} icon={<Clock3 className="h-4 w-4" />} hint="Desde que retirás hasta que entregás" />
      </div>

      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h3 className="font-extrabold">Ganancias por día</h3>
        {chart.every((d) => !Number(d.ganancia)) ? (
          <p className="mt-4 grid h-40 place-items-center rounded-2xl border border-dashed text-center text-sm text-muted-foreground">Sin ganancias en los últimos {wallet.dias} días.<br />Conectate para empezar a recibir ofertas.</p>
        ) : (
        <div className="mt-4 h-56" role="img" aria-label={`Ganancias diarias de los últimos ${wallet.dias} días`}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chart} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
              <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
              <XAxis dataKey="etiqueta" tickLine={false} axisLine={false} tick={axis} interval="preserveStartEnd" minTickGap={24} />
              <YAxis tickLine={false} axisLine={false} width={56} tick={axis} tickFormatter={(value: number) => (value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`)} />
              <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={({ active, payload, label }) => active && payload?.length ? (
                <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-pop"><p className="font-bold">{label}</p><p>{money(payload[0].payload.ganancia)}</p><p className="text-muted-foreground">{cuantos(payload[0].payload.viajes)}</p></div>
              ) : null} />
              <Bar dataKey="ganancia" fill="hsl(var(--success))" radius={[4, 4, 0, 0]} maxBarSize={32} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-3xl border bg-card p-4 sm:p-5">
          <h3 className="flex items-center gap-2 font-extrabold"><Gauge className="h-5 w-5 text-primary" />Tu desempeño</h3>
          {wallet.desempeno ? (
            <dl className="mt-3 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Ofertas aceptadas</dt><dd className="font-bold">{wallet.desempeno.aceptadas}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Ofertas rechazadas</dt><dd className="font-bold">{wallet.desempeno.rechazadas}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Tasa de aceptación</dt><dd className="font-bold">{answered ? `${Math.round((wallet.desempeno.aceptadas / answered) * 100)}%` : "—"}</dd></div>
              <div className="flex justify-between"><dt className="text-muted-foreground">Pedidos soltados</dt><dd className={cn("font-bold", wallet.desempeno.soltados > 2 && "text-destructive")}>{wallet.desempeno.soltados}</dd></div>
            </dl>
          ) : <p className="mt-3 text-sm text-muted-foreground">Sin datos todavía.</p>}
        </section>

        <section className="rounded-3xl border bg-card p-4 sm:p-5">
          <h3 className="font-extrabold">Movimientos con Woref</h3>
          {wallet.movimientos.length ? (
            <ul className="mt-3 divide-y text-sm">
              {wallet.movimientos.map((item) => (
                <li key={item.id} className="flex items-center gap-3 py-2.5">
                  <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full", item.tipo === "pago" ? "bg-success/10 text-success" : "bg-warning/20")}>{item.tipo === "pago" ? <ArrowDownLeft className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span>
                  <span className="min-w-0 flex-1"><span className="block font-bold">{item.tipo === "pago" ? "Woref te pagó" : "Rendiste efectivo"}</span><span className="block truncate text-xs text-muted-foreground">{formatDateTime(item.fecha)}{item.nota && ` · ${item.nota}`}</span></span>
                  <span className={cn("font-bold tabular-nums", item.tipo === "pago" && "text-success")}>{item.tipo === "pago" ? "+" : "−"}{money(item.monto)}</span>
                </li>
              ))}
            </ul>
          ) : <p className="mt-3 text-sm text-muted-foreground">Todavía no hay pagos ni rendiciones registradas.</p>}
        </section>
      </div>
    </div>
  );
}
