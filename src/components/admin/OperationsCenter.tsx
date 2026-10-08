import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Bike, CheckCircle2, Clock3, Crosshair, Loader2, Package, Radio, UserMinus, UserPlus } from "lucide-react";
import { toast } from "sonner";
import type { OpsPoint } from "@/components/admin/OpsMap";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { EmptyState, StatCard } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { OrderHistory } from "@/components/delivery/OrderEvents";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { db, EstadoPedido, errorMessage, formatTime, money, shortId } from "@/lib/delivery";
import { DEFAULT_CENTER, distanceKm, formatKm } from "@/lib/geo";
import { cn } from "@/lib/utils";

const OpsMap = lazy(() => import("@/components/admin/OpsMap"));

type OpsOrder = {
  id: string; estado: EstadoPedido; tipo_entrega: "delivery" | "retiro"; comercio_id: string; comercio: string; c_lat: number | null; c_lng: number | null; lat: number | null; lng: number | null;
  direccion: string; repartidor_id: string | null; created_at: string; visible_at: string | null; confirmado_at: string | null; listo_at: string | null; entrega_estimada: string | null;
  total: number; programado_para: string | null; cliente: string | null; llegada_comercio_at: string | null; en_camino_at: string | null; metodo_pago: string;
};
type OpsCourier = { id: string; nombre: string; vehiculo: string; telefono: string | null; lat: number | null; lng: number | null; loc_at: string | null; ocupado: boolean; pedido_id: string | null; envio_id: string | null };
type OpsParcel = { id: string; estado: string; origen: string; destino: string; o_lat: number; o_lng: number; d_lat: number; d_lng: number; repartidor_id: string | null; created_at: string; total: number };
type Snapshot = { ahora: string; pedidos: OpsOrder[]; repartidores: OpsCourier[]; envios: OpsParcel[]; hoy: { entregados: number; cancelados: number; minutos_promedio: number | null } };
type Alert = { key: string; level: "critico" | "atencion"; title: string; detail: string; focus: string };
type Tab = "alertas" | "pedidos" | "repartidores";

/** Una ubicación a más de 80 km del centro de Lincoln es un GPS desfasado: no se dibuja para no descolocar el mapa. */
const inZone = (lat: number, lng: number) => distanceKm({ lat, lng }, DEFAULT_CENTER) <= 80;
const minutesSince =(value: string | null | undefined, now: number) => (value ? Math.max(0, Math.floor((now - new Date(value).getTime()) / 60000)) : 0);
/** Un pedido programado solo cuenta cuando se acerca su hora. */
const isDue = (order: OpsOrder, now: number) => !order.programado_para || new Date(order.programado_para).getTime() - now < 50 * 60000;

