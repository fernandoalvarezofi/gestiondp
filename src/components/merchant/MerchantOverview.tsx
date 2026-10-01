import { useMemo } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Receipt, Star, TrendingUp, Wallet } from "lucide-react";
import { StatCard } from "@/components/delivery/Common";
import { DeliveryOrder, DeliveryStore, money } from "@/lib/delivery";

// Fecha local (no UTC), para que los pedidos de la noche no caigan en el día siguiente.
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

export function MerchantOverview({ store, orders }: { store: DeliveryStore; orders: DeliveryOrder[] }) {
  const stats = useMemo(() => {
    const valid = orders.filter((order) => order.estado !== "cancelado");
    const today = dayKey(new Date());
    const todayOrders = valid.filter((order) => dayKey(new Date(order.created_at)) === today);
    const todaySales = todayOrders.reduce((total, order) => total + Number(order.subtotal), 0);

    const days = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() - (6 - index));
      return date;
    });
    const chart = days.map((date) => {
      const key = dayKey(date);
      const dayOrders = valid.filter((order) => dayKey(new Date(order.created_at)) === key);
      return {
        dia: date.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }),
        ventas: dayOrders.reduce((total, order) => total + Number(order.subtotal), 0),
        pedidos: dayOrders.length,
      };
    });
    const weekSales = chart.reduce((total, day) => total + day.ventas, 0);
    const weekOrders = chart.reduce((total, day) => total + day.pedidos, 0);

    const productTotals = new Map<string, number>();
    valid.forEach((order) => (order.items || []).forEach((item) => productTotals.set(item.nombre, (productTotals.get(item.nombre) || 0) + item.cantidad)));
    const top = [...productTotals.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const cancelled = orders.filter((order) => order.estado === "cancelado").length;

    return { todaySales, todayCount: todayOrders.length, chart, weekSales, average: weekOrders ? weekSales / weekOrders : 0, top, cancelRate: orders.length ? Math.round((cancelled / orders.length) * 100) : 0 };
  }, [orders]);

  const maxTop = stats.top[0]?.[1] || 1;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Ventas de hoy" value={money(stats.todaySales)} icon={<Wallet className="h-4 w-4" />} hint={`${stats.todayCount} ${stats.todayCount === 1 ? "pedido" : "pedidos"}`} />
        <StatCard label="Últimos 7 días" value={money(stats.weekSales)} icon={<TrendingUp className="h-4 w-4" />} hint="Sin envío ni propinas" />
        <StatCard label="Ticket promedio" value={money(stats.average)} icon={<Receipt className="h-4 w-4" />} hint={`Cancelados: ${stats.cancelRate}%`} />
        <StatCard label="Calificación" value={store.total_resenas ? Number(store.rating).toFixed(1) : "—"} icon={<Star className="h-4 w-4" />} hint={`${store.total_resenas} opiniones`} />
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <section className="rounded-3xl border bg-card p-4 sm:p-5">
          <h3 className="font-extrabold">Ventas por día</h3>
          <p className="text-sm text-muted-foreground">Últimos 7 días, en pesos</p>
          <div className="mt-4 h-64" role="img" aria-label={`Ventas de los últimos 7 días: ${stats.chart.map((day) => `${day.dia} ${money(day.ventas)}`).join(", ")}`}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={stats.chart} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="0" />
                <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                <YAxis tickLine={false} axisLine={false} width={56} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} tickFormatter={(value: number) => (value >= 1000 ? `$${Math.round(value / 1000)}k` : `$${value}`)} />
                <Tooltip
                  cursor={{ fill: "hsl(var(--muted))" }}
                  content={({ active, payload, label }) => active && payload?.length ? (
                    <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-pop">
                      <p className="font-bold">{label}</p>
                      <p>{money(payload[0].payload.ventas)}</p>
                      <p className="text-muted-foreground">{payload[0].payload.pedidos} pedidos</p>
                    </div>
                  ) : null}
                />
                <Bar dataKey="ventas" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border bg-card p-4 sm:p-5">
          <h3 className="font-extrabold">Lo más vendido</h3>
          <p className="text-sm text-muted-foreground">Unidades en pedidos recientes</p>
          {stats.top.length ? (
            <ol className="mt-4 space-y-3">
              {stats.top.map(([name, quantity], index) => (
                <li key={name}>
                  <div className="flex justify-between gap-2 text-sm"><span className="truncate font-semibold">{index + 1}. {name}</span><span className="tabular-nums text-muted-foreground">{quantity} u.</span></div>
                  <div className="mt-1 h-2 rounded-full bg-muted"><div className="h-2 rounded-full bg-primary" style={{ width: `${(quantity / maxTop) * 100}%` }} /></div>
                </li>
              ))}
            </ol>
          ) : <p className="mt-6 text-sm text-muted-foreground">Cuando recibas pedidos vas a ver tus productos estrella acá.</p>}
        </section>
      </div>
    </div>
  );
}
