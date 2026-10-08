import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import type { Courier } from "@/components/courier/CourierApplication";
import { Offer, useOffers } from "@/components/courier/useOffers";
import { useAuth } from "@/contexts/AuthContext";
import { useShareCourierLocation } from "@/hooks/useCourierLocation";
import { playChime, unlockAlarm } from "@/lib/alarm";
import { db, DeliveryOrder, errorMessage } from "@/lib/delivery";
import type { Envio, EnvioOferta } from "@/lib/envios";
import type { Viaje, ViajeOferta } from "@/lib/remis";

const courierSelect = "*, items:delivery_pedido_items(id,nombre,cantidad,precio_unitario,notas,opciones), comercio:delivery_comercios(nombre,slug,imagen_url,direccion,telefono,latitud,longitud), cliente:perfiles!delivery_pedidos_cliente_id_fkey(nombre)";

/**
 * "entregas" = contexto Repartidor (pedidos de comercios y envíos de paquetes).
 * "viajes" = contexto Conductor (remís). Es la misma cuenta de trabajo (misma verificación, ubicación y billetera),
 * pero cada contexto solo consulta y muestra sus propias ofertas.
 */
export type WorkMode = "entregas" | "viajes";

/** Polling de ofertas de envíos o viajes: suena un aviso cuando aparece una nueva. */
function usePolledOffers<T extends { id: string }>(rpc: string, enabled: boolean) {
  const [list, setList] = useState<T[]>([]);
  const known = useRef<Set<string> | null>(null);
  const refresh = useCallback(async () => {
    const { data, error } = await db.rpc(rpc);
    if (!error) setList((data || []) as T[]);
  }, [rpc]);
  useEffect(() => {
    if (!enabled) { setList([]); known.current = null; return; }
    const poll = async () => {
      const { data, error } = await db.rpc(rpc);
      if (error) return;
      const next = (data || []) as T[];
      if (known.current && next.some((offer) => !known.current!.has(offer.id))) playChime();
      known.current = new Set(next.map((offer) => offer.id));
      setList(next);
    };
    poll();
    const timer = window.setInterval(poll, 6000);
    return () => window.clearInterval(timer);
  }, [rpc, enabled]);
  return { list, refresh };
}

