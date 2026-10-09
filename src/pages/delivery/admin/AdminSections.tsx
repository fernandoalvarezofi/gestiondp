import { ReactNode, useState } from "react";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowRight, Bike, Check, Pencil, Radio, Search, Trash2, X } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DeleteStorePanel } from "@/components/merchant/DeleteStorePanel";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { confirmar } from "@/components/ui/dialogos";
import { ErrorState } from "@/components/delivery/Common";
import { BarSeries, ListRow, Metric, MetricStrip, PageIntro, RowList, Section, SectionLink, StatusPill, Surface } from "@/components/panel/kit";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { AccountingPanel } from "@/components/admin/AccountingPanel";
import { AnalyticsPanel } from "@/components/admin/AnalyticsPanel";
import { SecurityPanel } from "@/components/admin/SecurityPanel";
import { AdminMfaNotice } from "@/components/admin/AdminMfaNotice";
import { AnnouncementsManager } from "@/components/admin/AnnouncementsManager";
import { AuditLog } from "@/components/admin/AuditLog";
import { CategoriesManager } from "@/components/admin/CategoriesManager";
import { CouriersManager } from "@/components/admin/CouriersManager";
import { CustomersManager } from "@/components/admin/CustomersManager";
import { DirectorioManager } from "@/components/admin/DirectorioManager";
import { EnviosManager } from "@/components/admin/EnviosManager";
import { ErrorsPanel } from "@/components/admin/ErrorsPanel";
import { IdentityQueue } from "@/components/admin/IdentityReview";
import { IncentivesManager } from "@/components/admin/IncentivesManager";
import { JobsBoard } from "@/components/admin/JobsBoard";
import { OperationsCenter } from "@/components/admin/OperationsCenter";
import { PaymentsSettings } from "@/components/admin/PaymentsSettings";
import { PlatformSettings } from "@/components/admin/PlatformSettings";
import { ProvidersNetwork } from "@/components/admin/ProvidersNetwork";
import { RemisManager } from "@/components/admin/RemisManager";
import { ReportedReviews } from "@/components/admin/ReportedReviews";
import { ReportedMessages } from "@/components/admin/ReportedMessages";
import { SettlementsManager } from "@/components/admin/SettlementsManager";
import { SupportCenter } from "@/components/admin/SupportCenter";
import { WithdrawalsManager } from "@/components/admin/WithdrawalsManager";
import { ZoneDemand } from "@/components/admin/ZoneDemand";
import { ZonesManager } from "@/components/admin/ZonesManager";
import { CouponManager } from "@/components/merchant/CouponManager";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { categoriaLabel, db, DeliveryOrder, DeliveryStore, errorMessage, EstadoPedido, estadoCorto, formatDateTime, img, isOpenNow, money, pedidoActivo, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { ADMIN_REDIRECTS, ADMIN_SECTIONS, adminTo } from "@/navigation/menus";
import { useAdmin } from "./AdminLayout";

const nextStatus = (order: Pick<DeliveryOrder, "estado" | "tipo_entrega">): EstadoPedido | undefined =>
  order.tipo_entrega === "retiro"
    ? ({ pendiente: "confirmado", confirmado: "preparando", preparando: "listo" } as Partial<Record<EstadoPedido, EstadoPedido>>)[order.estado]
    : ({ pendiente: "confirmado", confirmado: "preparando", preparando: "en_camino", en_camino: "entregado" } as Partial<Record<EstadoPedido, EstadoPedido>>)[order.estado];

/** Comercios esperando aprobación (aparece en el resumen y en Comercios). */
function PendingStores() {
  const { stores, moderate, reviewStore } = useAdmin();
  const pending = stores.filter((store) => store.aprobado === false && !store.eliminado_at);
  if (!pending.length) return null;
  return (
    <section className="rounded-2xl border border-warning/40 bg-warning/10 p-4 sm:p-5">
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
            <Button size="sm" variant="outline" className="rounded-full" onClick={() => reviewStore(store)}>Datos y documentos</Button>
            <Button size="sm" className="rounded-full" onClick={() => moderate(store, true)}><Check className="h-4 w-4" />Aprobar</Button>
            {!store.motivo_rechazo && <Button size="sm" variant="outline" className="rounded-full" onClick={() => moderate(store, false)}><X className="h-4 w-4" />Rechazar</Button>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Overview() {
  const { orders, stats, counts, ready, loadErrors, reloadAll } = useAdmin();
  const queue = [
    { label: "Tickets de soporte abiertos", value: counts.openClaims, to: "/app/admin/soporte" },
    { label: "Comercios por aprobar", value: counts.pendingStores, to: "/app/admin/comercios" },
    { label: "Identidades por verificar", value: counts.pendingIdentities, to: "/app/admin/identidades" },
    { label: "Reintegros por hacer", value: counts.refunds, to: "/app/admin/pagos" },
    { label: "Opiniones reportadas", value: counts.reportedReviews, to: "/app/admin/opiniones" },
  ].sort((x, y) => Number(Boolean(y.value)) - Number(Boolean(x.value)));
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date();
    date.setDate(date.getDate() - (6 - index));
    const key = date.toDateString();
    const list = orders.filter((order) => order.estado !== "cancelado" && new Date(order.created_at).toDateString() === key);
    return { dia: date.toLocaleDateString("es-AR", { weekday: "short", day: "numeric" }), pedidos: list.length, facturado: list.reduce((total, order) => total + Number(order.total), 0) };
  });

  return (
    <div className="space-y-6">
      <PageIntro title="Centro de control" description={<span className="first-letter:capitalize">{new Date().toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", weekday: "long", day: "numeric", month: "long" })} · {stats.active} {stats.active === 1 ? "pedido en curso" : "pedidos en curso"} ahora</span>}
        actions={<Button asChild size="sm" className="rounded-full"><Link to="/app/admin/operaciones"><Radio className="h-4 w-4" />Abrir operaciones en vivo</Link></Button>} />
      <AdminMfaNotice />
      {loadErrors.length > 0 && <ErrorState title="Parte del resumen no se pudo cargar" error={new Error(loadErrors.join(" · "))} onRetry={reloadAll} />}
      <MetricStrip cols={5}>
        <Metric featured label="Facturado hoy" value={ready ? money(stats.gmv) : "…"} hint={ready ? `${stats.count} ${stats.count === 1 ? "pedido" : "pedidos"} hoy` : "Cargando…"} spark={ready ? days.map((d) => d.facturado) : undefined} />
        <Metric label="En curso" value={ready ? stats.active : "…"} hint="Pedidos activos" />
        <Metric label="Comercios activos" value={ready ? stats.stores : "…"} hint={!ready ? "Cargando…" : counts.pendingStores ? `${counts.pendingStores} por aprobar` : "Todos aprobados"} />
        <Metric label="Repartidores" value={ready ? stats.online : "…"} hint="Conectados ahora" />
      </MetricStrip>
      <PendingStores />
      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Section title="Pedidos de los últimos 7 días" description="El día con más pedidos va resaltado">
            <Surface><BarSeries data={days.map((d, i) => ({ key: String(i), value: d.pedidos, label: d.dia, hint: money(d.facturado) }))} label="Pedidos por día de los últimos 7 días" height={190} /></Surface>
          </Section>
          <Section title="Actividad reciente" description="Los últimos pedidos de toda la plataforma" action={<SectionLink to="/app/admin/pedidos">Ver todos</SectionLink>}>
            <RowList>
              {orders.slice(0, 6).map((order) => (
                <ListRow key={order.id} to="/app/admin/pedidos" lead={<StatusBadge estado={order.estado} />} title={<>{shortId(order.id)} <span className="font-medium text-muted-foreground">· {order.comercio?.nombre}</span></>} meta={`${order.cliente?.nombre?.split(" ")[0] || "Cliente"} · ${formatDateTime(order.created_at)}`} trailing={<span className="font-extrabold tabular-nums">{money(order.total)}</span>} />
              ))}
              {orders.length === 0 && <p className="px-4 py-6 text-center text-sm text-muted-foreground">{ready ? "Todavía no hay pedidos." : "Cargando pedidos…"}</p>}
            </RowList>
          </Section>
        </div>
        <Section title="Pendientes de revisar" description={queue.some((q) => q.value) ? "Ordenados por lo que más urge" : "Nada esperando tu revisión"}>
          <RowList>
            {queue.map((item) => (
              <ListRow key={item.label} to={item.to} title={<span className={item.value ? "" : "font-semibold text-muted-foreground"}>{item.label}</span>}
                trailing={<span className="flex items-center gap-2"><StatusPill tone={item.value ? "brand" : "neutral"} className="min-w-6 justify-center tabular-nums">{item.value}</StatusPill><ArrowRight className="h-4 w-4 text-muted-foreground" /></span>} />
            ))}
          </RowList>
        </Section>
      </div>
    </div>
  );
}

function OrdersSection() {
  const { orders, advance, ready } = useAdmin();
  const [statusFilter, setStatusFilter] = useState<EstadoPedido | "activos" | "todos">("activos");
  const filteredOrders = orders.filter((order) => statusFilter === "todos" || (statusFilter === "activos" ? pedidoActivo(order.estado) : order.estado === statusFilter));
  return (
    <>
      <div className="scrollbar-none flex gap-2 overflow-x-auto">
        {(["activos", "todos", "pendiente", "confirmado", "preparando", "listo", "en_camino", "entregado", "cancelado"] as const).map((value) => (
          <button key={value} type="button" onClick={() => setStatusFilter(value)} aria-pressed={statusFilter === value} className={`shrink-0 rounded-full border px-4 py-2 text-sm font-bold ${statusFilter === value ? "border-foreground bg-foreground text-background" : "bg-card"}`}>
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
        {filteredOrders.length === 0 && <p className="p-8 text-center text-muted-foreground">{ready ? "No hay pedidos con este filtro." : "Cargando pedidos…"}</p>}
      </div>
    </>
  );
}

function StoresSection() {
  const { stores, setCommission, updateStore, reviewStore, editStore, ready, loadStores } = useAdmin();
  const [eliminando, setEliminando] = useState<DeliveryStore | null>(null);
  const restaurar = async (store: DeliveryStore) => {
    if (!(await confirmar({ titulo: `¿Restaurar ${store.nombre}?`, descripcion: "Vuelve oculta, con sus pedidos e historial. Revisala y activala con “Visible” cuando esté lista. Sus productos siguen archivados.", confirmar: "Restaurar" }))) return;
    const { error } = await db.rpc("delivery_admin_restaurar_tienda", { p_comercio: store.id });
    if (error) return toast.error(errorMessage(error));
    toast.success(`${store.nombre} restaurada (oculta)`);
    loadStores();
  };
  const [busca, setBusca] = useState("");
  const [filtro, setFiltro] = useState<"todos" | "pendientes" | "visibles" | "ocultos" | "baja">("todos");
  const norm = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const baja = (x: DeliveryStore) => Boolean(x.eliminado_at);
  const lista = stores.filter((store) => (filtro === "baja" ? baja(store) : !baja(store) && (filtro === "todos" || (filtro === "pendientes" ? store.aprobado === false : filtro === "visibles" ? store.activo !== false && store.aprobado !== false : store.activo === false)))
    && (!busca.trim() || norm(`${store.nombre} ${store.slug} ${store.direccion} ${store.rubro ?? ""}`).includes(norm(busca.trim()))));
  const vivas = stores.filter((x) => !baja(x));
  const cuenta = { todos: vivas.length, pendientes: vivas.filter((x) => x.aprobado === false).length, visibles: vivas.filter((x) => x.activo !== false && x.aprobado !== false).length, ocultos: vivas.filter((x) => x.activo === false).length, baja: stores.length - vivas.length };

  // Cambiar la comisión afecta lo que se le cobra al comercio desde el próximo pedido: se confirma antes de aplicar.
  const cambiarComision = async (store: DeliveryStore, raw: string, input: HTMLInputElement) => {
    const pct = Number(raw);
    if (store.comision_pct != null && pct === Number(store.comision_pct)) return;
    if (raw.trim() === "" || !Number.isFinite(pct) || pct < 0 || pct > 50) { toast.error("La comisión debe estar entre 0 y 50 %"); input.value = String(store.comision_pct ?? ""); return; }
    const ok = await confirmar({ titulo: `¿Cambiar la comisión de ${store.nombre} a ${pct}%?`, descripcion: `Hoy paga ${store.comision_pct ?? "—"}%. El cambio se aplica a los pedidos nuevos y queda en la auditoría.`, confirmar: "Cambiar comisión" });
    if (!ok) { input.value = String(store.comision_pct ?? ""); return; }
    await setCommission(store, raw);
  };
  const cambiarVisible = async (store: DeliveryStore, visible: boolean) => {
    if (!visible && !(await confirmar({ titulo: `¿Ocultar ${store.nombre}?`, descripcion: "Deja de aparecer para los clientes al instante y no recibe pedidos nuevos. Los pedidos en curso siguen.", confirmar: "Ocultar comercio", peligro: true }))) return;
    await updateStore(store, { activo: visible });
  };

  return (
    <div className="space-y-4">
      <PendingStores />
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full border bg-card px-4"><Search className="h-4 w-4 text-muted-foreground" aria-hidden /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre, dirección o rubro" aria-label="Buscar comercio" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        <div className="scrollbar-none flex gap-1.5 overflow-x-auto" role="group" aria-label="Filtrar comercios">
          {(["todos", "pendientes", "visibles", "ocultos", "baja"] as const).filter((id) => id !== "baja" || cuenta.baja > 0).map((id) => (
            <button key={id} type="button" aria-pressed={filtro === id} onClick={() => setFiltro(id)} className={cn("h-9 shrink-0 rounded-full border px-3.5 text-[13px] font-bold", filtro === id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{id === "todos" ? "Todos" : id === "pendientes" ? "Por aprobar" : id === "visibles" ? "Visibles" : id === "ocultos" ? "Ocultos" : "Dadas de baja"} <span className="tabular-nums opacity-70">{cuenta[id]}</span></button>
          ))}
        </div>
      </div>
      {!ready ? (
        <div className="space-y-2" aria-busy="true" aria-label="Cargando comercios">{[0, 1, 2, 3].map((k) => <Skeleton key={k} className="h-16 w-full rounded-2xl" />)}</div>
      ) : lista.length === 0 ? (
        <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">{stores.length ? "Ningún comercio coincide con la búsqueda o el filtro." : "Todavía no hay comercios."}</p>
      ) : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
          {lista.map((store) => (
            <li key={store.id} className="flex flex-wrap items-center gap-3 p-3">
              <img src={img(store.imagen_url, 160)} alt="" className="h-12 w-16 rounded-xl object-cover" />
              <div className="min-w-0 flex-1 basis-48">
                <Link to={`/app/tienda/${store.slug}`} className="font-bold hover:underline">{store.nombre}</Link>
                <p className="truncate text-xs text-muted-foreground">{categoriaLabel[store.categoria]}{store.rubro && ` · ${store.rubro}`} · {store.direccion}</p>
                <div className="mt-1 flex flex-wrap gap-1">
                  {baja(store) ? <StatusPill tone="danger">Dada de baja · {formatDateTime(store.eliminado_at)}</StatusPill> : store.aprobado === false ? <StatusPill tone="warning">Por aprobar</StatusPill> : store.activo === false ? <StatusPill tone="danger">Oculto</StatusPill> : isOpenNow(store) ? <StatusPill tone="success" dot>Abierto</StatusPill> : <StatusPill>Cerrado</StatusPill>}
                </div>
              </div>
              {baja(store) ? <Button size="sm" variant="outline" className="rounded-full" onClick={() => restaurar(store)}>Restaurar</Button> : <>
              <label className="flex items-center gap-1.5 text-xs font-semibold">Comisión
                <Input key={`${store.id}-${store.comision_pct}`} type="number" inputMode="decimal" min={0} max={50} step={0.5} defaultValue={store.comision_pct ?? ""} className="h-8 w-16 px-2 text-right" aria-label={`Comisión de ${store.nombre} en porcentaje`}
                  onBlur={(event) => cambiarComision(store, event.target.value, event.currentTarget)} onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }} />%
              </label>
              <label className="flex items-center gap-2 text-xs font-semibold">Destacado<Switch checked={Boolean(store.destacado)} onCheckedChange={(checked) => updateStore(store, { destacado: checked })} /></label>
              <label className="flex items-center gap-2 text-xs font-semibold">Visible<Switch checked={store.activo !== false} onCheckedChange={(checked) => cambiarVisible(store, checked)} /></label>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => reviewStore(store)}>Verificación</Button>
              <Button size="icon" variant="ghost" aria-label={`Editar ${store.nombre}`} onClick={() => editStore(store)}><Pencil className="h-4 w-4" /></Button>
              <Button size="icon" variant="ghost" className="text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Eliminar ${store.nombre}`} onClick={() => setEliminando(store)}><Trash2 className="h-4 w-4" /></Button>
              </>}
            </li>
          ))}
        </ul>
      )}
      <Dialog open={Boolean(eliminando)} onOpenChange={(open) => { if (!open) setEliminando(null); }}>
        <DialogContent className="max-w-xl">
          <DialogTitle className="text-xl font-extrabold">Eliminar {eliminando?.nombre}</DialogTitle>
          <DialogDescription>Revisá qué va a pasar con esta tienda antes de confirmar.</DialogDescription>
          {eliminando && <DeleteStorePanel storeId={eliminando.id} onDone={() => { setEliminando(null); loadStores(); }} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}

/** Qué se dibuja en cada sección. Las secciones y su menú se declaran en `ADMIN_SECTIONS` (navigation/menus). */
const SECTIONS: Record<string, () => ReactNode> = {
  resumen: () => <Overview />,
  operaciones: () => <OperationsCenter />,
  analytics: () => <AnalyticsPanel />,
  pedidos: () => <OrdersSection />,
  viajes: () => <RemisManager view="viajes" />,
  envios: () => <EnviosManager />,
  trabajos: () => <JobsBoard />,
  zonas: () => <ZonesManager />,
  demanda: () => <ZoneDemand />,
  clientes: () => <CustomersManager />,
  comercios: () => <StoresSection />,
  repartidores: function Repartidores() { const { couriers, loadCouriers, loadIdentities } = useAdmin(); return <CouriersManager couriers={couriers} onChange={() => { loadCouriers(); loadIdentities(); }} />; },
  conductores: () => <RemisManager view="conductores" />,
  identidades: function Identidades() { const { loadCouriers, loadIdentities } = useAdmin(); return <IdentityQueue onChange={() => { loadCouriers(); loadIdentities(); }} />; },
  incentivos: () => <IncentivesManager />,
  red: () => <ProvidersNetwork />,
  pagos: function Pagos() { const { orders, loadOrders } = useAdmin(); return <PaymentsSettings orders={orders} onChange={loadOrders} />; },
  contabilidad: () => <AccountingPanel />,
  liquidaciones: () => <SettlementsManager />,
  cupones: function Cupones() { const { coupons, loadCoupons } = useAdmin(); return <CouponManager storeId={null} coupons={coupons} onChange={loadCoupons} />; },
  anuncios: () => <AnnouncementsManager />,
  categorias: () => <CategoriesManager />,
  directorio: () => <DirectorioManager />,
  soporte: function Soporte() { const { setOpenClaims } = useAdmin(); return <SupportCenter onChange={setOpenClaims} />; },
  arrepentimientos: () => <WithdrawalsManager />,
  mensajes: function Mensajes() { const { setReportedMessages } = useAdmin(); return <ReportedMessages onChange={setReportedMessages} />; },
  opiniones: function Opiniones() { const { setReportedReviews } = useAdmin(); return <ReportedReviews onChange={setReportedReviews} />; },
  seguridad: () => <SecurityPanel />,
  auditoria: () => <AuditLog />,
  errores: () => <ErrorsPanel />,
  configuracion: () => <PlatformSettings />,
};

/** Ruta /app/admin/:seccion. Una sección que no existe vuelve al resumen (antes mostraba una pantalla vacía). */
export default function AdminSection() {
  const params = useParams();
  const seccion = params.seccion ?? "resumen";
  if (params.seccion === "resumen") return <Navigate to="/app/admin" replace />;
  if (ADMIN_REDIRECTS[seccion]) return <Navigate to={adminTo(ADMIN_REDIRECTS[seccion])} replace />;
  const Render = ADMIN_SECTIONS.some((item) => item.id === seccion) ? SECTIONS[seccion] : undefined;
  if (!Render) return <Navigate to="/app/admin" replace />;
  return <Render key={seccion} />;
}
