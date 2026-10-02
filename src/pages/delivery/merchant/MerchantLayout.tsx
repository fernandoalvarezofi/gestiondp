import { useCallback, useEffect, useRef, useState } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { BarChart3, ClipboardList, Landmark, LayoutDashboard, Loader2, Megaphone, Settings, Star, Store, Users, UtensilsCrossed } from "lucide-react";
import { toast } from "sonner";
import { PushPrompt } from "@/components/delivery/PushPrompt";
import { StoreLogo } from "@/components/delivery/StoreCard";
import type { StoreReview } from "@/components/merchant/MerchantReviews";
import { emptyStore, StoreFormValues, StoreSettingsForm } from "@/components/merchant/StoreSettingsForm";
import { StoreStatusControl } from "@/components/merchant/StoreStatusControl";
import { PanelShell } from "@/components/panel/PanelShell";
import { useAuth } from "@/contexts/AuthContext";
import { playChime } from "@/lib/alarm";
import { Coupon, db, DeliveryOrder, DeliveryProduct, DeliveryStore, errorMessage, isOpenNow, isPaused, money, productSelect, shortId, slugify } from "@/lib/delivery";
import { notifyDesktop, printOrderTicket, readPrintSettings } from "@/lib/print";
import { cn } from "@/lib/utils";
import { TeamInvitations } from "@/components/merchant/TeamInvitations";
import { EmptyState } from "@/components/delivery/Common";
import { roleLabel, type MerchantContext, type Permission, type StoreAccess } from "./context";

/** Qué permiso hace falta para entrar a cada sección del panel. */
const sectionPermission: Record<string, Permission> = { menu: "catalogo", promociones: "promociones", opiniones: "opiniones", estadisticas: "estadisticas", finanzas: "finanzas", equipo: "equipo", configuracion: "ajustes" };

const merchantOrderSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario,notas,opciones), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";
/** Carga y mantiene al día los datos del comercio; cada sección del panel los recibe por contexto. */
export default function MerchantLayout() {
  const { user } = useAuth();
  const [store, setStore] = useState<DeliveryStore | null>(null);
  const [access, setAccess] = useState<StoreAccess | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<DeliveryProduct[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const location = useLocation();
  const knownPending = useRef<Set<string> | null>(null);
  const storeRef = useRef<DeliveryStore | null>(null);

  const loadStore = useCallback(async () => {
    if (!user) return null;
    // El comercio propio o aquel donde la persona es parte del equipo, con su rol.
    const { data: acceso } = await db.rpc("delivery_mi_acceso");
    const { data } = acceso?.comercio_id ? await db.from("delivery_comercios").select("*").eq("id", acceso.comercio_id).maybeSingle() : { data: null };
    setAccess(data && acceso ? { rol: acceso.rol, permisos: acceso.permisos } : null);
    setStore(data || null);
    storeRef.current = data || null;
    setLoading(false);
    return (data as DeliveryStore | null) ?? null;
  }, [user]);

  const loadOrders = useCallback(async () => {
    const current = storeRef.current;
    if (!current) return;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await db.from("delivery_pedidos").select(merchantOrderSelect).eq("comercio_id", current.id).gte("created_at", since).order("created_at", { ascending: false }).limit(300);
    const list: DeliveryOrder[] = data || [];
    const pending = list.filter((order) => order.estado === "pendiente").map((order) => order.id);
    const fresh = knownPending.current ? list.filter((order) => order.estado === "pendiente" && !knownPending.current!.has(order.id)) : [];
    if (fresh.length) {
      playChime();
      toast.success("¡Entró un pedido nuevo!");
      const settings = readPrintSettings();
      fresh.forEach((order) => {
        notifyDesktop("🔔 Pedido nuevo " + shortId(order.id), (order.items || []).length + " productos · " + money(order.total), order.id);
        if (settings.auto) printOrderTicket(order, current, settings);
      });
    }
    knownPending.current = new Set(pending);
    setOrders(list);
  }, []);

  const loadProducts = useCallback(async () => {
    const current = storeRef.current;
    if (!current) return;
    const { data } = await db.from("delivery_productos").select(productSelect).eq("comercio_id", current.id).order("categoria").order("nombre");
    setProducts(data || []);
  }, []);

  const loadCoupons = useCallback(async () => {
    const current = storeRef.current;
    if (!current) return;
    const { data } = await db.from("delivery_cupones").select("*").eq("comercio_id", current.id).order("created_at", { ascending: false });
    setCoupons(data || []);
  }, []);

  const loadReviews = useCallback(async () => {
    const current = storeRef.current;
    if (!current) return;
    const { data } = await db.from("delivery_resenas").select("id,puntaje,comentario,respuesta,created_at,cliente:perfiles(nombre)").eq("comercio_id", current.id).order("created_at", { ascending: false }).limit(100);
    setReviews(data || []);
  }, []);

  useEffect(() => {
    let channel: { unsubscribe: () => void } | null = null;
    (async () => {
      const found = await loadStore();
      if (!found) return;
      await Promise.all([loadOrders(), loadProducts(), loadCoupons(), loadReviews()]);
      channel = db.channel(`comercio-${found.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos", filter: `comercio_id=eq.${found.id}` }, () => loadOrders())
        .subscribe();
    })();
    return () => { if (channel) db.removeChannel(channel); };
  }, [loadStore, loadOrders, loadProducts, loadCoupons, loadReviews]);

  const createStore = async (values: StoreFormValues) => {
    if (!user) return;
    const { error } = await db.from("delivery_comercios").insert({ ...values, propietario_id: user.id, slug: `${slugify(values.nombre)}-${user.id.slice(0, 6)}` });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("¡Listo! Tu comercio quedó en revisión. Mientras tanto, cargá tu menú.");
    await loadStore();
  };

  const saveSettings = async (values: StoreFormValues) => {
    if (!store) return;
    const { error } = await db.from("delivery_comercios").update(values).eq("id", store.id);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Cambios guardados");
    await loadStore();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!store || !access) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-5 sm:px-6">
        <TeamInvitations className="mb-6" onAccepted={() => { setLoading(true); loadStore(); }} />
        <div className="flex flex-col items-center rounded-3xl bg-brand-deep px-6 py-10 text-center text-white">
          <span className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white/10"><Store className="h-8 w-8" /></span>
          <h1 className="mt-4 text-3xl font-extrabold">Sumá tu comercio a Woref</h1>
          <p className="mt-2 max-w-md text-white/75">Recibí pedidos en tiempo real, gestioná tu menú y llegá a miles de clientes cerca tuyo.</p>
        </div>
        <section className="mt-6 rounded-3xl border bg-card p-4 sm:p-6">
          <StoreSettingsForm initial={emptyStore} submitLabel="Crear mi comercio" onSubmit={createStore} />
        </section>
      </div>
    );
  }

  const pendingCount = orders.filter((order) => order.estado === "pendiente").length;
  const open = isOpenNow(store);
  const can = (permission: Permission) => access.permisos.includes(permission);
  const section = location.pathname.split("/")[3] ?? "";
  const needed = sectionPermission[section];
  const blocked = needed ? !can(needed) : false;
  const tabs = [["/app/comercio", true], ["/app/comercio/pedidos", true], ["/app/comercio/menu", can("catalogo")], ["/app/comercio/estadisticas", can("estadisticas")], ["/app/comercio/configuracion", can("ajustes")]] as const;
  const context: MerchantContext = { store, access, orders, products, coupons, reviews, pendingCount, loadStore, loadOrders, loadProducts, loadCoupons, loadReviews, saveSettings };

  return (
    <PanelShell
      panel="Panel del comercio"
      bottomTabs
      tabs={tabs.filter(([, allowed]) => allowed).map(([to]) => to)}
      quickLink={{ to: `/app/tienda/${store.slug}`, label: "Ver como cliente" }}
      identity={
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 group-data-[collapsible=icon]:hidden">
          <StoreLogo store={store} className="h-10 w-10 shrink-0 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold leading-tight">{store.nombre}</p>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", open ? "bg-success" : isPaused(store) ? "bg-warning" : "bg-muted-foreground")} />{open ? "Abierto" : isPaused(store) ? "En pausa" : "Cerrado"}</p>
          </div>
        </div>
      }
      groups={[
        { label: "Operación", items: [
          { to: "/app/comercio", label: "Inicio", icon: LayoutDashboard, end: true },
          { to: "/app/comercio/pedidos", label: "Pedidos", icon: ClipboardList, badge: pendingCount },
          ...(can("catalogo") ? [{ to: "/app/comercio/menu", label: "Menú y stock", icon: UtensilsCrossed }] : []),
        ] },
        { label: "Crecimiento", items: [
          ...(can("promociones") ? [{ to: "/app/comercio/promociones", label: "Promociones", icon: Megaphone }] : []),
          ...(can("opiniones") ? [{ to: "/app/comercio/opiniones", label: "Opiniones", icon: Star }] : []),
          ...(can("estadisticas") ? [{ to: "/app/comercio/estadisticas", label: "Estadísticas", icon: BarChart3 }] : []),
        ] },
        { label: "Mi local", items: [
          ...(can("finanzas") ? [{ to: "/app/comercio/finanzas", label: "Finanzas", icon: Landmark }] : []),
          ...(can("equipo") ? [{ to: "/app/comercio/equipo", label: "Equipo", icon: Users }] : []),
          ...(can("ajustes") ? [{ to: "/app/comercio/configuracion", label: "Configuración", icon: Settings }] : []),
        ] },
      ].filter((group) => group.items.length > 0)}
      actions={<StoreStatusControl store={store} onChange={loadStore} />}
    >
      {store.aprobado === false && !store.motivo_rechazo && <p className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"><span className="font-bold">Tu comercio está en revisión.</span> Mientras tanto podés cargar el menú, las fotos y los horarios. Cuando lo aprobemos, aparece para los clientes.</p>}
      {store.aprobado === false && store.motivo_rechazo && <p className="mb-4 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"><span className="font-bold">Tu comercio no fue aprobado:</span> {store.motivo_rechazo}. Corregilo en Configuración y escribinos para revisarlo de nuevo.</p>}
      {store.activo === false && <p className="mb-4 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Tu comercio fue pausado por administración y no aparece para los clientes. Escribinos para revisarlo.</p>}
      {(location.pathname === "/app/comercio" || location.pathname === "/app/comercio/pedidos") && <PushPrompt className="mb-4" title="No te pierdas ningún pedido" text="Activá los avisos y te llega una notificación apenas entra un pedido, aunque tengas la app cerrada." />}
      {blocked
        ? <EmptyState title="No tenés acceso a esta sección" text={`Tu rol (${roleLabel[access.rol]}) no incluye esta parte del panel. Pedile al dueño que te cambie el rol si lo necesitás.`} />
        : <Outlet context={context} />}
    </PanelShell>
  );
}
