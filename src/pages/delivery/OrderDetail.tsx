import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, Bike, CalendarClock, CheckCircle2, KeyRound, Loader2, MapPin, Receipt, RotateCcw, Star, Store, Wallet, XCircle } from "lucide-react";
import { toast } from "sonner";
import { BackBar, EmptyState, PageHeader } from "@/components/delivery/Common";
import { OrderTimeline, StatusBadge } from "@/components/delivery/OrderStatus";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db, DeliveryOrder, errorMessage, estadoLabel, estadoTitulo, formatDateTime, formatSlot, formatTime, img, metodoPagoLabel, money, optionsLabel, orderSelect, pedidoActivo, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { useReorder } from "@/hooks/useReorder";
import { startOnlinePayment } from "@/lib/payments";
import { useCourierLocation } from "@/hooks/useCourierLocation";
import { PushPrompt } from "@/components/delivery/PushPrompt";
import { ChatButton } from "@/components/delivery/OrderChat";
import { DeliveryProof } from "@/components/delivery/DeliveryProof";
import { OrderClaims } from "@/components/delivery/OrderClaims";
import { MapView } from "@/components/maps/LazyMaps";
import { OrderAdjustments } from "@/components/delivery/OrderAdjustments";
import { ReturnRequest } from "@/components/delivery/ReturnRequest";
import { RateProducts } from "@/components/market/RateProducts";
import { EtaBreakdown, OrderHistory } from "@/components/delivery/OrderEvents";
import { useOrderEta } from "@/hooks/useOrderEta";
import { useRoute } from "@/lib/route";
import type { MapMarker } from "@/components/maps/DeliveryMap";

const statusCopy: Record<string, string> = {
  pendiente: "El comercio está revisando tu pedido.",
  confirmado: "¡Aceptado! En breve empiezan a prepararlo.",
  preparando: "Tu pedido se está preparando.",
  listo: "Tu pedido está listo. Pasá a retirarlo con tu código.",
  en_camino: "Tu pedido va en camino. Tené a mano el código de entrega.",
  entregado: "¡Que lo disfrutes!",
  cancelado: "Este pedido fue cancelado.",
};

