import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bike, KeyRound, MapPin, Receipt, RotateCcw, Star, Store, XCircle } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { OrderTimeline, StatusBadge } from "@/components/delivery/OrderStatus";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db, DeliveryOrder, errorMessage, estadoLabel, formatDateTime, formatTime, img, metodoPagoLabel, money, optionsLabel, orderSelect, pedidoActivo, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { useReorder } from "@/hooks/useReorder";
import { useCourierLocation } from "@/hooks/useCourierLocation";
import { PushPrompt } from "@/components/delivery/PushPrompt";
import { MapView } from "@/components/maps/LazyMaps";
import type { MapMarker } from "@/components/maps/DeliveryMap";

const statusCopy: Record<string, string> = {
  pendiente: "El comercio está revisando tu pedido.",
  confirmado: "¡Aceptado! En breve empiezan a prepararlo.",
  preparando: "Tu pedido se está preparando.",
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
  const courier = useCourierLocation(order?.repartidor_id, Boolean(order && pedidoActivo(order.estado)));

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
  const markers: MapMarker[] = [
    ...(order.comercio?.latitud != null && order.comercio?.longitud != null ? [{ lat: Number(order.comercio.latitud), lng: Number(order.comercio.longitud), kind: "store" as const, label: order.comercio.nombre }] : []),
    ...(order.latitud != null && order.longitud != null ? [{ lat: Number(order.latitud), lng: Number(order.longitud), kind: "home" as const, label: "Tu dirección" }] : []),
    ...(courier ? [{ lat: courier.lat, lng: courier.lng, kind: "courier" as const, label: "Repartidor" }] : []),
  ];

  return (
    <div className="mx-auto max-w-3xl px-4 pb-16 pt-5 sm:px-6">
      <PageHeader back="/app/pedidos" eyebrow={`Pedido ${shortId(order.id)}`} title={estadoLabel[order.estado]} subtitle={statusCopy[order.estado]} actions={<StatusBadge estado={order.estado} />} />

      {order.estado !== "cancelado" && (
        <section className="mt-6 rounded-3xl border bg-card p-4 sm:p-6">
          {active && order.entrega_estimada && (
            <div className="mb-5 flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Bike className="h-6 w-6 animate-ride" /></span>
              <div><p className="text-sm text-muted-foreground">Llegada estimada</p><p className="font-display text-2xl font-extrabold">{formatTime(order.entrega_estimada)}</p></div>
            </div>
          )}
          <OrderTimeline order={order} />
          {active && markers.length > 1 && (
            <>
              <MapView markers={markers} className="mt-5 h-64 sm:h-80" />
              <p className="mt-2 text-xs text-muted-foreground">
                {courier ? `Repartidor en camino · ubicación actualizada ${formatTime(courier.updatedAt)}` : order.repartidor_id ? "Esperando la ubicación del repartidor…" : "Cuando un repartidor tome tu pedido, lo vas a ver moverse en el mapa."}
              </p>
            </>
          )}
        </section>
      )}

      {order.estado === "cancelado" && (
        <div className="mt-6 flex items-start gap-3 rounded-3xl border border-destructive/30 bg-destructive/5 p-4">
          <XCircle className="h-6 w-6 shrink-0 text-destructive" />
          <div><p className="font-bold">Pedido cancelado</p><p className="text-sm text-muted-foreground">{order.motivo_cancelacion || "No se cobró nada."}</p></div>
        </div>
      )}

      {active && code && (
        <section className="mt-4 flex items-center justify-between gap-4 rounded-3xl bg-brand-deep p-5 text-white">
          <div className="flex items-center gap-3"><KeyRound className="h-6 w-6" /><div><p className="font-bold">Código de entrega</p><p className="text-sm text-white/70">Dáselo al repartidor solo cuando recibas tu pedido.</p></div></div>
          <span className="font-display text-3xl font-extrabold tracking-[0.3em]">{code}</span>
        </section>
      )}

      {active && <PushPrompt className="mt-4" title="¿Te avisamos cuando salga tu pedido?" text="Activá los avisos y te contamos cada paso aunque cierres la app." />}

      {order.estado === "entregado" && !order.calificado && <RateOrder orderId={order.id} storeName={order.comercio?.nombre || "el comercio"} onDone={load} />}

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

      <section className="mt-4 grid gap-3 rounded-3xl border bg-card p-4 text-sm sm:grid-cols-2 sm:p-5">
        <div className="flex gap-2"><MapPin className="h-5 w-5 shrink-0 text-primary" /><div><p className="font-bold">Entrega en</p><p className="text-muted-foreground">{order.direccion_entrega}</p></div></div>
        <div className="flex gap-2"><Receipt className="h-5 w-5 shrink-0 text-primary" /><div><p className="font-bold">Pago</p><p className="text-muted-foreground">{metodoPagoLabel[order.metodo_pago]} · {formatDateTime(order.created_at)}</p></div></div>
        {order.notas && <p className="text-muted-foreground sm:col-span-2"><span className="font-bold text-foreground">Comentarios: </span>{order.notas}</p>}
      </section>

      <div className="mt-5 flex flex-wrap gap-2">
        {order.estado === "pendiente" && <Button variant="outline" className="rounded-full text-destructive" onClick={cancel} disabled={busy}><XCircle className="h-4 w-4" />Cancelar pedido</Button>}
        {order.estado === "entregado" && <Button variant="outline" className="rounded-full" onClick={async () => { if (await reorder(order)) navigate("/app/carrito"); }}><RotateCcw className="h-4 w-4" />Repetir pedido</Button>}
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