function buildAlerts(data: Snapshot, now: number): Alert[] {
  const alerts: Alert[] = [];
  const names = new Map(data.repartidores.map((courier) => [courier.id, courier.nombre]));
  for (const order of data.pedidos) {
    if (!isDue(order, now)) continue;
    const label = `${shortId(order.id)} · ${order.comercio}`;
    if (order.estado === "pendiente") {
      const wait = minutesSince(order.visible_at ?? order.created_at, now);
      if (wait >= 5) alerts.push({ key: `p-${order.id}`, level: wait >= 8 ? "critico" : "atencion", title: `Sin responder hace ${wait} min`, detail: label, focus: `o-${order.id}` });
    }
    if (order.tipo_entrega === "delivery" && (order.estado === "confirmado" || order.estado === "preparando") && !order.repartidor_id) {
      const wait = minutesSince(order.confirmado_at, now);
      if (wait >= 3) alerts.push({ key: `r-${order.id}`, level: wait >= 6 ? "critico" : "atencion", title: `Sin repartidor hace ${wait} min`, detail: label, focus: `o-${order.id}` });
    }
    if (order.entrega_estimada && order.estado !== "listo" && order.estado !== "pendiente") {
      const late = Math.floor((now - new Date(order.entrega_estimada).getTime()) / 60000);
      if (late >= 5) alerts.push({ key: `l-${order.id}`, level: late >= 15 ? "critico" : "atencion", title: `Atrasado ${late} min`, detail: `${label}${order.repartidor_id ? ` · ${names.get(order.repartidor_id) ?? "repartidor"}` : ""}`, focus: `o-${order.id}` });
    }
  }
  for (const courier of data.repartidores) {
    if (courier.ocupado && (!courier.loc_at || now - new Date(courier.loc_at).getTime() > 3 * 60000)) {
      alerts.push({ key: `g-${courier.id}`, level: "atencion", title: "Repartidor sin señal de GPS", detail: `${courier.nombre}${courier.loc_at ? ` · última hace ${minutesSince(courier.loc_at, now)} min` : " · sin ubicación"}`, focus: `c-${courier.id}` });
    }
  }
  for (const parcel of data.envios) {
    if (parcel.estado !== "buscando") continue;
    const wait = minutesSince(parcel.created_at, now);
    if (wait >= 3) alerts.push({ key: `e-${parcel.id}`, level: wait >= 6 ? "critico" : "atencion", title: `Envío de paquete sin repartidor hace ${wait} min`, detail: `${parcel.origen.split(",")[0]} → ${parcel.destino.split(",")[0]}`, focus: `e-${parcel.id}` });
  }
  return alerts.sort((a, b) => Number(b.level === "critico") - Number(a.level === "critico"));
}

