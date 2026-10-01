import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bike, Loader2, Pencil, Receipt, ShieldAlert, Store, Wallet } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader, StatCard } from "@/components/delivery/Common";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { CouponManager } from "@/components/merchant/CouponManager";
import { changeOrderStatus } from "@/components/merchant/MerchantOrders";
import { StoreFormValues, StoreSettingsForm } from "@/components/merchant/StoreSettingsForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { categoriaLabel, Coupon, db, DeliveryOrder, DeliveryStore, EstadoPedido, errorMessage, estadoCorto, formatDateTime, img, money, pedidoActivo, shortId } from "@/lib/delivery";

type CourierRow = { perfil_id: string; vehiculo: string; telefono?: string | null; disponible: boolean; activo: boolean; created_at: string; perfil?: { nombre: string } | null };
const adminOrderSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario), comercio:delivery_comercios(nombre,slug,imagen_url,direccion), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";
const nextStatus: Partial<Record<EstadoPedido, EstadoPedido>> = { pendiente: "confirmado", confirmado: "preparando", preparando: "en_camino", en_camino: "entregado" };

export default function AdminDashboard() {
  const roles = useDeliveryRoles();
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [statusFilter, setStatusFilter] = useState<EstadoPedido | "activos" | "todos">("activos");
  const [editing, setEditing] = useState<DeliveryStore | null>(null);

  const loadStores = useCallback(async () => {
    const { data } = await db.from("delivery_comercios").select("*").order("created_at", { ascending: false });
    setStores(data || []);
  }, []);
  const loadOrders = useCallback(async () => {
    const { data } = await db.from("delivery_pedidos").select(adminOrderSelect).order("created_at", { ascending: false }).limit(200);
    setOrders(data || []);
  }, []);
  const loadCouriers = useCallback(async () => {
    const { data } = await db.from("delivery_repartidores").select("*, perfil:perfiles(nombre)").order("created_at", { ascending: false });
    setCouriers(data || []);
  }, []);
  const loadCoupons = useCallback(async () => {
    const { data } = await db.from("delivery_cupones").select("*, comercio:delivery_comercios(nombre)").order("created_at", { ascending: false });
    setCoupons(data || []);
  }, []);

  useEffect(() => {
    if (!roles.isAdmin) return;
    loadStores(); loadOrders(); loadCouriers(); loadCoupons();
    const channel = db.channel("admin-pedidos").on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos" }, loadOrders).subscribe();
    return () => { db.removeChannel(channel); };
  }, [roles.isAdmin, loadStores, loadOrders, loadCouriers, loadCoupons]);

  const stats = useMemo(() => {
    const today = new Date().toDateString();
    const todayOrders = orders.filter((order) => new Date(order.created_at).toDateString() === today && order.estado !== "cancelado");
    return {
      gmv: todayOrders.reduce((total, order) => total + Number(order.total), 0),
      count: todayOrders.length,
      active: orders.filter((order) => pedidoActivo(order.estado)).length,
      stores: stores.filter((store) => store.activo !== false).length,
      online: couriers.filter((courier) => courier.disponible && courier.activo).length,
    };
  }, [orders, stores, couriers]);

  const filteredOrders = orders.filter((order) => statusFilter === "todos" || (statusFilter === "activos" ? pedidoActivo(order.estado) : order.estado === statusFilter));

  if (roles.loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!roles.isAdmin) {
    return <div className="mx-auto max-w-2xl px-4 py-14"><EmptyState icon={<ShieldAlert className="h-7 w-7" />} title="Solo para administradores" text="Tu cuenta no tiene permisos de administración." action={<Button asChild className="rounded-full"><Link to="/app">Volver al inicio</Link></Button>} /></div>;
  }

  const updateStore = async (store: DeliveryStore, patch: Partial<DeliveryStore>) => {
    const { error } = await db.from("delivery_comercios").update(patch).eq("id", store.id);
    if (error) return toast.error(errorMessage(error));
    loadStores();
  };
  const updateCourier = async (courier: CourierRow, activo: boolean) => {
    const { error } = await db.from("delivery_repartidores").update({ activo, disponible: activo ? courier.disponible : false }).eq("perfil_id", courier.perfil_id);
    if (error) return toast.error(errorMessage(error));
    loadCouriers();
  };
  const advance = async (order: DeliveryOrder, estado: EstadoPedido) => {
    const motivo = estado === "cancelado" ? window.prompt("Motivo de la cancelación (lo verá el cliente)", "Cancelado por soporte") : undefined;
    if (estado === "cancelado" && motivo === null) return;
    if (await changeOrderStatus(order.id, estado, motivo || undefined)) { toast.success("Pedido actualizado"); loadOrders(); }
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Administración" title="Operación Woref" subtitle="Pedidos, comercios, repartidores y promociones de toda la plataforma." />

      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Facturado hoy" value={money(stats.gmv)} icon={<Wallet className="h-4 w-4" />} />
        <StatCard label="Pedidos hoy" value={stats.count} icon={<Receipt className="h-4 w-4" />} />
        <StatCard label="Pedidos en curso" value={stats.active} icon={<Receipt className="h-4 w-4" />} />
        <StatCard label="Comercios activos" value={stats.stores} icon={<Store className="h-4 w-4" />} />
        <StatCard label="Repartidores conectados" value={stats.online} icon={<Bike className="h-4 w-4" />} />
      </div>

      <Tabs defaultValue="pedidos" className="mt-6">
        <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto rounded-full bg-muted p-1">
          {[["pedidos", "Pedidos"], ["comercios", `Comercios (${stores.length})`], ["repartidores", `Repartidores (${couriers.length})`], ["cupones", "Cupones"]].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="shrink-0 rounded-full px-4 py-2 font-bold data-[state=active]:bg-card">{label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="pedidos" className="mt-6">
          <div className="scrollbar-none flex gap-2 overflow-x-auto">
            {(["activos", "todos", "pendiente", "confirmado", "preparando", "en_camino", "entregado", "cancelado"] as const).map((value) => (
              <button key={value} type="button" onClick={() => setStatusFilter(value)} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${statusFilter === value ? "border-foreground bg-foreground text-background" : "bg-card"}`}>
                {value === "activos" ? "En curso" : value === "todos" ? "Todos" : estadoCorto[value]}
              </button>
            ))}
          </div>
          <div className="mt-4 overflow-x-auto rounded-3xl border bg-card">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Pedido</th><th className="p-3">Fecha</th><th className="p-3">Comercio</th><th className="p-3">Cliente</th><th className="p-3">Estado</th><th className="p-3 text-right">Total</th><th className="p-3 text-right">Acciones</th></tr></thead>
              <tbody className="divide-y">
                {filteredOrders.map((order) => (
                  <tr key={order.id}>
                    <td className="p-3 font-bold">{shortId(order.id)}{order.repartidor_id && <Bike className="ml-1 inline h-3.5 w-3.5 text-success" />}</td>
                    <td className="p-3">{formatDateTime(order.created_at)}</td>
                    <td className="p-3">{order.comercio?.nombre}</td>
                    <td className="p-3">{order.cliente?.nombre || "—"}</td>
                    <td className="p-3"><StatusBadge estado={order.estado} /></td>
                    <td className="p-3 text-right font-bold">{money(order.total)}</td>
                    <td className="p-3 text-right">
                      {pedidoActivo(order.estado) && (
                        <div className="flex justify-end gap-1">
                          {nextStatus[order.estado] && <Button size="sm" variant="outline" className="rounded-full" onClick={() => advance(order, nextStatus[order.estado]!)}>→ {estadoCorto[nextStatus[order.estado]!]}</Button>}
                          <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => advance(order, "cancelado")}>Cancelar</Button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredOrders.length === 0 && <p className="p-8 text-center text-muted-foreground">No hay pedidos con este filtro.</p>}
          </div>
        </TabsContent>

        <TabsContent value="comercios" className="mt-6">
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {stores.map((store) => (
              <li key={store.id} className="flex flex-wrap items-center gap-3 p-3">
                <img src={img(store.imagen_url, 160)} alt="" className="h-12 w-16 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <Link to={`/app/tienda/${store.slug}`} className="font-bold hover:underline">{store.nombre}</Link>
                  <p className="truncate text-xs text-muted-foreground">{categoriaLabel[store.categoria]}{store.rubro && ` · ${store.rubro}`} · {store.direccion} · {store.esta_abierto ? "Abierto" : "Cerrado"}</p>
                </div>
                <label className="flex items-center gap-2 text-xs font-semibold">Destacado<Switch checked={Boolean(store.destacado)} onCheckedChange={(checked) => updateStore(store, { destacado: checked })} /></label>
                <label className="flex items-center gap-2 text-xs font-semibold">Visible<Switch checked={store.activo !== false} onCheckedChange={(checked) => updateStore(store, { activo: checked })} /></label>
                <Button size="icon" variant="ghost" aria-label="Editar comercio" onClick={() => setEditing(store)}><Pencil className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="repartidores" className="mt-6">
          {couriers.length ? (
            <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
              {couriers.map((courier) => (
                <li key={courier.perfil_id} className="flex flex-wrap items-center gap-3 p-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Bike className="h-5 w-5" /></span>
                  <div className="min-w-0 flex-1"><p className="font-bold">{courier.perfil?.nombre || "Repartidor"}</p><p className="text-xs text-muted-foreground">{courier.vehiculo.replace("_", " ")} · {courier.telefono || "sin teléfono"} · desde {formatDateTime(courier.created_at)}</p></div>
                  <span className={`rounded-full px-2.5 py-1 text-xs font-bold ${courier.disponible ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{courier.disponible ? "Conectado" : "Desconectado"}</span>
                  <label className="flex items-center gap-2 text-xs font-semibold">Habilitado<Switch checked={courier.activo} onCheckedChange={(checked) => updateCourier(courier, checked)} /></label>
                </li>
              ))}
            </ul>
          ) : <EmptyState icon={<Bike className="h-7 w-7" />} title="Todavía no hay repartidores registrados" />}
        </TabsContent>

        <TabsContent value="cupones" className="mt-6"><CouponManager storeId={null} coupons={coupons} onChange={loadCoupons} /></TabsContent>
      </Tabs>

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl font-extrabold">Editar {editing?.nombre}</DialogTitle></DialogHeader>
          {editing && (
            <StoreSettingsForm
              key={editing.id}
              initial={{
                nombre: editing.nombre, categoria: editing.categoria, rubro: editing.rubro || "", descripcion: editing.descripcion || "", direccion: editing.direccion, telefono: editing.telefono || "",
                horario: editing.horario || "", imagen_url: editing.imagen_url || "", logo_url: editing.logo_url || "", tiempo_min: editing.tiempo_min, tiempo_max: editing.tiempo_max,
                costo_envio: Number(editing.costo_envio), pedido_minimo: Number(editing.pedido_minimo), envio_gratis_desde: editing.envio_gratis_desde ?? null, promo_texto: editing.promo_texto || "", esta_abierto: editing.esta_abierto,
              }}
              submitLabel="Guardar"
              onSubmit={async (values: StoreFormValues) => { await updateStore(editing, values); setEditing(null); toast.success("Comercio actualizado"); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
