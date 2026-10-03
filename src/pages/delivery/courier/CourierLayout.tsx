import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Outlet, useLocation, useOutletContext } from "react-router-dom";
import { Bike, ClipboardList, Loader2, Power, PowerOff, Target, UserCircle, Wallet, History } from "lucide-react";
import { toast } from "sonner";
import { Courier, CourierApplication } from "@/components/courier/CourierApplication";
import { SelfieControl } from "@/components/courier/SelfieControl";
import { Offer, useOffers } from "@/components/courier/useOffers";
import { EmptyState } from "@/components/delivery/Common";
import { PushPrompt } from "@/components/delivery/PushPrompt";
import { PanelShell } from "@/components/panel/PanelShell";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { useShareCourierLocation } from "@/hooks/useCourierLocation";
import { playChime, unlockAlarm } from "@/lib/alarm";
import { db, DeliveryOrder, errorMessage } from "@/lib/delivery";
import type { Envio, EnvioOferta } from "@/lib/envios";
import type { Viaje, ViajeOferta } from "@/lib/remis";
import type { GeoPoint } from "@/lib/geo";
import { cn } from "@/lib/utils";

const courierSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario,notas,opciones), comercio:delivery_comercios(nombre,slug,imagen_url,direccion,telefono,latitud,longitud), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";

