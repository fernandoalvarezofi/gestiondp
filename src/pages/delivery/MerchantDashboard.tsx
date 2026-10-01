import { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/delivery/Common";
import { CouponManager } from "@/components/merchant/CouponManager";
import { MerchantMenu } from "@/components/merchant/MerchantMenu";
import { MerchantOrders, NewOrderAlert } from "@/components/merchant/MerchantOrders";
import { MerchantOverview } from "@/components/merchant/MerchantOverview";
import { MerchantReviews, StoreReview } from "@/components/merchant/MerchantReviews";
import { emptyStore, StoreFormValues, StoreSettingsForm } from "@/components/merchant/StoreSettingsForm";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { Coupon, db, DeliveryOrder, DeliveryProduct, DeliveryStore, errorMessage, slugify } from "@/lib/delivery";

const merchantOrderSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario,notas), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";

/** Aviso sonoro corto para pedidos nuevos (sin archivos de audio). */
function beep() {
  try {
    const context = new AudioContext();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.15, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + 0.5);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.5);
  } catch {
    // Sin audio disponible: alcanza con el aviso visual.
  }
}

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

  const loadStore = useCallback(async () => {
    if (!user) return null;
    const { data } = await db.from("delivery_comercios").select("*").eq("propietario_id", user.id).order("created_at").limit(1).maybeSingle();
    setStore(data || null);
    setLoading(false);
    return data as DeliveryStore | null;
  }, [user]);

  const loadOrders = useCallback(async (storeId: string) => {
    const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const { data } = await db.from("delivery_pedidos").select(merchantOrderSelect).eq("comercio_id", storeId).gte("created_at", since).order("created_at", { ascending: false }).limit(300);
    const list: DeliveryOrder[] = data || [];
    const pending = list.filter((order) => order.estado === "pendiente").map((order) => order.id);
    if (knownPending.current && pending.some((id) => !knownPending.current!.has(id))) {
      beep();
      toast.success("¡Entró un pedido nuevo!");
    }
    knownPending.current = new Set(pending);
    setOrders(list);
  }, []);

  const loadProducts = useCallback(async (storeId: string) => {
    const { data } = await db.from("delivery_productos").select("*").eq("comercio_id", storeId).order("categoria").order("nombre");
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
    toast.success("¡Tu comercio está listo! Ahora cargá tu menú.");
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

  const toggleOpen = async (open: boolean) => {
    if (!store) return;
    setStore({ ...store, esta_abierto: open });
    const { error } = await db.from("delivery_comercios").update({ esta_abierto: open }).eq("id", store.id);
    if (error) { toast.error(errorMessage(error)); loadStore(); return; }
    toast.success(open ? "Tu comercio está abierto" : "Pausaste la recepción de pedidos");
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
  const formValues: StoreFormValues = {
    nombre: store.nombre, categoria: store.categoria, rubro: store.rubro || "", descripcion: store.descripcion || "", direccion: store.direccion, telefono: store.telefono || "",
    horario: store.horario || "", imagen_url: store.imagen_url || "", logo_url: store.logo_url || "", tiempo_min: store.tiempo_min, tiempo_max: store.tiempo_max,
    costo_envio: Number(store.costo_envio), pedido_minimo: Number(store.pedido_minimo), envio_gratis_desde: store.envio_gratis_desde ?? null, promo_texto: store.promo_texto || "", esta_abierto: store.esta_abierto,
  };

  return (
    <div className="mx-auto max-w-7xl px-4 pb-16 pt-5 sm:px-6 lg:px-8">
      <PageHeader
        eyebrow="Panel del comercio"
        title={store.nombre}
        subtitle={<Link to={`/app/tienda/${store.slug}`} className="inline-flex items-center gap-1 font-bold text-primary">Ver como cliente<ExternalLink className="h-3.5 w-3.5" /></Link>}
        actions={
          <label className={`flex items-center gap-3 rounded-full border px-4 py-2 font-bold ${store.esta_abierto ? "border-success/40 bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>
            {store.esta_abierto ? "Abierto · recibiendo pedidos" : "Cerrado"}
            <Switch checked={store.esta_abierto} onCheckedChange={toggleOpen} />
          </label>
        }
      />
      {store.activo === false && <p className="mt-4 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Tu comercio fue pausado por administración y no aparece para los clientes. Escribinos para revisarlo.</p>}
      <div className="mt-4"><NewOrderAlert count={pendingCount} /></div>

      <Tabs value={tab} onValueChange={setTab} className="mt-6">
        <TabsList className="scrollbar-none h-auto w-full justify-start gap-1 overflow-x-auto rounded-full bg-muted p-1">
          {[["resumen", "Resumen"], ["pedidos", `Pedidos${pendingCount ? ` (${pendingCount})` : ""}`], ["menu", "Menú"], ["cupones", "Cupones"], ["opiniones", "Opiniones"], ["ajustes", "Configuración"]].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="shrink-0 rounded-full px-4 py-2 font-bold data-[state=active]:bg-card">{label}</TabsTrigger>
          ))}
        </TabsList>
        <TabsContent value="resumen" className="mt-6"><MerchantOverview store={store} orders={orders} /></TabsContent>
        <TabsContent value="pedidos" className="mt-6"><MerchantOrders orders={orders} onChange={() => loadOrders(store.id)} /></TabsContent>
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
