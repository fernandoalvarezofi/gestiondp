import { useCallback, useEffect, useMemo, useState } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import { Bike, ClipboardList, Loader2, Power, PowerOff, UserCircle, Wallet, History } from "lucide-react";
import { toast } from "sonner";
import { Courier, CourierApplication } from "@/components/courier/CourierApplication";
import { Offer, useOffers } from "@/components/courier/useOffers";
import { EmptyState } from "@/components/delivery/Common";
import { PushPrompt } from "@/components/delivery/PushPrompt";
import { PanelShell } from "@/components/panel/PanelShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useShareCourierLocation } from "@/hooks/useCourierLocation";
import { unlockAlarm } from "@/lib/alarm";
import { db, DeliveryOrder, errorMessage } from "@/lib/delivery";
import type { GeoPoint } from "@/lib/geo";
import { cn } from "@/lib/utils";

const courierSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario,notas,opciones), comercio:delivery_comercios(nombre,slug,imagen_url,direccion,telefono,latitud,longitud), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";

export type CourierContext = {
  courier: Courier;
  connected: boolean;
  current: DeliveryOrder | null;
  delivered: DeliveryOrder[];
  offers: Offer[];
  position: GeoPoint | null;
  sharingStatus: string;
  refreshAll: () => void;
  reloadCourier: () => Promise<void>;
};
export const useCourier = () => useOutletContext<CourierContext>();

/** Carga los datos del repartidor y los comparte con cada sección del panel. */
export default function CourierLayout() {
  const { user } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<DeliveryOrder[]>([]);
  const location = useLocation();

  const reloadCourier = useCallback(async () => {
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

  useEffect(() => { reloadCourier(); }, [reloadCourier]);

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
    if (error) { toast.error(errorMessage(error)); reloadCourier(); return; }
    toast.success(next ? "Estás conectado: te van a llegar ofertas" : "Te desconectaste");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!courier || !courier.verificado) return <CourierApplication courier={courier} onDone={reloadCourier} />;
  if (!courier.activo) return <div className="mx-auto max-w-2xl px-4 py-14"><EmptyState icon={<Bike className="h-7 w-7" />} title="Tu cuenta de repartidor está pausada" text="Comunicate con soporte para reactivarla." /></div>;

  const refreshAll = () => { loadOrders(); refresh(); };
  const context: CourierContext = { courier, connected, current, delivered, offers, position: sharing.position, sharingStatus: sharing.status, refreshAll, reloadCourier };

  return (
    <PanelShell
      panel="Repartidores"
      bottomTabs
      identity={
        <div className="flex items-center gap-3 rounded-2xl border bg-card p-2.5 group-data-[collapsible=icon]:hidden">
          <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-full", connected ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}><Bike className="h-5 w-5" /></span>
          <div className="min-w-0"><p className="text-sm font-extrabold leading-tight">{connected ? "Conectado" : "Desconectado"}</p><p className="text-[11px] font-bold text-muted-foreground">{courier.vehiculo.replace("_", " ")} · verificado</p></div>
        </div>
      }
      groups={[{ items: [
        { to: "/app/repartidor", label: "Pedidos", icon: ClipboardList, end: true, badge: current ? undefined : offers.length },
        { to: "/app/repartidor/ganancias", label: "Ganancias", icon: Wallet },
        { to: "/app/repartidor/historial", label: "Historial", icon: History },
        { to: "/app/repartidor/perfil", label: "Mi perfil", icon: UserCircle },
      ] }]}
      actions={
        <Button onClick={toggleConnection} size="sm" className={cn("h-9 rounded-full px-4 font-extrabold", connected ? "bg-success text-white hover:bg-success/90" : "")} variant={connected ? "default" : "outline"} disabled={Boolean(current) && connected} aria-pressed={connected}>
          {connected ? <><Power className="h-4 w-4" />Conectado</> : <><PowerOff className="h-4 w-4" />Conectarme</>}
        </Button>
      }
    >
      {connected && sharing.status === "denied" && <p className="mb-4 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Necesitamos tu ubicación para ofrecerte pedidos cercanos. Habilitala desde el candado de la barra de direcciones.</p>}
      {location.pathname === "/app/repartidor" && <PushPrompt className="mb-4" title="Enterate al instante de las ofertas" text="Activá los avisos: te notificamos cuando haya una oferta para vos, aunque tengas la app cerrada." />}
      <Outlet context={context} />
    </PanelShell>
  );
}