/** Centro de operaciones: mapa en vivo, alertas por demora y asignación manual de repartidores. */
export function OperationsCenter() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [tab, setTab] = useState<Tab>("alertas");
  const [focus, setFocus] = useState<string | null>(null);
  const [assigning, setAssigning] = useState<OpsOrder | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: snapshot, error } = await db.rpc("delivery_admin_operaciones");
    if (error) { toast.error(errorMessage(error)); return; }
    setData(snapshot);
    setNow(Date.now());
  }, []);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, 8000);
    let debounce = 0;
    const refresh = () => { window.clearTimeout(debounce); debounce = window.setTimeout(load, 800); };
    const channel = db.channel("ops-center")
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos" }, refresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_envios" }, refresh)
      .subscribe();
    return () => { window.clearInterval(timer); window.clearTimeout(debounce); db.removeChannel(channel); };
  }, [load]);
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 15000);
    return () => window.clearInterval(timer);
  }, []);

  const alerts = useMemo(() => (data ? buildAlerts(data, now) : []), [data, now]);
  const severityOf = useCallback((orderId: string) => (alerts.some((alert) => alert.focus === `o-${orderId}` && alert.level === "critico") ? "late" : alerts.some((alert) => alert.focus === `o-${orderId}`) ? "warn" : "ok"), [alerts]);

  const points = useMemo<OpsPoint[]>(() => {
    if (!data) return [];
    const list: OpsPoint[] = [];
    for (const courier of data.repartidores) if (courier.lat != null && courier.lng != null && inZone(Number(courier.lat), Number(courier.lng))) list.push({ key: `c-${courier.id}`, lat: Number(courier.lat), lng: Number(courier.lng), kind: courier.ocupado ? "courier-busy" : "courier-free", label: `${courier.nombre} · ${courier.ocupado ? "ocupado" : "libre"}` });
    const stores = new Set<string>();
    for (const order of data.pedidos) {
      if (order.tipo_entrega === "delivery" && order.lat != null && order.lng != null) list.push({ key: `o-${order.id}`, lat: Number(order.lat), lng: Number(order.lng), kind: `order-${severityOf(order.id)}` as OpsPoint["kind"], label: `${shortId(order.id)} · ${order.direccion}` });
      if (["pendiente", "confirmado", "preparando"].includes(order.estado) && order.c_lat != null && order.c_lng != null && !stores.has(order.comercio_id)) { stores.add(order.comercio_id); list.push({ key: `s-${order.comercio_id}`, lat: Number(order.c_lat), lng: Number(order.c_lng), kind: "store", label: order.comercio }); }
    }
    for (const parcel of data.envios) list.push({ key: `e-${parcel.id}`, lat: Number(parcel.o_lat), lng: Number(parcel.o_lng), kind: "parcel", label: `Envío · ${parcel.origen}` });
    return list;
  }, [data, severityOf]);

  const select = (key: string) => {
    setFocus(key);
    if (key.startsWith("o-")) setTab("pedidos"); else if (key.startsWith("c-")) setTab("repartidores"); else if (key.startsWith("e-")) setTab("alertas");
  };

  const release = async (order: OpsOrder) => {
    const reason = window.prompt("Motivo para quitarle el pedido al repartidor (queda registrado)", "No responde");
    if (!reason) return;
    setBusy(order.id);
    const { error } = await db.rpc("delivery_admin_liberar_pedido", { p_pedido: order.id, p_motivo: reason });
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success("Pedido liberado: se lo ofrecemos a otro repartidor");
    load();
  };
  const assign = async (order: OpsOrder, courier: OpsCourier) => {
    setBusy(courier.id);
    const { error } = await db.rpc("delivery_admin_asignar_pedido", { p_pedido: order.id, p_repartidor: courier.id });
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success(`Pedido asignado a ${courier.nombre}`);
    setAssigning(null);
    load();
  };

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const names = new Map(data.repartidores.map((courier) => [courier.id, courier.nombre]));
  const deliveryOrders = data.pedidos.filter((order) => order.tipo_entrega === "delivery");
  const unassigned = deliveryOrders.filter((order) => !order.repartidor_id && (order.estado === "confirmado" || order.estado === "preparando") && isDue(order, now)).length;
  const free = data.repartidores.filter((courier) => !courier.ocupado).length;
  const critical = alerts.filter((alert) => alert.level === "critico").length;
  const orderCouriers = (order: OpsOrder) => data.repartidores
    .filter((courier) => !courier.ocupado)
    .map((courier) => ({ courier, km: courier.lat != null && order.c_lat != null && courier.lng != null && order.c_lng != null && inZone(Number(courier.lat), Number(courier.lng)) ? distanceKm({ lat: Number(courier.lat), lng: Number(courier.lng) }, { lat: Number(order.c_lat), lng: Number(order.c_lng) }) : null }))
    .sort((a, b) => (a.km ?? 9999) - (b.km ?? 9999));

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <StatCard label="Pedidos en curso" value={data.pedidos.length} icon={<Package className="h-4 w-4" />} hint={`${data.envios.length} envíos de paquetes`} />
        <StatCard label="Sin repartidor" value={unassigned} icon={<UserMinus className="h-4 w-4" />} hint={unassigned ? "Asignalos desde Pedidos" : "Todo asignado"} />
        <StatCard label="Alertas" value={alerts.length} icon={<AlertTriangle className="h-4 w-4" />} hint={critical ? `${critical} críticas` : "Sin críticas"} />
        <StatCard label="Repartidores libres" value={`${free}/${data.repartidores.length}`} icon={<Bike className="h-4 w-4" />} hint="Conectados" />
        <StatCard label="Entrega promedio hoy" value={data.hoy.minutos_promedio ? `${data.hoy.minutos_promedio} min` : "—"} icon={<Clock3 className="h-4 w-4" />} hint="Desde que piden" />
        <StatCard label="Hoy" value={`${data.hoy.entregados}`} icon={<CheckCircle2 className="h-4 w-4" />} hint={`${data.hoy.cancelados} cancelados`} />
      </div>

      <div className="grid gap-4 lg:grid-cols-5">
        <div className="relative lg:col-span-3">
          <Suspense fallback={<div className="h-[560px] animate-pulse rounded-3xl bg-muted" />}>
            <OpsMap points={points} focus={focus} onSelect={select} className="h-[420px] lg:h-[560px]" />
          </Suspense>
          <div className="absolute left-3 top-3 z-[500] flex flex-wrap gap-1.5 rounded-2xl bg-card/95 p-2 text-[11px] font-bold shadow-soft">
            {([["#16a34a", "Libre"], ["#2563eb", "Ocupado"], ["#7c3aed", "Pedido"], ["#dc2626", "Urgente"], ["#14332b", "Local"], ["#d97706", "Envío"]] as const).map(([color, label]) => <span key={label} className="flex items-center gap-1"><span className="h-2.5 w-2.5 rounded-full" style={{ background: color }} />{label}</span>)}
          </div>
          <Button size="sm" variant="secondary" className="absolute bottom-3 left-3 z-[500] rounded-full shadow-soft" onClick={() => setFocus(null)}><Crosshair className="h-4 w-4" />Ver todo</Button>
        </div>

        <section className="flex min-h-[420px] flex-col rounded-3xl border bg-card lg:col-span-2 lg:h-[560px]">
          <div className="flex gap-1 border-b p-2" role="tablist">
            {([["alertas", `Alertas (${alerts.length})`], ["pedidos", `Pedidos (${data.pedidos.length})`], ["repartidores", `Repartidores (${data.repartidores.length})`]] as const).map(([value, label]) => (
              <button key={value} type="button" role="tab" aria-selected={tab === value} onClick={() => setTab(value)} className={cn("flex-1 rounded-full px-3 py-2 text-xs font-extrabold", tab === value ? "bg-foreground text-background" : "hover:bg-muted", value === "alertas" && critical > 0 && tab !== value && "text-destructive")}>{label}</button>
            ))}
          </div>
          <div className="min-h-0 flex-1 overflow-y-auto p-3">
            {tab === "alertas" && (alerts.length === 0 ? <EmptyState icon={<Radio className="h-7 w-7" />} title="Todo en orden" text="No hay pedidos demorados ni sin atender." /> : (
              <ul className="space-y-2">
                {alerts.map((alert) => (
                  <li key={alert.key}><button type="button" onClick={() => select(alert.focus)} className={cn("w-full rounded-2xl border p-3 text-left", alert.level === "critico" ? "border-destructive/50 bg-destructive/5" : "border-warning/50 bg-warning/10")}><span className="flex items-center gap-2 text-sm font-extrabold"><AlertTriangle className={cn("h-4 w-4", alert.level === "critico" && "text-destructive")} />{alert.title}</span><span className="block text-xs text-muted-foreground">{alert.detail}</span></button></li>
                ))}
              </ul>
            ))}
            {tab === "pedidos" && (data.pedidos.length === 0 ? <EmptyState icon={<Package className="h-7 w-7" />} title="No hay pedidos en curso" /> : (
              <ul className="space-y-2">
                {data.pedidos.map((order) => (
                  <li key={order.id} className={cn("rounded-2xl border p-3", focus === `o-${order.id}` && "border-primary ring-2 ring-primary/30")}>
                    <button type="button" onClick={() => setFocus(`o-${order.id}`)} className="flex w-full items-start justify-between gap-2 text-left">
                      <span className="min-w-0"><span className="block truncate text-sm font-extrabold">{shortId(order.id)} · {order.comercio}</span><span className="block truncate text-xs text-muted-foreground">{order.tipo_entrega === "retiro" ? "Retira en el local" : order.direccion} · {money(order.total)}</span></span>
                      <StatusBadge estado={order.estado} />
                    </button>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                      <span className="font-semibold text-muted-foreground">hace {minutesSince(order.created_at, now)} min{order.entrega_estimada ? ` · promesa ${formatTime(order.entrega_estimada)}` : ""}</span>
                      {order.tipo_entrega === "delivery" && (order.repartidor_id
                        ? <span className="flex items-center gap-1 font-bold"><Bike className="h-3.5 w-3.5" />{names.get(order.repartidor_id) ?? "Repartidor"}</span>
                        : <span className="font-bold text-warning-foreground dark:text-warning">Sin repartidor</span>)}
                      <span className="ml-auto flex gap-1">
                        {order.tipo_entrega === "delivery" && !order.repartidor_id && (order.estado === "confirmado" || order.estado === "preparando") && <Button size="sm" className="h-7 rounded-full px-3 text-xs" onClick={() => setAssigning(order)}><UserPlus className="h-3.5 w-3.5" />Asignar</Button>}
                        {order.repartidor_id && !order.en_camino_at && (order.estado === "confirmado" || order.estado === "preparando") && <Button size="sm" variant="outline" className="h-7 rounded-full px-3 text-xs" disabled={busy === order.id} onClick={() => release(order)}><UserMinus className="h-3.5 w-3.5" />Liberar</Button>}
                      </span>
                    </div>
                    {focus === `o-${order.id}` && <OrderHistory orderId={order.id} version={`${order.estado}-${order.repartidor_id ?? ""}`} retiro={order.tipo_entrega === "retiro"} staff className="mt-2 border-0 bg-muted/40" />}
                  </li>
                ))}
              </ul>
            ))}
            {tab === "repartidores" && (data.repartidores.length === 0 ? <EmptyState icon={<Bike className="h-7 w-7" />} title="No hay repartidores conectados" text="Cuando se conecten aparecen acá y en el mapa." /> : (
              <ul className="space-y-2">
                {data.repartidores.map((courier) => (
                  <li key={courier.id}>
                    <button type="button" onClick={() => setFocus(`c-${courier.id}`)} className={cn("flex w-full items-center gap-3 rounded-2xl border p-3 text-left", focus === `c-${courier.id}` && "border-primary ring-2 ring-primary/30")}>
                      <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white", courier.ocupado ? "bg-blue-600" : "bg-green-600")}><Bike className="h-5 w-5" /></span>
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold">{courier.nombre}</span><span className="block text-xs text-muted-foreground">{courier.vehiculo.replace("_", " ")} · {courier.ocupado ? (courier.pedido_id ? `con el pedido ${shortId(courier.pedido_id)}` : "con un envío") : "libre"} · {courier.loc_at ? `GPS hace ${minutesSince(courier.loc_at, now)} min` : "sin GPS"}</span></span>
                      {courier.telefono && <a href={`tel:${courier.telefono.replace(/\s/g, "")}`} onClick={(event) => event.stopPropagation()} className="rounded-full border px-3 py-1 text-xs font-bold">Llamar</a>}
                    </button>
                  </li>
                ))}
              </ul>
            ))}
          </div>
        </section>
      </div>

      <Dialog open={Boolean(assigning)} onOpenChange={(open) => !open && setAssigning(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          <DialogTitle className="text-xl font-black">Asignar {assigning && shortId(assigning.id)}</DialogTitle>
          <DialogDescription>{assigning?.comercio}. Se muestran los repartidores libres, del más cercano al local al más lejano.</DialogDescription>
          {assigning && (orderCouriers(assigning).length === 0 ? <p className="rounded-xl bg-muted p-4 text-sm text-muted-foreground">No hay repartidores libres en este momento.</p> : (
            <ul className="space-y-2">
              {orderCouriers(assigning).map(({ courier, km }) => (
                <li key={courier.id} className="flex items-center gap-3 rounded-2xl border p-3">
                  <span className="min-w-0 flex-1"><span className="block truncate font-bold">{courier.nombre}</span><span className="block text-xs text-muted-foreground">{courier.vehiculo.replace("_", " ")} · {km != null ? `a ${formatKm(km)} del local` : "sin ubicación válida"}</span></span>
                  <Button size="sm" className="rounded-full" disabled={busy === courier.id} onClick={() => assign(assigning, courier)}>{busy === courier.id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Asignar"}</Button>
                </li>
              ))}
            </ul>
          ))}
        </DialogContent>
      </Dialog>
    </div>
  );
}