/** Datos de la cuenta de trabajo (repartidor/conductor): estado, conexión, trabajos en curso y ofertas del contexto. */
export function useWorkerSession(mode: WorkMode) {
  const { user } = useAuth();
  const [courier, setCourier] = useState<Courier | null>(null);
  const [loading, setLoading] = useState(true);
  const [mine, setMine] = useState<DeliveryOrder[]>([]);
  const [myEnvios, setMyEnvios] = useState<Envio[]>([]);
  const [myViajes, setMyViajes] = useState<Viaje[]>([]);

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
    const { data } = await db.from("delivery_viajes").select("*").eq("conductor_id", user.id).order("created_at", { ascending: false }).limit(100);
    setMyViajes(data || []);
  }, [user]);

  useEffect(() => { reloadCourier(); }, [reloadCourier]);

  const approved = Boolean(courier?.activo && courier?.verificado);
  const connected = approved && Boolean(courier?.disponible);
  const sharing = useShareCourierLocation(connected);

  // Lo que hay en curso se mira siempre en los dos contextos: la persona no puede tomar dos trabajos a la vez.
  const currents = useMemo(() => mine.filter((order) => ["confirmado", "preparando", "en_camino"].includes(order.estado)).sort((a, b) => new Date(a.asignado_at || a.created_at).getTime() - new Date(b.asignado_at || b.created_at).getTime()), [mine]);
  const current = currents[0] || null;
  const currentEnvio = myEnvios.find((envio) => envio.estado === "asignado" || envio.estado === "retirado") || null;
  const currentViaje = myViajes.find((trip) => ["asignado", "en_origen", "a_bordo"].includes(trip.estado)) || null;
  const busyDelivery = Boolean(current) || Boolean(currentEnvio);
  const busyNow = busyDelivery || Boolean(currentViaje);

  const deliveries = mode === "entregas";
  // Con un pedido todavía sin retirar, el servidor puede ofrecer otro cercano para llevarlos juntos.
  const canBatch = currents.length > 0 && currents.length < 2 && currents.every((order) => order.tipo_entrega === "delivery" && !order.en_camino_at && order.estado !== "en_camino");
  const { offers, refresh: refreshOffers } = useOffers(deliveries && connected && !currentEnvio && !currentViaje && (!current || canBatch));
  const envios = usePolledOffers<EnvioOferta>("delivery_envios_disponibles", deliveries && connected && !busyNow);
  const canRemis = courier?.remis_estado === "aprobado" && Boolean(courier?.acepta_remis);
  const viajes = usePolledOffers<ViajeOferta>("delivery_viajes_disponibles", !deliveries && connected && canRemis && !busyNow);

  useEffect(() => {
    if (!approved) return;
    loadOrders(); loadEnvios(); loadViajes();
    const channel = db.channel(`trabajo-${mode}-${user?.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedidos", filter: `repartidor_id=eq.${user?.id}` }, loadOrders)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_envios", filter: `repartidor_id=eq.${user?.id}` }, loadEnvios)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_viajes", filter: `conductor_id=eq.${user?.id}` }, loadViajes)
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [approved, mode, user?.id, loadOrders, loadEnvios, loadViajes]);

  const delivered = useMemo(() => mine.filter((order) => order.estado === "entregado"), [mine]);
  const deliveredEnvios = useMemo(() => myEnvios.filter((envio) => envio.estado === "entregado"), [myEnvios]);
  const finishedViajes = useMemo(() => myViajes.filter((trip) => trip.estado === "completado" || trip.estado === "cancelado"), [myViajes]);

  // El servidor reparte las ofertas según el modo de trabajo: estando conectado, el panel abierto define el modo
  // (si no hay un trabajo en curso que terminar en el otro contexto).
  const modo = deliveries ? "entregas" : "viajes";
  useEffect(() => {
    if (!courier || !connected || busyNow || courier.modo_trabajo === modo) return;
    if (!deliveries && courier.remis_estado !== "aprobado") return;
    db.from("delivery_repartidores").update({ modo_trabajo: modo, ...(deliveries ? {} : { acepta_remis: true }) }).eq("perfil_id", courier.perfil_id)
      .then(({ error }: { error: unknown }) => { if (!error) setCourier((prev) => (prev ? { ...prev, modo_trabajo: modo, ...(deliveries ? {} : { acepta_remis: true }) } : prev)); });
  }, [courier?.perfil_id, courier?.modo_trabajo, connected, busyNow, modo]); // eslint-disable-line react-hooks/exhaustive-deps

  /** Conectarse/desconectarse. Conectarse fija el modo del panel (en Conductor también activa la recepción de viajes). */
  const toggleConnection = async () => {
    if (!courier) return;
    const next = !courier.disponible;
    if (next && courier.control_estado) { toast.error("Primero completá la selfie de control"); return; }
    if (next) await unlockAlarm();
    const patch: Partial<Courier> = { disponible: next };
    if (next) patch.modo_trabajo = modo;
    if (next && !deliveries && !courier.acepta_remis) patch.acepta_remis = true;
    setCourier({ ...courier, ...patch });
    const { error } = await db.from("delivery_repartidores").update(patch).eq("perfil_id", courier.perfil_id);
    if (error) { toast.error(errorMessage(error)); reloadCourier(); return; }
    toast.success(next ? (deliveries ? "Estás conectado: te van a llegar ofertas de entregas" : "Estás conectado: te van a llegar viajes") : "Te desconectaste");
  };

  const refreshAll = () => { loadOrders(); loadEnvios(); loadViajes(); refreshOffers(); envios.refresh(); viajes.refresh(); };

  return {
    loading, courier, approved, connected, reloadCourier, toggleConnection, refreshAll,
    position: sharing.position, sharingStatus: sharing.status,
    current, currents, currentEnvio, currentViaje, busyDelivery, busyNow,
    offers: offers as Offer[], envioOffers: envios.list, viajeOffers: viajes.list,
    delivered, deliveredEnvios, myViajes, finishedViajes,
  };
}

export type WorkerSession = ReturnType<typeof useWorkerSession>;
