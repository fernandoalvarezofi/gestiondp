import { ReactNode, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { CarTaxiFront, ChevronRight, Package, Receipt, RotateCcw } from "lucide-react";
import { Envio, envioActivo, envioEstadoLabel } from "@/lib/envios";
import { Viaje, viajeActivo, viajeEstadoLabel } from "@/lib/remis";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useReorder } from "@/hooks/useReorder";
import { db, DeliveryOrder, formatDateTime, img, money, orderSelect, pedidoActivo } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Filtro = "todos" | "activos" | "completados" | "cancelados";
const FILTROS: { id: Filtro; label: string }[] = [
  { id: "todos", label: "Todos" }, { id: "activos", label: "En curso" }, { id: "completados", label: "Completados" }, { id: "cancelados", label: "Cancelados" },
];
type Grupo = "activos" | "completados" | "cancelados";
/** Una fila de la lista: pedido a un comercio, envío de paquete o viaje de remís. */
type Item = { id: string; at: string; grupo: Grupo; node: ReactNode };

/** Mis pedidos (contexto Cliente): pedidos, envíos y viajes en un mismo lugar, con filtros por estado. */
export default function Orders() {
  const { user } = useAuth();
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [envios, setEnvios] = useState<Envio[]>([]);
  const [viajes, setViajes] = useState<Viaje[]>([]);
  const [loading, setLoading] = useState(true);
  const [filtro, setFiltro] = useState<Filtro>("todos");
  const reorder = useReorder();

  useEffect(() => {
    if (!user) return;
    const load = async () => {
      const [{ data }, { data: parcels }, { data: trips }] = await Promise.all([
        db.from("delivery_pedidos").select(orderSelect).eq("cliente_id", user.id).order("created_at", { ascending: false }).limit(50),
        db.from("delivery_envios").select("*").eq("cliente_id", user.id).order("created_at", { ascending: false }).limit(30),
        db.from("delivery_viajes").select("*").eq("cliente_id", user.id).order("created_at", { ascending: false }).limit(30),
      ]);
      setOrders(data || []);
      setEnvios(parcels || []);
      setViajes(trips || []);
      setLoading(false);
    };
    load();
    const channel = db.channel(`pedidos-cliente-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos", filter: `cliente_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_envios", filter: `cliente_id=eq.${user.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_viajes", filter: `cliente_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [user]);

  const items = useMemo<Item[]>(() => [
    ...orders.map((order) => ({
      id: order.id, at: order.created_at,
      grupo: (pedidoActivo(order.estado) ? "activos" : order.estado === "cancelado" ? "cancelados" : "completados") as Grupo,
      node: <OrderRow order={order} highlight={pedidoActivo(order.estado)} onReorder={order.estado === "entregado" ? () => reorder(order) : undefined} />,
    })),
    ...envios.map((envio) => ({
      id: envio.id, at: envio.created_at,
      grupo: (envioActivo(envio.estado) ? "activos" : envio.estado === "cancelado" ? "cancelados" : "completados") as Grupo,
      node: (
        <ServiceRow to={`/app/envios/${envio.id}`} active={envioActivo(envio.estado)} icon={<Package className="h-6 w-6" />} title={envio.descripcion}
          detail={`${envio.origen_direccion.split(",")[0]} → ${envio.destino_direccion.split(",")[0]}`} when={envio.created_at} total={envio.total} status={envioEstadoLabel[envio.estado]} />
      ),
    })),
    ...viajes.map((viaje) => ({
      id: viaje.id, at: viaje.created_at,
      grupo: (viajeActivo(viaje.estado) ? "activos" : viaje.estado === "cancelado" ? "cancelados" : "completados") as Grupo,
      node: (
        <ServiceRow to={`/app/remis/${viaje.id}`} active={viajeActivo(viaje.estado)} icon={<CarTaxiFront className="h-6 w-6" />} title="Viaje en remís"
          detail={`${viaje.origen_direccion.split(",")[0]} → ${viaje.destino_direccion.split(",")[0]}`} when={viaje.created_at} total={viaje.total} status={viajeEstadoLabel[viaje.estado]} />
      ),
    })),
  ].sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime()), [orders, envios, viajes, reorder]);

  const count = (grupo: Grupo) => items.filter((item) => item.grupo === grupo).length;
  const visible = filtro === "todos" ? items : items.filter((item) => item.grupo === filtro);
  const activos = visible.filter((item) => item.grupo === "activos");
  const resto = visible.filter((item) => item.grupo !== "activos");

  return (
    <div className="mx-auto max-w-4xl px-4 pb-14 pt-5 sm:px-6">
      <PageHeader eyebrow="Seguimiento" title="Mis pedidos" />
      {loading ? (
        <div className="mt-6 space-y-3">{[0, 1, 2].map((key) => <div key={key} className="h-28 animate-pulse rounded-3xl bg-muted" />)}</div>
      ) : items.length === 0 ? (
        <EmptyState className="mt-6" icon={<Receipt className="h-7 w-7" />} title="Todavía no hiciste pedidos" text="Cuando confirmes un pedido, un envío o un viaje, vas a poder seguirlo desde acá en tiempo real." action={<Button asChild className="rounded-full"><Link to="/app/explorar">Explorar</Link></Button>} />
      ) : (
        <>
          <div className="scrollbar-none mt-5 flex gap-2 overflow-x-auto" role="group" aria-label="Filtrar por estado">
            {FILTROS.map(({ id, label }) => {
              const n = id === "todos" ? items.length : count(id);
              return (
                <button key={id} type="button" onClick={() => setFiltro(id)} aria-pressed={filtro === id} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors", filtro === id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>
                  {label}{n > 0 && <span className="ml-1.5 tabular-nums opacity-70">{n}</span>}
                </button>
              );
            })}
          </div>
          {visible.length === 0 && <p className="mt-8 text-center text-sm text-muted-foreground">No hay nada con este filtro.</p>}
          {activos.length > 0 && (
            <section className="mt-6">
              <h2 className="text-lg font-extrabold">En curso</h2>
              <div className="mt-3 space-y-3">{activos.map((item) => <div key={item.id}>{item.node}</div>)}</div>
            </section>
          )}
          {resto.length > 0 && (
            <section className="mt-8">
              {filtro === "todos" && <h2 className="text-lg font-extrabold">Anteriores</h2>}
              <div className="mt-3 space-y-3">{resto.map((item) => <div key={item.id}>{item.node}</div>)}</div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function ServiceRow({ to, active, icon, title, detail, when, total, status }: { to: string; active: boolean; icon: ReactNode; title: string; detail: string; when: string; total: number; status: string }) {
  return (
    <Link to={to} className={cn("flex items-center gap-3 rounded-3xl border bg-card p-3 transition-shadow hover:shadow-soft sm:p-4", active && "border-primary/40")}>
      <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">{icon}</span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-extrabold">{title}</p>
        <p className="truncate text-sm text-muted-foreground">{detail}</p>
        <p className="mt-0.5 text-xs font-semibold text-muted-foreground">{formatDateTime(when)} · <span className="text-foreground">{money(total)}</span> · <span className={active ? "text-primary" : ""}>{status}</span></p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
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