export default function OrderDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const reorder = useReorder();
  const [order, setOrder] = useState<DeliveryOrder | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [busy, setBusy] = useState(false);
  const [paying, setPaying] = useState(false);
  const [searchParams, setSearchParams] = useSearchParams();

  // Al volver de Mercado Pago: avisamos el resultado (la confirmación real llega por el aviso del servidor).
  useEffect(() => {
    const result = searchParams.get("pago");
    if (!result) return;
    if (result === "aprobado") toast.success("¡Pago recibido! Estamos confirmándolo con Mercado Pago.");
    else if (result === "pendiente") toast.info("Tu pago quedó en proceso. Te avisamos cuando se acredite.");
    else toast.error("El pago no se completó. Podés intentarlo de nuevo.");
    setSearchParams({}, { replace: true });
  }, [searchParams, setSearchParams]);

  const pay = async () => {
    if (!order) return;
    setPaying(true);
    try {
      await startOnlinePayment(order.id);
    } catch (error) {
      toast.error((error as Error).message);
      setPaying(false);
    }
  };
  const courier = useCourierLocation(order?.repartidor_id, Boolean(order && pedidoActivo(order.estado)));
  // Tiempo real hasta el cliente (si ya salió) o hasta el local (si va a retirarlo), por las calles.
  const etaTarget = order && courier
    ? order.estado === "en_camino" ? (order.latitud != null && order.longitud != null ? { lat: Number(order.latitud), lng: Number(order.longitud) } : null)
      : (order.estado === "confirmado" || order.estado === "preparando") && order.comercio?.latitud != null && order.comercio?.longitud != null ? { lat: Number(order.comercio.latitud), lng: Number(order.comercio.longitud) } : null
    : null;
  const serverEta = useOrderEta(order?.id, Boolean(order && pedidoActivo(order.estado) && order.estado !== "pendiente"));
  const eta = useRoute(courier, etaTarget, { profile: "moto", refreshMs: 60000 });

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_pedidos").select(orderSelect).eq("id", id).maybeSingle();
    if (!data) { setNotFound(true); return; }
    setOrder(data);
  }, [id]);

  useEffect(() => {
    load();
    db.from("delivery_pedido_codigos").select("codigo").eq("pedido_id", id).maybeSingle().then(({ data }: { data: { codigo: string } | null }) => setCode(data?.codigo ?? null));
    const channel = db.channel(`pedido-${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "delivery_pedidos", filter: `id=eq.${id}` }, (payload: { new: Partial<DeliveryOrder> }) => {
        setOrder((current) => (current ? { ...current, ...payload.new } : current));
        if (payload.new.estado) toast(estadoLabel[payload.new.estado], { icon: "🛵" });
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [id, load]);

  if (notFound) return <div className="mx-auto max-w-2xl px-4 py-14"><EmptyState icon={<Receipt className="h-7 w-7" />} title="No encontramos este pedido" action={<Button asChild className="rounded-full"><Link to="/app/pedidos">Ver mis pedidos</Link></Button>} /></div>;
  if (!order) return <div className="mx-auto max-w-3xl px-4 py-6"><div className="h-60 animate-pulse rounded-3xl bg-muted" /></div>;

  const cancel = async () => {
    if (!window.confirm("¿Seguro que querés cancelar el pedido?")) return;
    setBusy(true);
    const { error } = await db.rpc("delivery_actualizar_estado", { p_pedido: order.id, p_estado: "cancelado", p_motivo: "Cancelado por el cliente" });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Pedido cancelado");
    load();
  };

  const active = pedidoActivo(order.estado);
  const retiro = order.tipo_entrega === "retiro";
  const canCancel = order.estado === "pendiente" || (order.estado === "confirmado" && Boolean(order.programado_para) && new Date(order.programado_para as string).getTime() > Date.now() + 3600000);
  const awaitingPayment = order.metodo_pago === "mercadopago" && order.estado === "pendiente" && (order.pago_estado === "pendiente" || order.pago_estado === "rechazado");
  const markers: MapMarker[] = [
    ...(order.comercio?.latitud != null && order.comercio?.longitud != null ? [{ lat: Number(order.comercio.latitud), lng: Number(order.comercio.longitud), kind: "store" as const, label: order.comercio.nombre }] : []),
    ...(order.latitud != null && order.longitud != null ? [{ lat: Number(order.latitud), lng: Number(order.longitud), kind: "home" as const, label: "Tu dirección" }] : []),
    ...(courier ? [{ lat: courier.lat, lng: courier.lng, kind: "courier" as const, label: "Repartidor" }] : []),
  ];

  // Seguimiento tipo app de delivery: el mapa ocupa la parte de arriba y los datos del pedido se apoyan debajo como una hoja.
  const showMap = active && !retiro && markers.length > 1;

  return (
    <div className="mx-auto max-w-3xl pb-16 sm:px-6">
      {!showMap && <BackBar className="-mx-0 mb-1 sm:rounded-b-2xl sm:border-x" />}
      {showMap && (
        <div className="relative sm:pt-5">
          <MapView markers={markers} className="h-[42vh] min-h-[280px] rounded-none sm:h-96 sm:rounded-3xl" />
          <button type="button" aria-label="Volver a mis pedidos" onClick={() => navigate("/app/pedidos")} className="absolute left-4 top-4 z-[500] flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-pop sm:left-3 sm:top-8"><ArrowLeft className="h-5 w-5" /></button>
          <p className="absolute inset-x-4 bottom-8 z-[500] mx-auto w-fit max-w-full rounded-full bg-card/95 px-3 py-1.5 text-center text-xs font-bold shadow-soft sm:bottom-3">
            {courier ? (eta ? `${order.estado === "en_camino" ? "Llega" : "Llega al local"} en ~${eta.min} min · en vivo` : `Repartidor en camino · actualizado ${formatTime(courier.updatedAt)}`) : order.repartidor_id ? "Esperando la ubicación del repartidor…" : "Cuando un repartidor tome tu pedido, lo vas a ver moverse acá"}
          </p>
        </div>
      )}
      <div className={cn("relative z-10 bg-background px-4 pt-5", showMap ? "-mt-6 rounded-t-[28px] sm:mt-0 sm:rounded-none sm:px-0" : "sm:px-0")}>
      <PageHeader
        eyebrow={`Pedido ${shortId(order.id)}`}
        title={awaitingPayment ? "Falta completar el pago" : estadoTitulo(order)}
        subtitle={awaitingPayment ? "El comercio recibe tu pedido apenas Mercado Pago confirma el pago." : order.estado === "en_camino" && retiro ? statusCopy.listo : statusCopy[order.estado]}
        actions={<StatusBadge estado={order.estado} />}
      />

      {order.metodo_pago === "mercadopago" && <PaymentStatus order={order} onPay={pay} paying={paying} />}
      <OrderAdjustments orderId={order.id} onChange={load} />

      {order.estado !== "cancelado" && (
        <section className="mt-6 rounded-3xl border border-t-4 border-t-brand-yellow bg-card p-4 sm:p-6">
          {active && order.entrega_estimada && (
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl brand-tile">{order.programado_para ? <CalendarClock className="h-6 w-6" /> : retiro ? <Store className="h-6 w-6" /> : <Bike className="h-6 w-6 animate-ride" />}</span>
              <div>
                <p className="text-sm text-muted-foreground">{order.programado_para ? (retiro ? "Retiro programado" : "Entrega programada") : retiro ? "Listo aproximadamente" : eta && order.estado === "en_camino" ? "Tu repartidor llega en" : "Llegada estimada"}</p>
                <p className="font-display text-2xl font-extrabold">{order.programado_para ? formatSlot(order.programado_para) : eta && order.estado === "en_camino" ? `~${eta.min} min` : serverEta?.hora ? formatTime(serverEta.hora) : formatTime(order.entrega_estimada)}</p>
                {serverEta && !order.programado_para && !(eta && order.estado === "en_camino") && <p className="text-xs font-semibold text-muted-foreground">en unos {serverEta.minutos} min</p>}
              </div>
            </div>
          )}
          {active && serverEta && !order.programado_para && <EtaBreakdown eta={serverEta} retiro={retiro} className="mb-5" />}
          <OrderTimeline order={order} />
        </section>
      )}

      <OrderHistory orderId={order.id} version={`${order.estado}-${order.repartidor_id ?? ""}-${order.llegada_comercio_at ?? ""}-${order.llegada_cliente_at ?? ""}`} retiro={retiro} className="mt-4" />

      {order.estado === "cancelado" && (
        <div className="mt-6 flex items-start gap-3 rounded-3xl border border-destructive/30 bg-destructive/5 p-4">
          <XCircle className="h-6 w-6 shrink-0 text-destructive" />
          <div><p className="font-bold">Pedido cancelado</p><p className="text-sm text-muted-foreground">{order.motivo_cancelacion || "No se cobró nada."}</p></div>
        </div>
      )}

      {active && !retiro && order.llegada_cliente_at && <p className="mt-4 flex items-center gap-2 rounded-2xl bg-success/10 p-4 font-bold text-success"><Bike className="h-5 w-5" />¡Tu repartidor llegó! Salí a recibir tu pedido y dale el código de entrega.</p>}

      {active && code && (
        <section className="mt-4 flex items-center justify-between gap-4 rounded-3xl bg-brand-deep p-5 text-white">
          <div className="flex items-center gap-3"><KeyRound className="h-6 w-6" /><div><p className="font-bold">{retiro ? "Código de retiro" : "Código de entrega"}</p><p className="text-sm text-white/70">{retiro ? "Mostralo en el local cuando vayas a retirar." : "Dáselo al repartidor solo cuando recibas tu pedido."}</p></div></div>
          <span className="font-display text-3xl font-extrabold tracking-[0.3em]">{code}</span>
        </section>
      )}

      {order.estado === "entregado" && <DeliveryProof path={order.foto_entrega_path} />}

      {active && !awaitingPayment && (
        <div className="mt-4 flex flex-wrap gap-2">
          <ChatButton pedidoId={order.id} canal="comercio" label={order.comercio?.nombre ? `Escribirle a ${order.comercio.nombre}` : "Escribirle al local"} title={order.comercio?.nombre ?? "Comercio"} subtitle="Consultas sobre tu pedido" autoOpen={searchParams.get("chat") === "comercio"} />
          {order.repartidor_id && !retiro && <ChatButton pedidoId={order.id} canal="repartidor" label="Chat con el repartidor" title="Tu repartidor" subtitle="Para coordinar la entrega" autoOpen={searchParams.get("chat") === "repartidor"} />}
        </div>
      )}

      {active && <PushPrompt className="mt-4" title="¿Te avisamos cuando salga tu pedido?" text="Activá los avisos y te contamos cada paso aunque cierres la app." />}

      {order.estado === "entregado" && !order.calificado && <RateOrder orderId={order.id} storeName={order.comercio?.nombre || "el comercio"} onDone={load} />}

      <OrderClaims order={order} />

      <section className="mt-4 rounded-3xl border bg-card p-4 sm:p-5">
        <Link to={`/app/tienda/${order.comercio?.slug}`} className="flex items-center gap-3">
          <img src={img(order.comercio?.imagen_url, 200)} alt="" className="h-14 w-14 rounded-2xl object-cover" />
          <div className="min-w-0"><p className="truncate font-extrabold">{order.comercio?.nombre}</p><p className="flex items-center gap-1 truncate text-sm text-muted-foreground"><Store className="h-3.5 w-3.5" />{order.comercio?.direccion}</p></div>
        </Link>
        <ul className="mt-4 divide-y border-t">
          {(order.items || []).map((item, index) => (
            <li key={item.id || index} className="flex justify-between gap-3 py-2.5 text-sm">
              <span><span className="font-bold">{item.cantidad}×</span> {item.nombre}{item.opciones && item.opciones.length > 0 && <span className="block text-xs text-muted-foreground">{optionsLabel(item.opciones)}</span>}{item.notas && <span className="block text-xs text-muted-foreground">“{item.notas}”</span>}</span>
              <span className="shrink-0">{money(item.precio_unitario * item.cantidad)}</span>
            </li>
          ))}
        </ul>
        <dl className="space-y-1.5 border-t pt-3 text-sm">
          <div className="flex justify-between"><dt className="text-muted-foreground">Productos</dt><dd>{money(order.subtotal)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Envío</dt><dd>{Number(order.costo_envio) === 0 ? "Gratis" : money(order.costo_envio)}</dd></div>
          <div className="flex justify-between"><dt className="text-muted-foreground">Tarifa de servicio</dt><dd>{money(order.tarifa_servicio)}</dd></div>
          {Number(order.propina) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Propina</dt><dd>{money(order.propina)}</dd></div>}
          {Number(order.descuento) > 0 && <div className="flex justify-between font-bold text-success"><dt>Descuento {order.cupon_codigo && `(${order.cupon_codigo})`}</dt><dd>-{money(order.descuento)}</dd></div>}
          <div className="flex justify-between pt-2 font-display text-lg font-extrabold"><dt>Total</dt><dd>{money(order.total)}</dd></div>
        </dl>
      </section>

      {order.estado === "entregado" && <RateProducts orderId={order.id} />}
      <ReturnRequest order={order} />

      <section className="mt-4 grid gap-3 rounded-3xl border bg-card p-4 text-sm sm:grid-cols-2 sm:p-5">
        <div className="flex gap-2"><MapPin className="h-5 w-5 shrink-0 text-primary" /><div><p className="font-bold">{retiro ? "Retiro" : "Entrega en"}</p><p className="text-muted-foreground">{order.direccion_entrega}</p></div></div>
        <div className="flex gap-2"><Receipt className="h-5 w-5 shrink-0 text-primary" /><div><p className="font-bold">Pago</p><p className="text-muted-foreground">{metodoPagoLabel[order.metodo_pago]} · {formatDateTime(order.created_at)}</p>{order.metodo_pago === "efectivo" && order.efectivo_paga_con != null && <p className="text-muted-foreground">Pagás con {money(order.efectivo_paga_con)} · vuelto {money(Number(order.efectivo_paga_con) - Number(order.total))}</p>}</div></div>
        {order.notas && <p className="text-muted-foreground sm:col-span-2"><span className="font-bold text-foreground">Comentarios: </span>{order.notas}</p>}
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {canCancel && <Button variant="outline" className="rounded-full text-destructive" onClick={cancel} disabled={busy}><XCircle className="h-4 w-4" />Cancelar pedido</Button>}
        {order.estado === "entregado" && <Button variant="outline" className="rounded-full" onClick={async () => { if (await reorder(order)) navigate("/app/carrito"); }}><RotateCcw className="h-4 w-4" />Repetir pedido</Button>}
      </div>
      </div>
    </div>
  );
}

function RateOrder({ orderId, storeName, onDone }: { orderId: string; storeName: string; onDone: () => void }) {
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!score) return toast.error("Elegí de 1 a 5 estrellas");
    setSending(true);
    const { error } = await db.rpc("delivery_calificar", { p_pedido: orderId, p_puntaje: score, p_comentario: comment.trim() || null });
    setSending(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("¡Gracias por tu opinión!");
    onDone();
  };

  return (
    <section className="mt-4 rounded-3xl border border-primary/30 bg-primary/5 p-4 sm:p-5">
      <h2 className="text-lg font-extrabold">¿Qué tal estuvo {storeName}?</h2>
      <div className="mt-3 flex gap-1">
        {[1, 2, 3, 4, 5].map((value) => (
          <button key={value} type="button" aria-label={`${value} estrellas`} onClick={() => setScore(value)} className="transition-transform active:scale-90">
            <Star className={cn("h-9 w-9", value <= score ? "fill-warning text-warning" : "text-muted-foreground/40")} />
          </button>
        ))}
      </div>
      <Textarea value={comment} onChange={(event) => setComment(event.target.value)} maxLength={500} placeholder="Contanos tu experiencia (opcional)" className="mt-3 min-h-[72px] resize-none bg-card" />
      <Button className="mt-3 rounded-full" onClick={send} disabled={sending}>Enviar calificación</Button>
    </section>
  );
}

function PaymentStatus({ order, onPay, paying }: { order: DeliveryOrder; onPay: () => void; paying: boolean }) {
  const status = order.pago_estado;
  if (status === "aprobado") {
    return <p className="mt-4 flex items-center gap-2 rounded-2xl bg-success/10 p-3 text-sm font-semibold text-success"><CheckCircle2 className="h-5 w-5" />Pagado con Mercado Pago</p>;
  }
  if (status === "a_reintegrar" || status === "reintegrado") {
    return <p className="mt-4 rounded-2xl bg-info/10 p-3 text-sm font-semibold text-info">{status === "a_reintegrar" ? "Como el pedido se canceló, te vamos a devolver el dinero en el mismo medio de pago." : "Ya te devolvimos el dinero de este pedido."}</p>;
  }
  if (order.estado !== "pendiente") return null;
  return (
    <section className={`mt-4 rounded-3xl border p-4 sm:p-5 ${status === "rechazado" ? "border-destructive/30 bg-destructive/5" : "border-warning/40 bg-warning/10"}`}>
      <p className="font-bold">{status === "rechazado" ? "Mercado Pago rechazó el pago" : "Tu pedido está reservado"}</p>
      <p className="mt-1 text-sm text-muted-foreground">{status === "rechazado" ? "Probá con otra tarjeta o medio de pago." : "Completá el pago para que el comercio lo reciba."} Si no se paga en 30 minutos, se cancela solo.</p>
      <Button className="mt-3 rounded-full" onClick={onPay} disabled={paying}>{paying ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wallet className="h-4 w-4" />}Pagar {money(order.total)} con Mercado Pago</Button>
    </section>
  );
}