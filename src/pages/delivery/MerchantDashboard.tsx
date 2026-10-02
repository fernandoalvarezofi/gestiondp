import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/delivery/Common";
import { PushPrompt } from "@/components/delivery/PushPrompt";
import { CouponManager } from "@/components/merchant/CouponManager";
import { MerchantMenu } from "@/components/merchant/MerchantMenu";
import { MerchantOrders, NewOrderAlert } from "@/components/merchant/MerchantOrders";
import { MerchantStats } from "@/components/merchant/MerchantStats";
import { StoreStatusControl } from "@/components/merchant/StoreStatusControl";
import { MerchantReviews, StoreReview } from "@/components/merchant/MerchantReviews";
import { emptyStore, StoreFormValues, StoreSettingsForm, storeToFormValues } from "@/components/merchant/StoreSettingsForm";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { playChime } from "@/lib/alarm";
import { notifyDesktop, printOrderTicket, readPrintSettings } from "@/lib/print";
import { Coupon, db, DeliveryOrder, DeliveryProduct, DeliveryStore, errorMessage, money, productSelect, shortId, slugify } from "@/lib/delivery";

const merchantOrderSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario,notas,opciones), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";

export default function MerchantDashboard() {
  const { user } = useAuth();
  const [store, setStore] = useState<DeliveryStore | null>(null);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<DeliveryProduct[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [reviews, setReviews] = useState<StoreReview[]>([]);
  const [tab, setTab] = useState("pedidos");
  const knownPending = useRef<Set<string> | null>(null);
  const storeRef = useRef<DeliveryStore | null>(null);

  const loadStore = useCallback(async () => {
    if (!user) return null;
    const { data } = await db.from("delivery_comercios").select("*").eq("propietario_id", user.id).order("created_at").limit(1).maybeSingle();
    setStore(data || null);
    storeRef.current = data || null;
    setLoading(false);
    return data as DeliveryStore | null;
  }, [user]);

  const loadOrders = useCallback(async (storeId: string) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await db.from("delivery_pedidos").select(merchantOrderSelect).eq("comercio_id", storeId).gte("created_at", since).order("created_at", { ascending: false }).limit(300);
    const list: DeliveryOrder[] = data || [];
    const pending = list.filter((order) => order.estado === "pendiente").map((order) => order.id);
    const fresh = knownPending.current ? list.filter((order) => order.estado === "pendiente" && !knownPending.current!.has(order.id)) : [];
    if (fresh.length) {
      playChime();
      toast.success("¡Entró un pedido nuevo!");
      const settings = readPrintSettings();
      fresh.forEach((order) => {
        notifyDesktop("🔔 Pedido nuevo " + shortId(order.id), (order.items || []).length + " productos · " + money(order.total), order.id);
        if (settings.auto && storeRef.current) printOrderTicket(order, storeRef.current, settings);
      });
    }
    knownPending.current = new Set(pending);
    setOrders(list);
  }, []);

  const loadProducts = useCallback(async (storeId: string) => {
    const { data } = await db.from("delivery_productos").select(productSelect).eq("comercio_id", storeId).order("categoria").order("nombre");
    setProducts(data || []);
  }, []);

  const loadCoupons = useCallback(async (storeId: string) => {
    const { data } = await db.from("delivery_cupones").select("*").eq("comercio_id", storeId).order("created_at", { ascending: false });
    setCoupons(data || []);
  }, []);

  const loadReviews = useCallback(async (storeId: string) => {
    const { data } = await db.from("delivery_resenas").select("id,puntaje,comentario,respuesta,created_at,cliente:perfiles(nombre)").eq("comercio_id", storeId).order("created_at", { ascending: false }).limit(100);
    setReviews(data || []);
  }, []);

  useEffect(() => {
    let channel: { unsubscribe: () => void } | null = null;
    (async () => {
      const found = await loadStore();
      if (!found) return;
      await Promise.all([loadOrders(found.id), loadProducts(found.id), loadCoupons(found.id), loadReviews(found.id)]);
      channel = db.channel(`comercio-${found.id}`)
        .on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos", filter: `comercio_id=eq.${found.id}` }, () => loadOrders(found.id))
        .subscribe();
    })();
    return () => { if (channel) db.removeChannel(channel); };
  }, [loadStore, loadOrders, loadProducts, loadCoupons, loadReviews]);

  const createStore = async (values: StoreFormValues) => {
    if (!user) return;
    const { error } = await db.from("delivery_comercios").insert({ ...values, propietario_id: user.id, slug: `${slugify(values.nombre)}-${user.id.slice(0, 6)}` });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("¡Listo! Tu comercio quedó en revisión. Mientras tanto, cargá tu menú.");
    const found = await loadStore();
    if (found) setTab("menu");
  };

  const saveSettings = async (values: StoreFormValues) => {
    if (!store) return;
    const { error } = await db.from("delivery_comercios").update(values).eq("id", store.id);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Cambios guardados");
    loadStore();
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  if (!store) {
    return (
      <div className="mx-auto max-w-3xl px-4 pb-16 pt-5 sm:px-6">
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
  const formValues = storeToFormValues(store);


  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Panel del comercio"
        title={store.nombre}
        subtitle={<Link to={`/app/tienda/${store.slug}`} className="inline-flex items-center gap-1 font-bold text-primary">Ver como cliente<ExternalLink className="h-3.5 w-3.5" /></Link>}
        actions={<StoreStatusControl store={store} onChange={loadStore} />}
      />
      {store.aprobado === false && !store.motivo_rechazo && <p className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm"><span className="font-bold">Tu comercio está en revisión.</span> Mientras tanto podés cargar el menú, las fotos y los horarios. Cuando lo aprobemos, aparece para los clientes.</p>}
      {store.aprobado === false && store.motivo_rechazo && <p className="mt-4 rounded-2xl bg-destructive/10 p-4 text-sm text-destructive"><span className="font-bold">Tu comercio no fue aprobado:</span> {store.motivo_rechazo}. Corregilo en Configuración y escribinos para revisarlo de nuevo.</p>}
      {store.activo === false && <p className="mt-4 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Tu comercio fue pausado por administración y no aparece para los clientes. Escribinos para revisarlo.</p>}
      <div className="mt-4"><NewOrderAlert count={pendingCount} /></div>
      <PushPrompt className="mt-4" title="No te pierdas ningún pedido" text="Activá los avisos y te llega una notificación apenas entra un pedido, aunque tengas la app cerrada." />

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto rounded-full bg-muted p-1">
          {[["resumen", "Estadísticas"], ["pedidos", `Pedidos${pendingCount ? ` (${pendingCount})` : ""}`], ["menu", "Menú"], ["cupones", "Cupones"], ["opiniones", "Opiniones"], ["ajustes", "Configuración"]].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="shrink-0 rounded-full px-4 py-2 font-bold data-[state=active]:bg-card">{label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="resumen" className="mt-6"><MerchantStats storeId={store.id} rating={Number(store.rating)} reviews={store.total_resenas} /></TabsContent>
        <TabsContent value="pedidos" className="mt-6"><MerchantOrders orders={orders} store={store} onChange={() => loadOrders(store.id)} /></TabsContent>
        <TabsContent value="menu" className="mt-6"><MerchantMenu storeId={store.id} products={products} onChange={() => loadProducts(store.id)} /></TabsContent>
        <TabsContent value="cupones" className="mt-6"><CouponManager storeId={store.id} coupons={coupons} onChange={() => loadCoupons(store.id)} /></TabsContent>
        <TabsContent value="opiniones" className="mt-6"><MerchantReviews reviews={reviews} onChange={() => loadReviews(store.id)} /></TabsContent>
        <TabsContent value="ajustes" className="mt-6">
          <section className="rounded-3xl border bg-card p-4 sm:p-6"><StoreSettingsForm key={store.id + store.nombre} initial={formValues} submitLabel="Guardar cambios" onSubmit={saveSettings} /></section>
        </TabsContent>
      </Tabs>

      <p className="mt-10 text-center text-xs text-muted-foreground">¿Necesitás ayuda con tu comercio? <Button asChild variant="link" className="h-auto p-0 text-xs"><Link to="/app/perfil">Centro de ayuda</Link></Button></p>
    </div>
  );
}
