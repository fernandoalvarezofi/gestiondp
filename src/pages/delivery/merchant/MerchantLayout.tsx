import { useCallback, useEffect, useRef, useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { Building2, ChevronsUpDown, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PushPrompt } from "@/components/delivery/PushPrompt";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { StoreLogo } from "@/components/delivery/StoreCard";
import type { StoreReview } from "@/components/merchant/MerchantReviews";
import { StoreStatusControl } from "@/components/merchant/StoreStatusControl";
import { PanelShell } from "@/components/panel/PanelShell";
import { useAuth } from "@/contexts/AuthContext";
import { playChime } from "@/lib/alarm";
import { COMERCIO_COLS, Coupon, db, DeliveryOrder, DeliveryProduct, DeliveryStore, errorMessage, merchantOrderSelect, estadoOperativo, money, productSelect, shortId } from "@/lib/delivery";
import { notifyDesktop, printOrderTicket, readPrintSettings } from "@/lib/print";
import { cn } from "@/lib/utils";
import { TeamInvitations } from "@/components/merchant/TeamInvitations";
import { EmptyState } from "@/components/delivery/Common";
import { StoreOnboarding } from "@/components/merchant/StoreOnboarding";
import type { StoreFormValues } from "@/components/merchant/StoreSettingsForm";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";
import { merchantNav, merchantSectionPermission, merchantTabs } from "@/navigation/menus";
import { roleLabel, type Branch, type MerchantContext, type Permission, type StoreAccess } from "./context";

const ACTIVE_KEY = "woref-sucursal";
const readActive = () => { try { return window.localStorage.getItem(ACTIVE_KEY); } catch { return null; } };

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
  const [branches, setBranches] = useState<Branch[]>([]);
  const [activeId, setActiveId] = useState<string | null>(readActive);
  const location = useLocation();
  const knownPending = useRef<Set<string> | null>(null);
  const storeRef = useRef<DeliveryStore | null>(null);

  const loadStore = useCallback(async () => {
    if (!user) return null;
    // El comercio propio o aquel donde la persona es parte del equipo, con su rol.
    const { data: mine } = await db.rpc("delivery_mis_comercios");
    setBranches((mine || []) as Branch[]);
    let { data: acceso } = await db.rpc("delivery_mi_acceso", { p_comercio: activeId });
    // Si la sucursal guardada ya no es accesible, se vuelve a la primera.
    if (activeId && !acceso?.comercio_id) { ({ data: acceso } = await db.rpc("delivery_mi_acceso", { p_comercio: null })); }
    const { data } = acceso?.comercio_id ? await db.from("delivery_comercios").select(COMERCIO_COLS).eq("id", acceso.comercio_id).maybeSingle() : { data: null };
    setAccess(data && acceso ? { rol: acceso.rol, permisos: acceso.permisos } : null);
    setStore(data || null);
    storeRef.current = data || null;
    setLoading(false);
    return (data as DeliveryStore | null) ?? null;
  }, [user, activeId]);

  const reloadBranches = useCallback(async () => {
    const { data: mine } = await db.rpc("delivery_mis_comercios");
    setBranches((mine || []) as Branch[]);
  }, []);

  /** Cambia de sucursal: se limpian los datos de la anterior para no mezclar pedidos ni avisos. */
  const switchStore = useCallback((id: string) => {
    try { window.localStorage.setItem(ACTIVE_KEY, id); } catch { /* sin almacenamiento: se usa solo en esta sesión */ }
    knownPending.current = null;
    storeRef.current = null;
    setOrders([]); setProducts([]); setCoupons([]); setReviews([]);
    setLoading(true);
    setActiveId(id);
  }, []);

  // Si la última actualización de pedidos falló: se avisa y se conservan los datos anteriores.
  const [ordersError, setOrdersError] = useState(false);
  const loadOrders = useCallback(async () => {
    const current = storeRef.current;
    if (!current) return;
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data, error } = await db.from("delivery_pedidos").select(merchantOrderSelect).eq("comercio_id", current.id).gte("created_at", since).order("created_at", { ascending: false }).limit(300);
    // Ante una falla NO se vacía el tablero ni se olvidan los pedidos conocidos: si no, al volver la conexión todos los
    // pendientes parecían nuevos (sonaban otra vez y, con impresión automática, se imprimían comandas repetidas).
    if (error) { setOrdersError(true); return; }
    setOrdersError(false);
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

  // Respaldo del tiempo real: si el canal se corta en silencio (celular en segundo plano, red inestable), los pedidos se
  // siguen actualizando cada 30 s, al volver a la pestaña y al recuperar la conexión.
  useEffect(() => {
    if (!store?.id) return;
    const timer = window.setInterval(() => { if (document.visibilityState === "visible") loadOrders(); }, 30000);
    const alVolver = () => { if (document.visibilityState === "visible") loadOrders(); };
    document.addEventListener("visibilitychange", alVolver);
    window.addEventListener("online", alVolver);
    return () => { window.clearInterval(timer); document.removeEventListener("visibilitychange", alVolver); window.removeEventListener("online", alVolver); };
  }, [store?.id, loadOrders]);

  const [preguntasPendientes, setPreguntasPendientes] = useState(0);
  const loadPreguntas = useCallback(async () => {
    const current = storeRef.current;
    if (!current) return;
    const { count } = await db.from("delivery_producto_preguntas").select("id", { count: "exact", head: true }).eq("comercio_id", current.id).is("respondida_at", null).eq("visible", true);
    setPreguntasPendientes(count ?? 0);
  }, []);
  useEffect(() => {
    if (!store) return;
    loadPreguntas();
    const timer = window.setInterval(loadPreguntas, 60000);
    return () => window.clearInterval(timer);
  }, [store?.id, loadPreguntas]); // eslint-disable-line react-hooks/exhaustive-deps

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

  const saveSettings = async (values: StoreFormValues) => {
    if (!store) return false;
    const { error } = await db.from("delivery_comercios").update(values).eq("id", store.id);
    if (error) { toast.error(errorMessage(error)); return false; }
    toast.success("Cambios guardados");
    await loadStore();
    return true;
  };

  const unreadMessages = useUnreadMessages({ comercio: store?.id ?? null, enabled: Boolean(store && access?.permisos.includes("pedidos")) });
  // Si cambió el acceso (creó su comercio, aceptó una invitación), el selector de contexto se entera.
  const roles = useDeliveryRoles();
  const hasStore = Boolean(store);
  useEffect(() => { if (!loading && hasStore !== Boolean(roles.storeId)) roles.refresh(); }, [loading, hasStore]); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!store || !access) {
    return (
      <>
        <div className="mx-auto max-w-5xl px-4 pt-5 sm:px-6"><TeamInvitations className="mb-2" onAccepted={() => { setLoading(true); loadStore(); }} /></div>
        {user && <StoreOnboarding userId={user.id} onDone={async () => { await loadStore(); }} />}
      </>
    );
  }

  const pendingCount = orders.filter((order) => order.estado === "pendiente").length;
  const estado = estadoOperativo(store);
  const open = estado.recibe;
  const corto = open ? "Abierto" : estado.clave === "revision" ? "En revisión" : estado.clave === "suspendido" ? "Suspendido" : estado.clave === "pausa" ? "En pausa" : estado.clave === "fuera_horario" ? "Fuera de horario" : "Cerrado";
  const puntoTono = open ? "bg-success" : estado.clave === "cerrado" ? "bg-muted-foreground" : "bg-warning";
  const can = (permission: Permission) => access.permisos.includes(permission);
  const section = location.pathname.split("/")[3] ?? "";
  const needed = merchantSectionPermission(section);
  const blocked = needed ? !can(needed) : false;
  const context: MerchantContext = { store, access, orders, products, coupons, reviews, pendingCount, preguntasPendientes, loadPreguntas, loadStore, loadOrders, loadProducts, loadCoupons, loadReviews, saveSettings, branches, switchStore, reloadBranches };

  return (
    <PanelShell
      panel="Mi comercio"
      bottomTabs
      tabs={merchantTabs(can)}
      quickLink={{ to: `/app/tienda/${store.slug}`, label: "Ver como cliente" }}
      identity={branches.length > 1 ? (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Cambiar de sucursal" className="flex w-full items-center gap-3 rounded-2xl border bg-card p-2.5 text-left group-data-[collapsible=icon]:hidden">
              <StoreLogo store={store} className="h-10 w-10 shrink-0 text-sm" />
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-extrabold leading-tight">{store.nombre}</span><span className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", puntoTono)} />{corto}</span></span>
              <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-64">
            <DropdownMenuLabel>Mis comercios y sucursales</DropdownMenuLabel>
            {branches.map((branch, index) => (
              <div key={branch.id}>
                {/* Con más de un negocio, el selector agrupa las tiendas bajo el nombre de cada uno. */}
                {new Set(branches.map((b) => b.negocio_id ?? "")).size > 1 && branch.negocio_id !== branches[index - 1]?.negocio_id && (
                  <p className="px-2 pb-1 pt-2 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground">{branch.negocio || "Otros locales"}</p>
                )}
                <DropdownMenuItem onClick={() => { if (branch.id !== store.id) switchStore(branch.id); }}>
                  <Building2 className="h-4 w-4" /><span className="min-w-0 flex-1 truncate">{branch.nombre}</span>{branch.id === store.id && <span className="text-xs font-extrabold text-primary">Acá</span>}
                </DropdownMenuItem>
              </div>
            ))}
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild><Link to="/app/comercio/sucursales">Ver todas las sucursales</Link></DropdownMenuItem>
            <DropdownMenuItem asChild><Link to="/app/comercio/nuevo" className="font-bold"><Plus className="h-4 w-4" />Crear otro comercio</Link></DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      ) : (
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 group-data-[collapsible=icon]:hidden">
          <StoreLogo store={store} className="h-10 w-10 shrink-0 text-sm" />
          <div className="min-w-0">
            <p className="truncate text-sm font-extrabold leading-tight">{store.nombre}</p>
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-muted-foreground"><span className={cn("h-2 w-2 rounded-full", puntoTono)} />{corto}</p>
          </div>
        </div>
      )}
      groups={merchantNav(can, { pedidos: pendingCount, preguntas: preguntasPendientes, mensajes: unreadMessages })}
      actions={<StoreStatusControl store={store} onChange={loadStore} />}
    >
      {store.aprobado === false && !store.motivo_rechazo && (section === "" || section === "configuracion"
        ? <p className="mb-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"><span className="font-bold">Tu comercio está en revisión.</span> Mientras tanto podés cargar el menú, las fotos y los horarios. Para aprobarte necesitamos tu CUIT y razón social: cargalos en <Link to="/app/comercio/configuracion/verificacion" className="font-bold underline">Configuración → Verificación</Link>.</p>
        : <p className="mb-4 flex flex-wrap items-center gap-x-2 rounded-full border border-warning/40 bg-warning/10 px-4 py-2 text-[13px]"><span className="font-bold">En revisión: los clientes todavía no ven tu local.</span><Link to="/app/comercio/configuracion/verificacion" className="font-bold underline">Completar verificación</Link></p>)}
      {store.aprobado === false && store.motivo_rechazo && <p className="mb-4 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"><span className="font-bold">Tu comercio no fue aprobado:</span> {store.motivo_rechazo}. Corregilo en Configuración y escribinos para revisarlo de nuevo.</p>}
      {ordersError && <div role="alert" className="mb-4 flex flex-wrap items-center gap-2 rounded-2xl border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm"><span className="font-bold text-destructive">No pudimos actualizar tus pedidos.</span><span className="text-muted-foreground">Revisá la conexión; reintentamos solos cada 30 segundos.</span><Button size="sm" variant="outline" className="ml-auto rounded-full" onClick={() => loadOrders()}>Reintentar ahora</Button></div>}
      {store.activo === false && <p className="mb-4 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Tu comercio fue pausado por administración y no aparece para los clientes. Escribinos para revisarlo.</p>}
      {(location.pathname === "/app/comercio" || location.pathname === "/app/comercio/pedidos") && <PushPrompt className="mb-4" title="No te pierdas ningún pedido" text="Activá los avisos y te llega una notificación apenas entra un pedido, aunque tengas la app cerrada." />}
      {blocked
        ? <EmptyState title="No tenés acceso a esta sección" text={`Tu rol (${roleLabel[access.rol]}) no incluye esta parte del panel. Pedile al dueño que te cambie el rol si lo necesitás.`} />
        : <Outlet context={context} />}
    </PanelShell>
  );
}
