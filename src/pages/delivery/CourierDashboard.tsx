import { useCallback, useEffect, useMemo, useState } from "react";
import { Bike, Loader2, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { ActiveDelivery } from "@/components/courier/ActiveDelivery";
import { Courier, CourierApplication } from "@/components/courier/CourierApplication";
import { CourierWallet } from "@/components/courier/CourierWallet";
import { OfferCard } from "@/components/courier/OfferCard";
import { useOffers } from "@/components/courier/useOffers";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { PushPrompt } from "@/components/delivery/PushPrompt";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useAuth } from "@/contexts/AuthContext";
import { useShareCourierLocation } from "@/hooks/useCourierLocation";
import { unlockAlarm } from "@/lib/alarm";
import { db, DeliveryOrder, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const courierSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario,notas,opciones), comercio:delivery_comercios(nombre,slug,imagen_url,direccion,telefono,latitud,longitud), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";

export default function CourierDashboard() {
  const { user } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<DeliveryOrder[]>([]);

  const loadCourier = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("delivery_repartidores").select("*").eq("perfil_id", user.id).maybeSingle();
    setCourier(data || null);
    setLoading(false);
  }, [user]);

  const loadOrders = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("delivery_pedidos").select(courierSelect).eq("repartidor_id", user.id).order("created_at", { ascending: false }).limit(100);
    setMine(data || []);
  }, [user]);

  useEffect(() => { loadCourier(); }, [loadCourier]);

  const approved = Boolean(courier?.activo && courier?.verificado);
  const connected = approved && Boolean(courier?.disponible);
  const current = mine.find((order) => ["confirmado", "preparando", "en_camino"].includes(order.estado)) || null;
  const sharing = useShareCourierLocation(connected);
  const { offers, refresh } = useOffers(connected && !current);

  useEffect(() => {
    if (!approved) return;
    loadOrders();
    const channel = db.channel(`repartidor-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos", filter: `repartidor_id=eq.${user?.id}` }, loadOrders)
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [approved, user?.id, loadOrders]);

  const delivered = useMemo(() => mine.filter((order) => order.estado === "entregado"), [mine]);

  const toggleConnection = async () => {
    if (!courier) return;
    const next = !courier.disponible;
    if (next) await unlockAlarm();
    setCourier({ ...courier, disponible: next });
    const { error } = await db.from("delivery_repartidores").update({ disponible: next }).eq("perfil_id", courier.perfil_id);
    if (error) { toast.error(errorMessage(error)); loadCourier(); return; }
    toast.success(next ? "Estás conectado: te van a llegar ofertas" : "Te desconectaste");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!courier || !courier.verificado) return <CourierApplication courier={courier} onDone={loadCourier} />;
  if (!courier.activo) return <div className="mx-auto max-w-2xl px-4 py-14"><EmptyState icon={<Bike className="h-7 w-7" />} title="Tu cuenta de repartidor está pausada" text="Comunicate con soporte para reactivarla." /></div>;

  const afterRefresh = () => { loadOrders(); refresh(); };

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-5 sm:px-6">
      <PageHeader
        eyebrow="Panel de repartidor"
        title={connected ? "Estás conectado" : "Estás desconectado"}
        subtitle={connected ? (current ? "Terminá tu entrega actual para recibir nuevas ofertas." : "Te van a llegar ofertas de pedidos cerca tuyo.") : "Conectate para empezar a recibir ofertas."}
        actions={
          <Button onClick={toggleConnection} className={cn("h-12 rounded-full px-6 text-base font-extrabold", connected ? "bg-success text-white hover:bg-success/90" : "")} variant={connected ? "default" : "outline"} disabled={Boolean(current) && connected} aria-pressed={connected}>
            {connected ? <><Power className="h-5 w-5" />Conectado</> : <><PowerOff className="h-5 w-5" />Conectarme</>}
          </Button>
        }
      />

      {connected && sharing.status === "denied" && <p className="mt-4 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Necesitamos tu ubicación para ofrecerte pedidos cercanos. Habilitala desde el candado de la barra de direcciones.</p>}
      <PushPrompt className="mt-4" title="Enterate al instante de las ofertas" text="Activá los avisos: te notificamos cuando haya una oferta para vos, aunque tengas la app cerrada." />

      <Tabs defaultValue="pedidos" className="mt-6">
        <TabsList className="h-auto w-full justify-start gap-1 rounded-full bg-muted p-1">
          {[["pedidos", "Pedidos"], ["ganancias", "Ganancias"], ["historial", "Historial"]].map(([value, label]) => (
            <TabsTrigger key={value} value={value} className="flex-1 rounded-full px-4 py-2 font-bold data-[state=active]:bg-card sm:flex-none">{label}</TabsTrigger>
          ))}
        </TabsList>

        <TabsContent value="pedidos" className="mt-4">
          {current && <ActiveDelivery order={current} position={sharing.position} sharing={sharing.status} onChange={afterRefresh} />}

          {!current && connected && (
            offers.length ? (
              <div className="space-y-4">
                {offers.map((offer) => <OfferCard key={offer.pedido_id} offer={offer} onChange={afterRefresh} />)}
              </div>
            ) : (
              <EmptyState icon={<Bike className="h-7 w-7" />} title="Buscando pedidos para vos" text="Quedate conectado: apenas haya uno cerca, te suena el aviso y tenés 45 segundos para aceptarlo." />
            )
          )}
          {!current && !connected && <EmptyState icon={<PowerOff className="h-7 w-7" />} title="Estás desconectado" text="Tocá “Conectarme” para recibir ofertas de pedidos." />}
        </TabsContent>

        <TabsContent value="ganancias" className="mt-4"><CourierWallet refreshKey={delivered.length} /></TabsContent>

        <TabsContent value="historial" className="mt-4">
          {delivered.length ? (
            <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
              {delivered.slice(0, 50).map((order) => (
                <li key={order.id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span className="min-w-0"><span className="block truncate font-bold">{order.comercio?.nombre}</span><span className="block truncate text-muted-foreground">{formatDateTime(order.entregado_at || order.created_at)} · {order.direccion_entrega}</span></span>
                  <span className="shrink-0 font-bold text-success">+{money(order.ganancia_repartidor ?? Number(order.costo_envio) + Number(order.propina))}</span>
                </li>
              ))}
            </ul>
          ) : <EmptyState title="Todavía no hiciste entregas" text="Tus viajes y ganancias aparecen acá." />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
