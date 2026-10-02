import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ChevronRight, Package, Receipt, RotateCcw } from "lucide-react";
import { Envio, envioActivo, envioEstadoLabel } from "@/lib/envios";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useReorder } from "@/hooks/useReorder";
import { db, DeliveryOrder, formatDateTime, img, money, orderSelect, pedidoActivo } from "@/lib/delivery";

export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [loading, setLoading] = useState(true);
  const reorder = useReorder();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data }, { data: parcels }] = await Promise.all([
        db.from("delivery_pedidos").select(orderSelect).eq("cliente_id", user.id).order("created_at", { ascending: false }).limit(50),
        db.from("delivery_envios").select("*").eq("cliente_id", user.id).order("created_at", { ascending: false }).limit(30),
      ]);
      setOrders(data || []);
      setEnvios(parcels || []);
      setLoading(false);
    };
    load();
    const channel = db.channel(`pedidos-cliente-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos", filter: `cliente_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_envios", filter: `cliente_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [user]);

  const active = useMemo(() => orders.filter((order) => pedidoActivo(order.estado)), [orders]);
  const past = useMemo(() => orders.filter((order) => !pedidoActivo(order.estado)), [orders]);

  return (
    <div className="mx-auto max-w-4xl px-4 pb-14 pt-5 sm:px-6">
      <PageHeader eyebrow="Seguimiento" title="Mis pedidos" />
      {loading ? (
        <div className="mt-6 space-y-3">{[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-3xl bg-muted" />)}</div>
      ) : orders.length === 0 && envios.length === 0 ? (
        <EmptyState className="mt-6" icon={<Receipt className="h-7 w-7" />} title="Todavía no hiciste pedidos" text="Cuando confirmes uno, vas a poder seguirlo desde acá en tiempo real." action={<Button asChild className="rounded-full"><Link to="/app">Explorar comercios</Link></Button>} />
      ) : (
        <>
          {envios.length > 0 && (
            <section className="mt-6">
              <h2 className="flex items-center gap-2 text-lg font-extrabold"><Package className="h-5 w-5 text-primary" />Envíos de paquetes</h2>
              <div className="mt-3 space-y-3">
                {envios.map((envio) => (
                  <Link key={envio.id} to={`/app/envios/${envio.id}`} className={`flex items-center gap-3 rounded-3xl border bg-card p-3 transition-shadow hover:shadow-soft sm:p-4 ${envioActivo(envio.estado) ? "border-primary/40" : ""}`}>
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300"><Package className="h-6 w-6" /></span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-extrabold">{envio.descripcion}</p>
                      <p className="truncate text-sm text-muted-foreground">{envio.origen_direccion.split(",")[0]} → {envio.destino_direccion.split(",")[0]}</p>
                      <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{formatDateTime(envio.created_at)} · <span className="text-foreground">{money(envio.total)}</span> · <span className={envioActivo(envio.estado) ? "text-primary" : ""}>{envioEstadoLabel[envio.estado]}</span></p>
                    </div>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
                  </Link>
                ))}
              </div>
            </section>
          )}
          {active.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-extrabold">En curso</h2>
              <div className="mt-3 space-y-3">{active.map((order) => <OrderRow key={order.id} order={order} highlight />)}</div>
            </section>
          )}
          {past.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-extrabold">Anteriores</h2>
              <div className="mt-3 space-y-3">{past.map((order) => <OrderRow key={order.id} order={order} onReorder={order.estado === "entregado" ? () => reorder(order) : undefined} />)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function OrderRow({ order, highlight, onReorder }: { order: DeliveryOrder; highlight?: boolean; onReorder?: () => void }) {
  const summary = (order.items || []).map((item) => `${item.cantidad}× ${item.nombre}`).join(" · ");
  return (
    <article className={`rounded-3xl border bg-card p-3 transition-shadow hover:shadow-soft sm:p-4 ${highlight ? "border-primary/40" : ""}`}>
      <Link to={`/app/pedidos/${order.id}`} className="flex items-center gap-3">
        <img src={img(order.comercio?.imagen_url, 200)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-2xl object-cover sm:h-20 sm:w-20" />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2"><h3 className="truncate font-extrabold">{order.comercio?.nombre}</h3><StatusBadge estado={order.estado} /></div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{summary}</p>
          <p className="mt-1 text-xs font-semibold text-muted-foreground">{formatDateTime(order.created_at)} · <span className="text-foreground">{money(order.total)}</span></p>
        </div>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>
      {onReorder && (
        <div className="mt-3 flex justify-end border-t pt-3">
          <Button variant="outline" size="sm" className="rounded-full" onClick={onReorder}><RotateCcw className="h-4 w-4" />Repetir pedido</Button>
        </div>
      )}
    </article>
  );
}
