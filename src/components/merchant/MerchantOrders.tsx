import { useEffect, useMemo, useState } from "react";
import { AlarmClock, BellRing, Settings2, Bike, CalendarClock, Check, ChefHat, Clock3, MapPin, PackageCheck, Phone, Printer, Search, ShoppingBag, Store, Volume2, VolumeX, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { ChatButton } from "@/components/delivery/OrderChat";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useCourierLocation } from "@/hooks/useCourierLocation";
import { alarmReady, playChime, unlockAlarm } from "@/lib/alarm";
import { PrintAlertsPanel } from "@/components/merchant/PrintAlertsPanel";
import { AdjustmentsList, ItemStockButton } from "@/components/merchant/StockAdjust";
import { printOrderTicket, readPrintSettings } from "@/lib/print";
import { distanceKm, formatKm } from "@/lib/geo";
import { db, DeliveryOrder, DeliveryStore, EstadoPedido, errorMessage, formatDateTime, formatSlot, formatTime, metodoPagoLabel, money, optionsLabel, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const columns: { estado: EstadoPedido; title: string; hint: string }[] = [
  { estado: "pendiente", title: "Nuevos", hint: "Aceptalos o rechazalos" },
  { estado: "confirmado", title: "Aceptados", hint: "Empezá a prepararlos" },
  { estado: "preparando", title: "En preparación", hint: "Marcalos cuando estén listos" },
  { estado: "listo", title: "Listos para retirar", hint: "Esperando al cliente" },
  { estado: "en_camino", title: "En camino", hint: "Salieron del local" },
];

const PREP_OPTIONS = [10, 15, 20, 30, 45, 60];
const DELAY_OPTIONS = [5, 10, 15, 20, 30];
const REJECT_REASONS = [
  "No tenemos stock de un producto",
  "Estamos con mucha demanda en este momento",
  "Vamos a cerrar antes de horario",
  "No llegamos a esa dirección",
];

export async function changeOrderStatus(id: string, estado: EstadoPedido, motivo?: string, codigo?: string) {
  const { error } = await db.rpc("delivery_actualizar_estado", { p_pedido: id, p_estado: estado, p_motivo: motivo ?? null, p_codigo: codigo ?? null });
  if (error) { toast.error(errorMessage(error)); return false; }
  return true;
}

/** Minutos y segundos como "04:32". */
const clock = (ms: number) => {
  const total = Math.max(0, Math.floor(ms / 1000));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
};
const minutesLabel = (ms: number) => {
  const minutes = Math.round(Math.abs(ms) / 60000);
  return minutes < 1 ? "menos de 1 min" : minutes === 1 ? "1 min" : `${minutes} min`;
};

/** Reloj compartido: un solo temporizador para todas las cuentas regresivas del tablero. */
function useNow(intervalMs = 1000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

/** Suena (y titila la pestaña) mientras haya pedidos nuevos sin responder. */
function useOrderAlarm(pending: number) {
  const [muted, setMuted] = useState(() => { try { return window.localStorage.getItem("woref-merchant-muted") === "1"; } catch { return false; } });
  const [ready, setReady] = useState(alarmReady());

  useEffect(() => {
    if (!pending || muted || !ready) return;
    playChime();
    const timer = window.setInterval(playChime, 6000);
    return () => window.clearInterval(timer);
  }, [pending, muted, ready]);

  useEffect(() => {
    if (!pending) return;
    const original = document.title;
    let on = false;
    const timer = window.setInterval(() => { on = !on; document.title = on ? `(${pending}) ¡Pedido nuevo!` : original; }, 1000);
    return () => { window.clearInterval(timer); document.title = original; };
  }, [pending]);

  const enable = async () => {
    const ok = await unlockAlarm();
    setReady(ok);
    if (!ok) toast.error("Tu navegador no permitió activar el sonido");
  };
  const toggleMute = () => {
    const next = !muted;
    setMuted(next);
    try { window.localStorage.setItem("woref-merchant-muted", next ? "1" : "0"); } catch { /* sin almacenamiento */ }
  };
  return { muted, ready, enable, toggleMute };
}

export function MerchantOrders({ orders, store, onChange }: { orders: DeliveryOrder[]; store: DeliveryStore; onChange: () => void }) {
  const [view, setView] = useState<"tablero" | "historial">("tablero");
  const now = useNow();
  const pending = orders.filter((order) => order.estado === "pendiente").length;
  const alarm = useOrderAlarm(pending);

  return (
    <div>
      <div className="flex flex-wrap items-center gap-2">
        {(["tablero", "historial"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setView(item)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", view === item ? "border-foreground bg-foreground text-background" : "bg-card")}>{item === "tablero" ? "En curso" : "Historial"}</button>
        ))}
        <OrderTools />
        <button type="button" onClick={alarm.toggleMute} className="flex items-center gap-1.5 rounded-full border bg-card px-3 py-2 text-sm font-bold" aria-pressed={alarm.muted}>
          {alarm.muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}{alarm.muted ? "Sonido apagado" : "Sonido activo"}
        </button>
      </div>

      {!alarm.ready && !alarm.muted && (
        <button type="button" onClick={alarm.enable} className="mt-3 flex w-full items-center gap-3 rounded-2xl border border-warning/50 bg-warning/10 px-3 py-2 text-left text-sm">
          <BellRing className="h-4 w-4 shrink-0" />
          <span><span className="font-extrabold">Tocá para activar el sonido</span> <span className="text-muted-foreground">· el navegador lo exige para avisarte con sonido de cada pedido nuevo.</span></span>
        </button>
      )}

      {view === "tablero" ? <Board orders={orders} store={store} now={now} onChange={onChange} /> : <History orders={orders} store={store} />}
    </div>
  );
}

function Board({ orders, store, now, onChange }: { orders: DeliveryOrder[]; store: DeliveryStore; now: number; onChange: () => void }) {
  // "Listos para retirar" solo aparece si hay pedidos de retiro: para locales que solo envían no suma ruido.
  const visibleColumns = columns.filter((column) => column.estado !== "listo" || orders.some((order) => order.estado === "listo" || order.tipo_entrega === "retiro"));
  const today = new Date().toDateString();
  const todays = orders.filter((order) => order.estado !== "cancelado" && new Date(order.created_at).toDateString() === today);

  return (
    <>
      <p className="mt-4 text-sm text-muted-foreground">Hoy: <span className="font-bold text-foreground">{todays.length} {todays.length === 1 ? "pedido" : "pedidos"}</span> · <span className="font-bold text-foreground">{money(todays.reduce((total, order) => total + Number(order.subtotal), 0))}</span> en ventas</p>
      <div className="mt-3 grid gap-4 md:grid-cols-2 lg:auto-cols-[minmax(290px,1fr)] lg:grid-flow-col lg:grid-cols-none lg:overflow-x-auto lg:pb-2">
        {visibleColumns.map((column) => {
          const list = orders.filter((order) => order.estado === column.estado)
            .sort((a, b) => new Date(a.programado_para || a.created_at).getTime() - new Date(b.programado_para || b.created_at).getTime());
          return (
            <section key={column.estado} className={cn("rounded-3xl p-3", column.estado === "pendiente" && list.length ? "bg-primary/10 ring-2 ring-primary/40" : "bg-muted/60")}>
              <h3 className="flex items-center justify-between px-1 font-extrabold">{column.title}<span className={cn("rounded-full px-2 py-0.5 text-xs", list.length && column.estado === "pendiente" ? "bg-primary text-primary-foreground" : "bg-card")}>{list.length}</span></h3>
              <p className="px-1 text-xs text-muted-foreground">{column.hint}</p>
              <div className="mt-3 space-y-3">
                {list.map((order) => <OrderCard key={order.id} order={order} store={store} now={now} onChange={onChange} />)}
                {list.length === 0 && <p className="px-1 py-6 text-center text-sm text-muted-foreground">Sin pedidos</p>}
              </div>
            </section>
          );
        })}
      </div>
    </>
  );
}

function OrderCard({ order, store, now, onChange }: { order: DeliveryOrder; store: DeliveryStore; now: number; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const retiro = order.tipo_entrega === "retiro";

  const run = async (estado: EstadoPedido, motivo?: string) => {
    setBusy(true);
    const ok = await changeOrderStatus(order.id, estado, motivo);
    setBusy(false);
    if (ok) { toast.success("Pedido actualizado"); onChange(); }
  };
  const deliverPickup = async () => {
    const codigo = window.prompt("Pedile al cliente su código de retiro (4 dígitos)");
    if (!codigo) return;
    setBusy(true);
    const ok = await changeOrderStatus(order.id, "entregado", undefined, codigo.trim());
    setBusy(false);
    if (ok) { toast.success("Pedido entregado"); onChange(); }
  };
  const delay = async (minutes: number) => {
    setBusy(true);
    const { error } = await db.rpc("delivery_agregar_demora", { p_pedido: order.id, p_min: minutes });
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(`Avisamos al cliente: +${minutes} min`);
    onChange();
  };
  const acceptScheduled = async () => {
    setBusy(true);
    const { error } = await db.rpc("delivery_aceptar_pedido", { p_pedido: order.id, p_prep_min: null });
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Pedido programado aceptado");
    onChange();
  };

  const deadline = order.responder_antes_de ? new Date(order.responder_antes_de).getTime() : null;
  const received = new Date(order.visible_at || order.created_at).getTime();
  const remaining = deadline ? deadline - now : null;
  const total = deadline ? Math.max(deadline - received, 1) : 1;
  const urgent = remaining !== null && remaining < 120000;
  const promised = order.entrega_estimada ? new Date(order.entrega_estimada).getTime() : null;
  const late = promised !== null && order.estado !== "pendiente" && order.estado !== "listo" && now > promised;

  return (
    <article className={cn("rounded-2xl border bg-card p-3 shadow-soft", order.estado === "pendiente" && "border-primary/60", late && "border-destructive/60")}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-extrabold">{shortId(order.id)} <span className="font-semibold text-muted-foreground">· {order.cliente?.nombre || "Cliente"}</span></p>
          <p className="text-xs text-muted-foreground">Recibido {formatTime(order.visible_at || order.created_at)} · hace {minutesLabel(now - received)}</p>
        </div>
        <p className="font-display font-extrabold">{money(order.subtotal)}</p>
      </div>

      <div className="mt-2 flex flex-wrap gap-1.5">
        <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-extrabold", retiro ? "bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300" : "bg-primary/10 text-primary")}>{retiro ? <Store className="h-3 w-3" /> : <Bike className="h-3 w-3" />}{retiro ? "Retira en el local" : "Envío"}</span>
        {order.programado_para && <span className="inline-flex items-center gap-1 rounded-full bg-warning/20 px-2 py-0.5 text-[11px] font-extrabold"><CalendarClock className="h-3 w-3" />Programado · {formatSlot(order.programado_para)}</span>}
        {(order.demora_extra_min ?? 0) > 0 && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-extrabold">+{order.demora_extra_min} min de demora</span>}
      </div>

      {order.estado === "pendiente" && remaining !== null && (
        <div className="mt-3" role="timer" aria-label="Tiempo para responder">
          <div className="flex items-center justify-between text-xs font-bold"><span className={cn("flex items-center gap-1", urgent && "text-destructive")}><AlarmClock className="h-3.5 w-3.5" />Respondé en</span><span className={cn("tabular-nums", urgent && "text-destructive")}>{clock(remaining)}</span></div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-muted"><div className={cn("h-full rounded-full transition-all", urgent ? "bg-destructive" : remaining < total / 2 ? "bg-warning" : "bg-success")} style={{ width: `${Math.max(0, Math.min(100, (remaining / total) * 100))}%` }} /></div>
          <p className="mt-1 text-[11px] text-muted-foreground">Si no respondés a tiempo, el pedido se cancela solo.</p>
        </div>
      )}

      <ul className="mt-3 space-y-0.5 text-sm">
        {(order.items || []).map((item, index) => <li key={item.id || index}><span className="font-bold">{item.cantidad}×</span> {item.nombre}<ItemStockButton order={order} item={item} onChange={onChange} />{item.opciones && item.opciones.length > 0 && <span className="block pl-5 text-xs font-semibold text-foreground/80">{optionsLabel(item.opciones)}</span>}{item.notas && <span className="block pl-5 text-xs text-muted-foreground">“{item.notas}”</span>}</li>)}
      </ul>
      <AdjustmentsList orderId={order.id} />
      {order.notas && <p className="mt-2 rounded-lg bg-warning/15 p-2 text-xs"><span className="font-bold">Nota: </span>{order.notas}</p>}
      {order.metodo_pago === "efectivo" && order.efectivo_paga_con != null && <p className="mt-2 rounded-lg bg-muted p-2 text-xs"><span className="font-bold">Paga con {money(order.efectivo_paga_con)}</span> · vuelto {money(Number(order.efectivo_paga_con) - Number(order.total))}</p>}
      <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground"><MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" /><span>{metodoPagoLabel[order.metodo_pago]}{!retiro && ` · ${order.direccion_entrega}`}{order.distancia_km != null && !retiro && ` · ${order.distancia_km} km`}</span></p>
      {order.telefono_contacto && <a href={`tel:${order.telefono_contacto.replace(/\s/g, "")}`} className="mt-1 inline-flex items-center gap-1 text-xs font-bold text-primary"><Phone className="h-3.5 w-3.5" />{order.telefono_contacto}</a>}
      {!retiro && order.repartidor_id && order.estado !== "en_camino" && <CourierProximity order={order} store={store} />}

      {promised !== null && order.estado !== "pendiente" && (
        <p className={cn("mt-2 flex items-center gap-1 text-xs font-semibold", late ? "text-destructive" : "text-muted-foreground")}>
          <Clock3 className="h-3.5 w-3.5" />
          {order.estado === "listo" ? `Prometido para ${formatTime(order.entrega_estimada)}` : late ? `Atrasado ${minutesLabel(now - promised)} · prometido ${formatTime(order.entrega_estimada)}` : `Prometido ${formatTime(order.entrega_estimada)} · faltan ${minutesLabel(promised - now)}`}
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <ChatButton pedidoId={order.id} canal="comercio" label="Chat" title={order.cliente?.nombre || "Cliente"} subtitle={`Pedido ${shortId(order.id)}`} />
        <Button type="button" size="sm" variant="outline" className="rounded-full" onClick={() => printOrderTicket(order, store, readPrintSettings(), 1)}><Printer className="h-4 w-4" />Comanda</Button>
      </div>

      <div className="mt-2 flex flex-wrap gap-2">
        {order.estado === "pendiente" && <>
          <Button size="sm" className="flex-1 rounded-full" disabled={busy} onClick={() => (order.programado_para ? acceptScheduled() : setAccepting(true))}><Check className="h-4 w-4" />Aceptar</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => setRejecting(true)}><X className="h-4 w-4" />Rechazar</Button>
        </>}
        {order.estado === "confirmado" && <>
          <Button size="sm" className="flex-1 rounded-full" disabled={busy} onClick={() => run("preparando")}><ChefHat className="h-4 w-4" />Empezar a preparar</Button>
          <Button size="sm" variant="ghost" className="rounded-full text-destructive" disabled={busy} onClick={() => setRejecting(true)}>Cancelar</Button>
        </>}
        {order.estado === "preparando" && retiro && <Button size="sm" className="w-full rounded-full" disabled={busy} onClick={() => run("listo")}><ShoppingBag className="h-4 w-4" />Listo para retirar</Button>}
        {order.estado === "listo" && <Button size="sm" className="w-full rounded-full" disabled={busy} onClick={deliverPickup}><PackageCheck className="h-4 w-4" />Entregar al cliente</Button>}
        {order.estado === "preparando" && !retiro && (order.repartidor_id
          ? <p className="w-full rounded-xl bg-muted p-2 text-center text-xs font-semibold">El repartidor lo retira y lo marca en camino</p>
          : <Button size="sm" className="w-full rounded-full" disabled={busy} onClick={() => run("en_camino")}><Bike className="h-4 w-4" />Despachar con envío propio</Button>)}
        {order.estado === "en_camino" && !retiro && (order.repartidor_id
          ? <p className="w-full rounded-xl bg-muted p-2 text-center text-xs font-semibold">En manos del repartidor</p>
          : <Button size="sm" className="w-full rounded-full" disabled={busy} onClick={() => run("entregado")}><PackageCheck className="h-4 w-4" />Marcar entregado</Button>)}
      </div>

      {(order.estado === "confirmado" || order.estado === "preparando") && !order.programado_para && (
        <div className="mt-3 border-t pt-2">
          <p className="text-[11px] font-bold uppercase text-muted-foreground">¿Te estás demorando? Avisale al cliente</p>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {DELAY_OPTIONS.map((minutes) => <button key={minutes} type="button" disabled={busy || (order.demora_extra_min ?? 0) + minutes > 60} onClick={() => delay(minutes)} className="rounded-full border px-2.5 py-1 text-xs font-bold hover:bg-muted disabled:opacity-40">+{minutes} min</button>)}
          </div>
        </div>
      )}

      <AcceptDialog open={accepting} onOpenChange={setAccepting} order={order} defaultMinutes={store.tiempo_preparacion_min ?? 20} onDone={onChange} />
      <RejectDialog open={rejecting} onOpenChange={setRejecting} order={order} onDone={onChange} />
    </article>
  );
}

function AcceptDialog({ open, onOpenChange, order, defaultMinutes, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; order: DeliveryOrder; defaultMinutes: number; onDone: () => void }) {
  const [minutes, setMinutes] = useState(PREP_OPTIONS.includes(defaultMinutes) ? defaultMinutes : 20);
  const [saving, setSaving] = useState(false);
  const retiro = order.tipo_entrega === "retiro";
  // Se recalcula cuando se abre el diálogo o cambia el tiempo elegido.
  const eta = useMemo(() => new Date(Date.now() + (minutes + (retiro ? 0 : 5 + Math.ceil(Number(order.distancia_km || 0) * 2))) * 60000), [minutes, retiro, order.distancia_km, open]); // eslint-disable-line react-hooks/exhaustive-deps

  const accept = async () => {
    setSaving(true);
    const { error } = await db.rpc("delivery_aceptar_pedido", { p_pedido: order.id, p_prep_min: minutes });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(`Aceptado · listo en ${minutes} min`);
    onOpenChange(false);
    onDone();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-xl font-black">¿En cuánto lo tenés listo?</DialogTitle>
        <DialogDescription>Es el tiempo de preparación. Le avisamos al cliente la hora estimada.</DialogDescription>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="Tiempo de preparación">
          {PREP_OPTIONS.map((value) => (
            <button key={value} type="button" role="radio" aria-checked={minutes === value} onClick={() => setMinutes(value)} className={cn("h-14 rounded-2xl border text-lg font-black tabular-nums transition-colors", minutes === value ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{value}<span className="text-xs font-bold"> min</span></button>
          ))}
        </div>
        <p className="rounded-xl bg-muted p-3 text-sm">El cliente va a ver {retiro ? "que puede retirarlo" : "que le llega"} cerca de las <span className="font-extrabold">{formatTime(eta.toISOString())}</span></p>
        <Button className="h-12 rounded-full text-base font-bold" onClick={accept} disabled={saving}>Aceptar pedido</Button>
      </DialogContent>
    </Dialog>
  );
}

function RejectDialog({ open, onOpenChange, order, onDone }: { open: boolean; onOpenChange: (open: boolean) => void; order: DeliveryOrder; onDone: () => void }) {
  const [reason, setReason] = useState<string | null>(null);
  const [other, setOther] = useState("");
  const [saving, setSaving] = useState(false);
  const text = reason === "Otro motivo" ? other.trim() : reason;

  const reject = async () => {
    if (!text) { toast.error("Elegí un motivo: el cliente lo va a ver"); return; }
    setSaving(true);
    const ok = await changeOrderStatus(order.id, "cancelado", text);
    setSaving(false);
    if (ok) { toast.success("Pedido cancelado. Avisamos al cliente."); onOpenChange(false); onDone(); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm">
        <DialogTitle className="text-xl font-black">¿Por qué lo cancelás?</DialogTitle>
        <DialogDescription>El cliente va a ver el motivo. {order.pago_estado === "aprobado" && "Como ya pagó online, se le devuelve el dinero."}</DialogDescription>
        <div className="space-y-2" role="radiogroup" aria-label="Motivo">
          {[...REJECT_REASONS, "Otro motivo"].map((item) => (
            <button key={item} type="button" role="radio" aria-checked={reason === item} onClick={() => setReason(item)} className={cn("flex w-full items-center rounded-2xl border p-3 text-left text-sm font-bold transition-colors", reason === item ? "border-primary bg-primary/5" : "hover:bg-muted")}>{item}</button>
          ))}
        </div>
        {reason === "Otro motivo" && <Textarea value={other} maxLength={200} onChange={(event) => setOther(event.target.value)} placeholder="Contale al cliente qué pasó" className="min-h-[72px] resize-none" aria-label="Otro motivo" />}
        <Button variant="destructive" className="rounded-full" onClick={reject} disabled={saving || !text}>Cancelar pedido</Button>
      </DialogContent>
    </Dialog>
  );
}

function History({ orders, store }: { orders: DeliveryOrder[]; store: DeliveryStore }) {
  const [term, setTerm] = useState("");
  const [filter, setFilter] = useState<"todos" | "entregado" | "cancelado">("todos");
  const [open, setOpen] = useState<DeliveryOrder | null>(null);
  const closed = orders.filter((order) => order.estado === "entregado" || order.estado === "cancelado");
  const list = closed.filter((order) => (filter === "todos" || order.estado === filter) && (!term.trim() || `${shortId(order.id)} ${order.cliente?.nombre || ""}`.toLowerCase().includes(term.trim().toLowerCase())));

  return (
    <div className="mt-4">
      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-10 min-w-[220px] flex-1 items-center gap-2 rounded-full border bg-card px-4"><Search className="h-4 w-4 text-muted-foreground" /><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar por número o cliente" aria-label="Buscar pedido" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        {(["todos", "entregado", "cancelado"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setFilter(item)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", filter === item ? "border-foreground bg-foreground text-background" : "bg-card")}>{item === "todos" ? `Todos (${closed.length})` : item === "entregado" ? "Entregados" : "Cancelados"}</button>
        ))}
      </div>
      {list.length ? (
        <div className="mt-4 overflow-x-auto rounded-3xl border bg-card">
          <table className="w-full min-w-[680px] text-sm">
            <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Pedido</th><th className="p-3">Fecha</th><th className="p-3">Cliente</th><th className="p-3">Productos</th><th className="p-3">Estado</th><th className="p-3 text-right">Total</th></tr></thead>
            <tbody className="divide-y">
              {list.map((order) => (
                <tr key={order.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setOpen(order)} tabIndex={0} onKeyDown={(event) => event.key === "Enter" && setOpen(order)}>
                  <td className="p-3 font-bold">{shortId(order.id)}</td>
                  <td className="p-3">{formatDateTime(order.created_at)}</td>
                  <td className="p-3">{order.cliente?.nombre || "—"}</td>
                  <td className="max-w-[240px] truncate p-3">{(order.items || []).map((item) => `${item.cantidad}× ${item.nombre}`).join(", ")}</td>
                  <td className="p-3"><StatusBadge estado={order.estado} /></td>
                  <td className="p-3 text-right font-bold">{money(order.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <EmptyState className="mt-4" title={closed.length ? "No hay pedidos con ese filtro" : "Todavía no hay pedidos finalizados"} />}

      <Dialog open={Boolean(open)} onOpenChange={(next) => !next && setOpen(null)}>
        <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
          {open && (
            <>
              <DialogTitle className="text-xl font-black">Pedido {shortId(open.id)}</DialogTitle>
              <DialogDescription>{open.cliente?.nombre || "Cliente"} · {formatDateTime(open.created_at)}</DialogDescription>
              <ul className="divide-y text-sm">
                {(open.items || []).map((item, index) => <li key={item.id || index} className="flex justify-between gap-3 py-2"><span><span className="font-bold">{item.cantidad}×</span> {item.nombre}{item.opciones && item.opciones.length > 0 && <span className="block text-xs text-muted-foreground">{optionsLabel(item.opciones)}</span>}</span><span>{money(item.precio_unitario * item.cantidad)}</span></li>)}
              </ul>
              <dl className="space-y-1 border-t pt-2 text-sm">
                <div className="flex justify-between"><dt className="text-muted-foreground">Productos</dt><dd>{money(open.subtotal)}</dd></div>
                {Number(open.descuento) > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">Descuento {open.cupon_codigo && `(${open.cupon_codigo})`}</dt><dd>-{money(open.descuento)}</dd></div>}
                <div className="flex justify-between"><dt className="text-muted-foreground">Tipo</dt><dd>{open.tipo_entrega === "retiro" ? "Retiro en el local" : "Envío"}</dd></div>
                <div className="flex justify-between"><dt className="text-muted-foreground">Pago</dt><dd>{metodoPagoLabel[open.metodo_pago]}</dd></div>
                {open.aceptado_en_seg != null && <div className="flex justify-between"><dt className="text-muted-foreground">Respondiste en</dt><dd>{open.aceptado_en_seg < 60 ? `${open.aceptado_en_seg} s` : `${Math.round(open.aceptado_en_seg / 60)} min`}</dd></div>}
                {open.confirmado_at && (open.listo_at || open.en_camino_at) && <div className="flex justify-between"><dt className="text-muted-foreground">Preparación real</dt><dd>{Math.round((new Date((open.listo_at || open.en_camino_at) as string).getTime() - new Date(open.confirmado_at).getTime()) / 60000)} min{open.preparacion_min ? ` (prometidos ${open.preparacion_min})` : ""}</dd></div>}
                {open.motivo_cancelacion && <div className="flex justify-between gap-4"><dt className="text-muted-foreground">Motivo</dt><dd className="text-right">{open.motivo_cancelacion}</dd></div>}
              </dl>
              <Button variant="outline" className="rounded-full" onClick={() => printOrderTicket(open, store, readPrintSettings(), 1)}><Printer className="h-4 w-4" />Imprimir comanda</Button>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

export function NewOrderAlert({ count }: { count: number }) {
  if (!count) return null;
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-primary p-3 text-primary-foreground shadow-pop">
      <span className="relative flex h-3 w-3"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white opacity-75" /><span className="relative inline-flex h-3 w-3 rounded-full bg-white" /></span>
      <p className="font-bold">{count === 1 ? "Tenés 1 pedido nuevo esperando" : `Tenés ${count} pedidos nuevos esperando`}</p>
      <BellRing className="ml-auto h-5 w-5" />
    </div>
  );
}

/** Dónde está el repartidor que viene a retirar el pedido, con la distancia y una estimación de cuánto tarda. */
function CourierProximity({ order, store }: { order: DeliveryOrder; store: DeliveryStore }) {
  const position = useCourierLocation(order.repartidor_id, true);
  const km = position && store.latitud != null && store.longitud != null ? distanceKm(position, { lat: Number(store.latitud), lng: Number(store.longitud) }) : null;
  const arrived = Boolean(order.llegada_comercio_at);
  // Estimación gruesa: ~3 minutos por km en moto o bici dentro de la ciudad.
  const minutes = km != null ? Math.max(1, Math.round(km * 3)) : null;
  return (
    <p className={cn("mt-1 flex items-start gap-1 text-xs font-bold", arrived ? "text-success" : "text-foreground")}>
      <Bike className="mt-0.5 h-3.5 w-3.5 shrink-0 text-success" />
      <span>
        {arrived ? `El repartidor llegó a las ${formatTime(order.llegada_comercio_at)} y espera el pedido` : km != null ? `Repartidor a ${formatKm(km)} · llega en ~${minutes} min` : "Repartidor asignado, esperando su ubicación"}
      </span>
    </p>
  );
}

/** Atajo a la impresión automática y los avisos (la configuración completa está en Configuración → Impresión y avisos). */
function OrderTools() {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <button type="button" className="ml-auto flex items-center gap-1.5 rounded-full border bg-card px-3 py-2 text-sm font-bold" aria-label="Impresión y avisos"><Settings2 className="h-4 w-4" />Impresión y avisos</button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80"><PrintAlertsPanel /></PopoverContent>
    </Popover>
  );
}
