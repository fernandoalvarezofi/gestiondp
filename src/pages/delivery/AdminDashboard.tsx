import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { ArrowRight, Banknote, Bike, Bug, Fingerprint, Calculator, Car, Check, Send, Store as StoreIcon2, Target, ClipboardList, Flag, Landmark, LayoutDashboard, LifeBuoy, Loader2, Map, MapPinOff, Megaphone, Package, Pencil, Radio, Receipt, Route, ScrollText, Settings, ShieldAlert, Store, Tags, Users, Wallet, Undo2, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, StatCard } from "@/components/delivery/Common";
import { PanelShell } from "@/components/panel/PanelShell";
import { PlatformSettings } from "@/components/admin/PlatformSettings";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { PaymentsSettings } from "@/components/admin/PaymentsSettings";
import { AccountingPanel } from "@/components/admin/AccountingPanel";
import { ZonesManager } from "@/components/admin/ZonesManager";
import { SupportCenter } from "@/components/admin/SupportCenter";
import { ZoneDemand } from "@/components/admin/ZoneDemand";
import { SettlementsManager } from "@/components/admin/SettlementsManager";
import { StoreReviewDialog } from "@/components/admin/StoreReviewDialog";
import { EnviosManager } from "@/components/admin/EnviosManager";
import { CustomersManager } from "@/components/admin/CustomersManager";
import { OperationsCenter } from "@/components/admin/OperationsCenter";
import { AuditLog } from "@/components/admin/AuditLog";
import { ErrorsPanel } from "@/components/admin/ErrorsPanel";
import { Input } from "@/components/ui/input";
import { CouriersManager, CourierRow } from "@/components/admin/CouriersManager";
import { IdentityQueue } from "@/components/admin/IdentityReview";
import { AdminMfaNotice } from "@/components/admin/AdminMfaNotice";
import { AnnouncementsManager } from "@/components/admin/AnnouncementsManager";
import { IncentivesManager } from "@/components/admin/IncentivesManager";
import { RemisManager } from "@/components/admin/RemisManager";
import { WithdrawalsManager } from "@/components/admin/WithdrawalsManager";
import { ReportedReviews } from "@/components/admin/ReportedReviews";
import { JobsBoard } from "@/components/admin/JobsBoard";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { DirectorioManager } from "@/components/admin/DirectorioManager";
import { CouponManager } from "@/components/merchant/CouponManager";
import { changeOrderStatus } from "@/components/merchant/MerchantOrders";
import { StoreFormValues, StoreSettingsForm, storeToFormValues } from "@/components/merchant/StoreSettingsForm";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { categoriaLabel, Coupon, db, isOpenNow, DeliveryOrder, DeliveryStore, EstadoPedido, errorMessage, estadoCorto, formatDateTime, img, money, pedidoActivo, shortId } from "@/lib/delivery";

const adminOrderSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario), comercio:delivery_comercios(nombre,slug,imagen_url,direccion), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";
const nextStatus = (order: Pick<DeliveryOrder, "estado" | "tipo_entrega">): EstadoPedido | undefined =>
  order.tipo_entrega === "retiro"
    ? ({ pendiente: "confirmado", confirmado: "preparando", preparando: "listo" } as Partial<Record<EstadoPedido, EstadoPedido>>)[order.estado]
    : ({ pendiente: "confirmado", confirmado: "preparando", preparando: "en_camino", en_camino: "entregado" } as Partial<Record<EstadoPedido, EstadoPedido>>)[order.estado];