export type CourierContext = {
  courier: Courier;
  connected: boolean;
  current: DeliveryOrder | null;
  /** Todos los pedidos en curso (hay más de uno cuando se agrupan pedidos cercanos). */
  currents: DeliveryOrder[];
  currentEnvio: Envio | null;
  currentViaje: Viaje | null;
  viajeOffers: ViajeOferta[];
  delivered: DeliveryOrder[];
  deliveredEnvios: Envio[];
  offers: Offer[];
  envioOffers: EnvioOferta[];
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
  const [myEnvios, setMyEnvios] = useState<Envio[]>([]);
  const [envioOffers, setEnvioOffers] = useState<EnvioOferta[]>([]);
  const [myViajes, setMyViajes] = useState<Viaje[]>([]);
  const [viajeOffers, setViajeOffers] = useState<ViajeOferta[]>([]);
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

  const loadEnvios = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("delivery_envios").select("*").eq("repartidor_id", user.id).order("created_at", { ascending: false }).limit(100);
    setMyEnvios(data || []);
  }, [user]);

  const loadViajes = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("delivery_viajes").select("*").eq("conductor_id", user.id).order("created_at", { ascending: false }).limit(50);
    setMyViajes(data || []);
  }, [user]);

  useEffect(() => { reloadCourier(); }, [reloadCourier]);

  const approved = Boolean(courier?.activo && courier?.verificado);
  const connected = approved && Boolean(courier?.disponible);
  const currents = useMemo(() => mine.filter((order) => ["confirmado", "preparando", "en_camino"].includes(order.estado)).sort((a, b) => new Date(a.asignado_at || a.created_at).getTime() - new Date(b.asignado_at || b.created_at).getTime()), [mine]);
  const current = currents[0] || null;
  const sharing = useShareCourierLocation(connected);
  const hasEnvio = Boolean(myEnvios.find((envio) => envio.estado === "asignado" || envio.estado === "retirado"));
  const currentViaje = myViajes.find((trip) => ["asignado", "en_origen", "a_bordo"].includes(trip.estado)) || null;
  const hasViaje = Boolean(currentViaje);
  // Con un pedido todavía sin retirar, el servidor puede ofrecer otro cercano para llevarlos juntos.
  const canBatch = currents.length > 0 && currents.length < 2 && currents.every((order) => order.tipo_entrega === "delivery" && !order.en_camino_at && order.estado !== "en_camino");
  const { offers, refresh } = useOffers(connected && !hasEnvio && !hasViaje && (!current || canBatch));

  // Ofertas de envíos de paquetes: el servidor muestra solo las cercanas y mientras no estés ocupado.
  const refreshEnvioOffers = useCallback(async () => {
    const { data, error } = await db.rpc("delivery_envios_disponibles");
    if (!error) setEnvioOffers((data || []) as EnvioOferta[]);
  }, []);
  const knownEnvios = useRef<Set<string> | null>(null);
  useEffect(() => {
    if (!connected || current || hasEnvio || hasViaje) { setEnvioOffers([]); knownEnvios.current = null; return; }
    const poll = async () => {
      const { data, error } = await db.rpc("delivery_envios_disponibles");
      if (error) return;
      const list = (data || []) as EnvioOferta[];
      if (knownEnvios.current && list.some((offer) => !knownEnvios.current!.has(offer.id))) playChime();
      knownEnvios.current = new Set(list.map((offer) => offer.id));
      setEnvioOffers(list);
    };
    poll();
    const timer = window.setInterval(poll, 6000);
    return () => window.clearInterval(timer);
  }, [connected, current, hasEnvio, hasViaje]);

  // Ofertas de remís: solo para conductores habilitados, libres y sin otro servicio en curso.
  const knownViajes = useRef<Set<string> | null>(null);
  const canRemis = Boolean(courier?.acepta_remis);
  const refreshViajeOffers = useCallback(async () => {
    const { data, error } = await db.rpc("delivery_viajes_disponibles");
    if (!error) setViajeOffers((data || []) as ViajeOferta[]);
  }, []);
  useEffect(() => {
    if (!connected || !canRemis || current || hasEnvio || hasViaje) { setViajeOffers([]); knownViajes.current = null; return; }
    const poll = async () => {
      const { data, error } = await db.rpc("delivery_viajes_disponibles");
      if (error) return;
      const list = (data || []) as ViajeOferta[];
      if (knownViajes.current && list.some((offer) => !knownViajes.current!.has(offer.id))) playChime();
      knownViajes.current = new Set(list.map((offer) => offer.id));
      setViajeOffers(list);
    };
    poll();
    const timer = window.setInterval(poll, 6000);
    return () => window.clearInterval(timer);
  }, [connected, canRemis, current, hasEnvio, hasViaje]);

  useEffect(() => {
    if (!approved) return;
    loadOrders();
    loadEnvios();
    loadViajes();
    const channel = db.channel(`repartidor-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos", filter: `repartidor_id=eq.${user?.id}` }, loadOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_envios", filter: `repartidor_id=eq.${user?.id}` }, loadEnvios)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_viajes", filter: `conductor_id=eq.${user?.id}` }, loadViajes)
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [approved, user?.id, loadOrders, loadEnvios, loadViajes]);

  const delivered = useMemo(() => mine.filter((order) => order.estado === "entregado"), [mine]);
  const currentEnvio = myEnvios.find((envio) => envio.estado === "asignado" || envio.estado === "retirado") || null;
  const deliveredEnvios = useMemo(() => myEnvios.filter((envio) => envio.estado === "entregado"), [myEnvios]);

  const toggleConnection = async () => {
    if (!courier) return;
    const next = !courier.disponible;
    if (next && courier.control_estado) { toast.error("Primero completá la selfie de control"); return; }
    if (next) await unlockAlarm();
    setCourier({ ...courier, disponible: next });
    const { error } = await db.from("delivery_repartidores").update({ disponible: next }).eq("perfil_id", courier.perfil_id);
    if (error) { toast.error(errorMessage(error)); reloadCourier(); return; }
    toast.success(next ? "Estás conectado: te van a llegar ofertas" : "Te desconectaste");
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;
  if (!courier || !courier.verificado) return <CourierApplication courier={courier} onDone={reloadCourier} />;
  if (!courier.activo) return <div className="mx-auto max-w-2xl px-4 py-14"><EmptyState icon={<Bike className="h-7 w-7" />} title="Tu cuenta de repartidor está pausada" text="Comunicate con soporte para reactivarla." /></div>;

  const refreshAll = () => { loadOrders(); loadEnvios(); loadViajes(); refresh(); refreshEnvioOffers(); refreshViajeOffers(); };
  const busyNow = Boolean(current) || hasEnvio || hasViaje;
  const context: CourierContext = { courier, connected, current, currents, currentEnvio, currentViaje, viajeOffers, delivered, deliveredEnvios, offers, envioOffers, position: sharing.position, sharingStatus: sharing.status, refreshAll, reloadCourier };

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
        { to: "/app/repartidor", label: "Pedidos", icon: ClipboardList, end: true, badge: busyNow ? undefined : offers.length + envioOffers.length + viajeOffers.length },
        { to: "/app/repartidor/ganancias", label: "Ganancias", icon: Wallet },
        { to: "/app/repartidor/incentivos", label: "Metas y turnos", icon: Target },
        { to: "/app/repartidor/historial", label: "Historial", icon: History },
        { to: "/app/repartidor/perfil", label: "Mi perfil", icon: UserCircle },
      ] }]}
      actions={
        <Button onClick={toggleConnection} size="sm" className={cn("h-9 rounded-full px-4 font-extrabold", connected ? "bg-success text-white hover:bg-success/90" : "")} variant={connected ? "default" : "outline"} disabled={busyNow && connected} aria-pressed={connected}>
          {connected ? <><Power className="h-4 w-4" />Conectado</> : <><PowerOff className="h-4 w-4" />Conectarme</>}
        </Button>
      }
    >
      {connected && sharing.status === "denied" && <p className="mb-4 rounded-2xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">Necesitamos tu ubicación para ofrecerte pedidos cercanos. Habilitala desde el candado de la barra de direcciones.</p>}
      <SelfieControl courier={courier} onDone={reloadCourier} />
      {location.pathname === "/app/repartidor" && <PushPrompt className="mb-4" title="Enterate al instante de las ofertas" text="Activá los avisos: te notificamos cuando haya una oferta para vos, aunque tengas la app cerrada." />}
      <Outlet context={context} />
    </PanelShell>
  );
}