export default function AdminDashboard() {
  const roles = useDeliveryRoles();
  const { seccion } = useParams();
  const section = seccion ?? "resumen";
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [couriers, setCouriers] = useState<CourierRow[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [statusFilter, setStatusFilter] = useState<EstadoPedido | "activos" | "todos">("activos");
  const [editing, setEditing] = useState<DeliveryStore | null>(null);
  const [reviewing, setReviewing] = useState<DeliveryStore | null>(null);
  const [openClaims, setOpenClaims] = useState(0);
  const [reportedReviews, setReportedReviews] = useState(0);
  useEffect(() => { db.rpc("delivery_admin_resenas_reportadas").then(({ data }: { data: unknown[] | null }) => setReportedReviews(data?.length ?? 0), () => undefined); }, []);
  const [pendingIdentities, setPendingIdentities] = useState(0);

  const loadStores = useCallback(async () => {
    const { data } = await db.rpc("delivery_admin_comercios");
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
  const loadIdentities = useCallback(async () => {
    const { count } = await db.from("delivery_identidad").select("perfil_id", { count: "exact", head: true }).eq("estado", "en_revision");
    setPendingIdentities(count ?? 0);
  }, []);
  const loadCoupons = useCallback(async () => {
    const { data } = await db.from("delivery_cupones").select("*, comercio:delivery_comercios(nombre)").order("created_at", { ascending: false });
    setCoupons(data || []);
  }, []);

  useEffect(() => {
    if (!roles.isAdmin) return;
    loadStores(); loadOrders(); loadCouriers(); loadCoupons(); loadIdentities();
    const channel = db.channel("admin-pedidos").on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos" }, loadOrders).subscribe();
    return () => { db.removeChannel(channel); };
  }, [roles.isAdmin, loadStores, loadOrders, loadCouriers, loadCoupons, loadIdentities]);

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

  const pending = stores.filter((store) => store.aprobado === false);
  const refundCount = orders.filter((order) => order.pago_estado === "a_reintegrar").length;
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
  const setCommission = async (store: DeliveryStore, raw: string) => {
    const pct = Number(raw);
    if (raw.trim() === "" || !Number.isFinite(pct) || pct < 0 || pct > 50) return toast.error("La comisión debe estar entre 0 y 50 %");
    if (pct === Number(store.comision_pct ?? 10)) return;
    const { error } = await db.rpc("delivery_admin_comision", { p_comercio: store.id, p_pct: pct });
    if (error) return toast.error(errorMessage(error));
    toast.success(`Comisión de ${store.nombre}: ${pct}%`);
    loadStores();
  };
  const moderate = async (store: DeliveryStore, approve: boolean) => {
    const motivo = approve ? null : window.prompt("¿Por qué lo rechazás? (lo verá el dueño del comercio)", "Faltan fotos o datos del local");
    if (!approve && motivo === null) return;
    const { error } = await db.rpc("delivery_moderar_comercio", { p_comercio: store.id, p_aprobado: approve, p_motivo: motivo });
    if (error) return toast.error(errorMessage(error));
    toast.success(approve ? `${store.nombre} ya está visible para los clientes` : "Comercio rechazado");
    loadStores();
  };
  const advance = async (order: DeliveryOrder, estado: EstadoPedido) => {
    const motivo = estado === "cancelado" ? window.prompt("Motivo de la cancelación (lo verá el cliente)", "Cancelado por soporte") : undefined;
    if (estado === "cancelado" && motivo === null) return;
    if (await changeOrderStatus(order.id, estado, motivo || undefined)) { toast.success("Pedido actualizado"); loadOrders(); }
  };

  const pendingStores = pending.length;
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toDateString();
    const list = orders.filter((order) => order.estado !== "cancelado" && new Date(order.created_at).toDateString() === key);
    return { dia: date.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }), pedidos: list.length, facturado: list.reduce((total, order) => total + Number(order.total), 0) };
  });
  const pendingBlockEl = (
    <>{pending.length > 0 && (
        <section className="mt-6 rounded-3xl border border-warning/40 bg-warning/10 p-4 sm:p-5">
          <h2 className="font-extrabold">Comercios esperando aprobación ({pending.length})</h2>
          <ul className="mt-3 space-y-2">
            {pending.map((store) => (
              <li key={store.id} className="flex flex-wrap items-center gap-3 rounded-2xl bg-card p-3">
                <img src={img(store.imagen_url, 160)} alt="" className="h-12 w-16 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <Link to={`/app/tienda/${store.slug}`} className="font-bold hover:underline">{store.nombre}</Link>
                  <p className="truncate text-xs text-muted-foreground">{categoriaLabel[store.categoria]}{store.rubro && ` · ${store.rubro}`} · {store.direccion}{store.telefono && ` · ${store.telefono}`}</p>
                  {store.motivo_rechazo && <p className="text-xs text-destructive">Rechazado: {store.motivo_rechazo}</p>}
                </div>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setReviewing(store)}>Datos y documentos</Button>
                <Button size="sm" className="rounded-full" onClick={() => moderate(store, true)}><Check className="h-4 w-4" />Aprobar</Button>
                {!store.motivo_rechazo && <Button size="sm" variant="outline" className="rounded-full" onClick={() => moderate(store, false)}><X className="h-4 w-4" />Rechazar</Button>}
              </li>
            ))}
          </ul>
        </section>
      )}</>
  );

  return (
    <PanelShell
      panel="Administración"
      groups={[
        { label: "Operación", items: [
          { to: "/app/admin", label: "Resumen", icon: LayoutDashboard, end: true },
          { to: "/app/admin/operaciones", label: "Centro de operaciones", icon: Radio },
          { to: "/app/admin/pedidos", label: "Pedidos", icon: ClipboardList, badge: stats.active },
          { to: "/app/admin/trabajos", label: "Trabajos de logística", icon: Route },
          { to: "/app/admin/envios", label: "Mensajería", icon: Package },
          { to: "/app/admin/soporte", label: "Soporte", icon: LifeBuoy, badge: openClaims },
          { to: "/app/admin/arrepentimientos", label: "Arrepentimientos", icon: Undo2 },
          { to: "/app/admin/opiniones", label: "Opiniones reportadas", icon: Flag, badge: reportedReviews },
          { to: "/app/admin/categorias", label: "Categorías del Market", icon: Tags },
        ] },
        { label: "Red", items: [
          { to: "/app/admin/comercios", label: "Comercios", icon: Store, badge: pendingStores },
          { to: "/app/admin/repartidores", label: "Repartidores", icon: Bike },
          { to: "/app/admin/identidades", label: "Verificar identidad", icon: Fingerprint, badge: pendingIdentities },
          { to: "/app/admin/incentivos", label: "Metas y turnos", icon: Target },
          { to: "/app/admin/remises", label: "Remises", icon: Car },
          { to: "/app/admin/directorio", label: "Directorio de Lincoln", icon: StoreIcon2 },
          { to: "/app/admin/clientes", label: "Clientes", icon: Users },
          { to: "/app/admin/zonas", label: "Zonas y tarifas", icon: Map },
          { to: "/app/admin/demanda", label: "Zonas sin cobertura", icon: MapPinOff },
        ] },
        { label: "Marketing y finanzas", items: [
          { to: "/app/admin/cupones", label: "Cupones", icon: Megaphone },
          { to: "/app/admin/anuncios", label: "Anuncios y campañas", icon: Send },
          { to: "/app/admin/contabilidad", label: "Contabilidad", icon: Calculator },
          { to: "/app/admin/liquidaciones", label: "Liquidaciones", icon: Landmark },
          { to: "/app/admin/pagos", label: "Pagos y reintegros", icon: Banknote, badge: refundCount },
        ] },
        { label: "Sistema", items: [
          { to: "/app/admin/auditoria", label: "Auditoría", icon: ScrollText },
          { to: "/app/admin/errores", label: "Errores de la app", icon: Bug },
          { to: "/app/admin/configuracion", label: "Configuración", icon: Settings },
        ] },
      ]}
    >
      <Tabs value={section}>
        <TabsContent value="resumen" className="mt-0 space-y-6">
          <AdminMfaNotice />
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Facturado hoy" value={money(stats.gmv)} icon={<Wallet className="h-4 w-4" />} />
            <StatCard label="Pedidos hoy" value={stats.count} icon={<Receipt className="h-4 w-4" />} />
            <StatCard label="Pedidos en curso" value={stats.active} icon={<Receipt className="h-4 w-4" />} />
            <StatCard label="Comercios activos" value={stats.stores} icon={<Store className="h-4 w-4" />} />
            <StatCard label="Repartidores conectados" value={stats.online} icon={<Bike className="h-4 w-4" />} />
          </div>
          {pendingBlockEl}
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h2 className="font-extrabold">Pedidos de los últimos 7 días</h2>
              <div className="mt-4 h-60" role="img" aria-label="Pedidos por día de los últimos 7 días">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={days} margin={{ top: 8, right: 4, left: 0, bottom: 0 }}>
                    <CartesianGrid vertical={false} stroke="hsl(var(--border))" />
                    <XAxis dataKey="dia" tickLine={false} axisLine={false} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <YAxis allowDecimals={false} tickLine={false} axisLine={false} width={32} tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }} />
                    <Tooltip cursor={{ fill: "hsl(var(--muted))" }} content={({ active, payload, label }) => active && payload?.length ? (
                      <div className="rounded-xl border bg-popover px-3 py-2 text-sm shadow-pop"><p className="font-bold">{label}</p><p>{payload[0].payload.pedidos} pedidos</p><p className="text-muted-foreground">{money(payload[0].payload.facturado)}</p></div>
                    ) : null} />
                    <Bar dataKey="pedidos" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} maxBarSize={36} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
            <section className="rounded-3xl border bg-card p-4 sm:p-5">
              <h2 className="font-extrabold">Pendientes de revisar</h2>
              <ul className="mt-3 space-y-2 text-sm">
                {[
                  { label: "Tickets de soporte abiertos", value: openClaims, to: "/app/admin/soporte" },
                  { label: "Comercios por aprobar", value: pendingStores, to: "/app/admin/comercios" },
                  { label: "Identidades por verificar", value: pendingIdentities, to: "/app/admin/identidades" },
                  { label: "Reintegros por hacer", value: refundCount, to: "/app/admin/pagos" },
                ].map((item) => (
                  <li key={item.label}>
                    <Link to={item.to} className="flex items-center justify-between gap-3 rounded-xl border px-3 py-2.5 hover:bg-muted">
                      <span className="font-semibold">{item.label}</span>
                      <span className="flex items-center gap-2"><span className={`rounded-full px-2.5 py-0.5 text-xs font-extrabold ${item.value ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>{item.value}</span><ArrowRight className="h-4 w-4 text-muted-foreground" /></span>
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          </div>
        </TabsContent>

        <TabsContent value="configuracion" className="mt-0"><PlatformSettings /></TabsContent>

        <TabsContent value="pedidos" className="mt-0">
          <div className="scrollbar-none flex gap-2 overflow-x-auto">
            {(["activos", "todos", "pendiente", "confirmado", "preparando", "listo", "en_camino", "entregado", "cancelado"] as const).map((value) => (
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
                          {nextStatus(order) && <Button size="sm" variant="outline" className="rounded-full" onClick={() => advance(order, nextStatus(order)!)}>→ {estadoCorto[nextStatus(order)!]}</Button>}
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

        <TabsContent value="operaciones" className="mt-0"><OperationsCenter /></TabsContent>
        <TabsContent value="auditoria" className="mt-0"><AuditLog /></TabsContent>
        <TabsContent value="errores" className="mt-0"><ErrorsPanel /></TabsContent>
        <TabsContent value="envios" className="mt-0"><EnviosManager /></TabsContent>
        <TabsContent value="clientes" className="mt-0"><CustomersManager /></TabsContent>
        <TabsContent value="arrepentimientos" className="mt-0"><WithdrawalsManager /></TabsContent>
        <TabsContent value="trabajos" className="mt-0"><JobsBoard /></TabsContent>
        <TabsContent value="opiniones" className="mt-0"><ReportedReviews onChange={setReportedReviews} /></TabsContent>
        <TabsContent value="categorias" className="mt-0"><CategoriesManager /></TabsContent>
        <TabsContent value="soporte" className="mt-0"><SupportCenter onChange={setOpenClaims} /></TabsContent>

        <TabsContent value="comercios" className="mt-0">
          {pendingBlockEl}
          <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
            {stores.map((store) => (
              <li key={store.id} className="flex flex-wrap items-center gap-3 p-3">
                <img src={img(store.imagen_url, 160)} alt="" className="h-12 w-16 rounded-xl object-cover" />
                <div className="min-w-0 flex-1">
                  <Link to={`/app/tienda/${store.slug}`} className="font-bold hover:underline">{store.nombre}</Link>
                  <p className="truncate text-xs text-muted-foreground">{categoriaLabel[store.categoria]}{store.rubro && ` · ${store.rubro}`} · {store.direccion} · {isOpenNow(store) ? "Abierto" : "Cerrado"}{store.aprobado === false && " · Pendiente de aprobación"}</p>
                </div>
                <label className="flex items-center gap-1.5 text-xs font-semibold">Comisión
                  <Input key={`${store.id}-${store.comision_pct}`} type="number" inputMode="decimal" min={0} max={50} step={0.5} defaultValue={store.comision_pct ?? 10} className="h-8 w-16 px-2 text-right" aria-label={`Comisión de ${store.nombre} en porcentaje`} onBlur={(event) => setCommission(store, event.target.value)} />%
                </label>
                <label className="flex items-center gap-2 text-xs font-semibold">Destacado<Switch checked={Boolean(store.destacado)} onCheckedChange={(checked) => updateStore(store, { destacado: checked })} /></label>
                <label className="flex items-center gap-2 text-xs font-semibold">Visible<Switch checked={store.activo !== false} onCheckedChange={(checked) => updateStore(store, { activo: checked })} /></label>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => setReviewing(store)}>Verificación</Button>
                <Button size="icon" variant="ghost" aria-label="Editar comercio" onClick={() => setEditing(store)}><Pencil className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        </TabsContent>

        <TabsContent value="repartidores" className="mt-0"><CouriersManager couriers={couriers} onChange={() => { loadCouriers(); loadIdentities(); }} /></TabsContent>
        <TabsContent value="directorio" className="mt-0"><DirectorioManager /></TabsContent>
        <TabsContent value="remises" className="mt-0"><RemisManager /></TabsContent>
        <TabsContent value="incentivos" className="mt-0"><IncentivesManager /></TabsContent>
        <TabsContent value="identidades" className="mt-0"><IdentityQueue onChange={() => { loadCouriers(); loadIdentities(); }} /></TabsContent>

        <TabsContent value="zonas" className="mt-0"><ZonesManager /></TabsContent>
        <TabsContent value="demanda" className="mt-0"><ZoneDemand /></TabsContent>

        <TabsContent value="anuncios" className="mt-0"><AnnouncementsManager /></TabsContent>
        <TabsContent value="cupones" className="mt-0"><CouponManager storeId={null} coupons={coupons} onChange={loadCoupons} /></TabsContent>
        <TabsContent value="contabilidad" className="mt-0"><AccountingPanel /></TabsContent>
        <TabsContent value="liquidaciones" className="mt-0"><SettlementsManager /></TabsContent>
        <TabsContent value="pagos" className="mt-0"><PaymentsSettings orders={orders} onChange={loadOrders} /></TabsContent>
      </Tabs>

      <StoreReviewDialog store={reviewing} onClose={() => setReviewing(null)} />

      <Dialog open={Boolean(editing)} onOpenChange={(open) => !open && setEditing(null)}>
        <DialogContent className="max-h-[90vh] max-w-2xl overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl font-extrabold">Editar {editing?.nombre}</DialogTitle></DialogHeader>
          {editing && (
            <StoreSettingsForm
              key={editing.id}
              initial={storeToFormValues(editing)}
              submitLabel="Guardar"
              onSubmit={async (values: StoreFormValues) => { await updateStore(editing, values); setEditing(null); toast.success("Comercio actualizado"); }}
            />
          )}
        </DialogContent>
      </Dialog>
    </PanelShell>
  );
}
