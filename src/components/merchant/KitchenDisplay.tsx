import { useCallback, useEffect, useMemo, useState } from "react";
import { Bike, ChefHat, Flame, Hourglass, Maximize2, Minimize2, Store } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { db, DeliveryOrder, errorMessage, formatTime, optionsLabel, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type KdsItem = { nombre: string; cantidad: number; notas: string | null; opciones: unknown };
type KdsOrder = {
  id: string; estado: "confirmado" | "preparando" | "listo"; tipo_entrega: "delivery" | "retiro"; created_at: string; confirmado_at: string | null; preparando_at: string | null;
  listo_at: string | null; programado_para: string | null; notas: string | null; llegada_comercio_at: string | null; repartidor_id: string | null; repartidor: string | null;
  prep_min: number; iniciar_at: string; items: KdsItem[];
};

const minutes = (from: number, to: number) => Math.round((to - from) / 60000);

/** Pantalla de cocina (KDS): ordena por el momento óptimo para empezar, para que el pedido esté listo justo cuando llega el repartidor. */
export function KitchenDisplay({ storeId, orders, onChange }: { storeId: string; orders: DeliveryOrder[]; onChange: () => void }) {
  const [rows, setRows] = useState<KdsOrder[] | null>(null);
  const [now, setNow] = useState(Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  const version = useMemo(() => orders.map((order) => `${order.id}${order.estado}${order.repartidor_id ?? ""}${order.listo_at ?? ""}${order.llegada_comercio_at ?? ""}`).join("|"), [orders]);

  const load = useCallback(async () => {
    const { data, error } = await db.rpc("delivery_kds", { p_comercio: storeId });
    if (error) return toast.error(errorMessage(error));
    setRows((data as unknown as KdsOrder[]) || []);
  }, [storeId]);

  useEffect(() => { load(); }, [load, version]);
  useEffect(() => {
    const refresh = window.setInterval(load, 20000);
    const tick = window.setInterval(() => setNow(Date.now()), 15000);
    return () => { window.clearInterval(refresh); window.clearInterval(tick); };
  }, [load]);

  // Mantiene la pantalla encendida mientras se usa como tablero de cocina.
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    (navigator as unknown as { wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> } }).wakeLock?.request("screen").then((value) => { lock = value; }).catch(() => undefined);
    return () => { lock?.release().catch(() => undefined); };
  }, []);
  useEffect(() => {
    const onChangeFull = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChangeFull);
    return () => document.removeEventListener("fullscreenchange", onChangeFull);
  }, []);

  const run = async (id: string, action: () => PromiseLike<{ error: { message: string } | null }>) => {
    setBusy(id);
    const { error } = await action();
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    await load();
    onChange();
  };
  const start = (order: KdsOrder) => run(order.id, () => db.rpc("delivery_actualizar_estado", { p_pedido: order.id, p_estado: "preparando" }));
  const ready = (order: KdsOrder) => run(order.id, () => (order.tipo_entrega === "retiro"
    ? db.rpc("delivery_actualizar_estado", { p_pedido: order.id, p_estado: "listo" })
    : db.rpc("delivery_marcar_listo", { p_pedido: order.id })));

  const toCook = (rows || []).filter((order) => order.estado === "confirmado").sort((a, b) => new Date(a.iniciar_at).getTime() - new Date(b.iniciar_at).getTime());
  const cooking = (rows || []).filter((order) => order.estado === "preparando" && !order.listo_at).sort((a, b) => dueAt(a) - dueAt(b));
  const done = (rows || []).filter((order) => order.estado === "listo" || (order.estado === "preparando" && order.listo_at)).sort((a, b) => new Date(a.listo_at || a.created_at).getTime() - new Date(b.listo_at || b.created_at).getTime());

  function dueAt(order: KdsOrder) { return new Date(order.preparando_at || order.confirmado_at || order.created_at).getTime() + order.prep_min * 60000; }

  const toggleFull = async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else await document.getElementById("kds-root")?.requestFullscreen(); } catch { /* el navegador no lo permite */ }
  };

  return (
    <div id="kds-root" className={cn("mt-4 rounded-3xl bg-[#14201c] p-3 text-white sm:p-4", full && "min-h-screen rounded-none")}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="flex items-center gap-2 text-sm font-semibold text-white/80"><ChefHat className="h-4 w-4" />Cocina · el orden depende de cuándo llega el repartidor, no de cuándo entró el pedido.</p>
        <Button size="sm" variant="secondary" className="rounded-full" onClick={toggleFull}>{full ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}{full ? "Salir" : "Pantalla completa"}</Button>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-3">
        <Column title="Para cocinar" count={toCook.length} icon={<Flame className="h-4 w-4" />}>
          {toCook.map((order) => {
            const wait = minutes(now, new Date(order.iniciar_at).getTime());
            const late = -wait;
            return (
              <Ticket key={order.id} order={order} tone={wait > 1 ? "wait" : late > 3 ? "late" : "now"}
                badge={wait > 1 ? `Empezá en ${wait} min` : late > 3 ? `Atrasado ${late} min` : "Cocinar ya"}
                action={<Button className="h-12 w-full rounded-2xl text-base font-extrabold" variant={wait > 1 ? "secondary" : "default"} disabled={busy === order.id} onClick={() => start(order)}>{wait > 1 ? "Empezar igual" : "Empezar"}</Button>} />
            );
          })}
        </Column>
        <Column title="En preparación" count={cooking.length} icon={<Hourglass className="h-4 w-4" />}>
          {cooking.map((order) => {
            const left = minutes(now, dueAt(order));
            const waiting = Boolean(order.llegada_comercio_at);
            return (
              <Ticket key={order.id} order={order} tone={waiting || left < 0 ? "late" : left <= 3 ? "now" : "ok"}
                badge={waiting ? `${order.repartidor || "Repartidor"} esperando` : left >= 0 ? `Listo en ${left} min` : `Pasado ${-left} min`}
                action={<Button className="h-12 w-full rounded-2xl bg-emerald-500 text-base font-extrabold text-white hover:bg-emerald-600" disabled={busy === order.id} onClick={() => ready(order)}>Listo</Button>} />
            );
          })}
        </Column>
        <Column title="Listos" count={done.length} icon={<Store className="h-4 w-4" />}>
          {done.map((order) => (
            <Ticket key={order.id} order={order} tone="done" badge={order.tipo_entrega === "retiro" ? "Esperando al cliente" : order.repartidor ? `${order.repartidor} lo retira` : "Esperando repartidor"} />
          ))}
        </Column>
      </div>
      {rows && rows.length === 0 && <p className="mt-6 text-center text-white/70">No hay pedidos para preparar. Cuando aceptes uno, aparece acá.</p>}
    </div>
  );
}

function Column({ title, count, icon, children }: { title: string; count: number; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/5 p-2.5">
      <h3 className="flex items-center gap-2 px-1 pb-2 text-sm font-extrabold uppercase tracking-wide text-white/80">{icon}{title}<span className="ml-auto rounded-full bg-white/15 px-2 py-0.5 text-xs">{count}</span></h3>
      <div className="space-y-2.5">{children}</div>
    </section>
  );
}

const toneClass = { late: "border-red-400 bg-red-500/20", now: "border-amber-300 bg-amber-400/15", wait: "border-white/15 bg-white/5", ok: "border-white/20 bg-white/10", done: "border-emerald-400/50 bg-emerald-500/10" } as const;

function Ticket({ order, tone, badge, action }: { order: KdsOrder; tone: keyof typeof toneClass; badge: string; action?: React.ReactNode }) {
  return (
    <article className={cn("rounded-2xl border-2 p-3", toneClass[tone])}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <p className="text-lg font-black leading-none">{shortId(order.id)}</p>
          <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-white/70">
            {order.tipo_entrega === "retiro" ? <><Store className="h-3.5 w-3.5" />Retira en el local</> : <><Bike className="h-3.5 w-3.5" />Envío</>}
            {order.programado_para && <> · para las {formatTime(order.programado_para)}</>}
          </p>
        </div>
        <span className={cn("rounded-full px-2.5 py-1 text-xs font-extrabold", tone === "late" ? "bg-red-500 text-white" : tone === "now" ? "bg-amber-300 text-black" : tone === "done" ? "bg-emerald-500 text-white" : "bg-white/20")}>{badge}</span>
      </div>
      <ul className="mt-2 space-y-1">
        {order.items.map((item, index) => (
          <li key={`${item.nombre}-${index}`} className="text-base font-bold leading-tight">
            <span className="mr-1.5 inline-block min-w-[1.6rem] rounded-md bg-white/15 px-1.5 text-center">{item.cantidad}×</span>{item.nombre}
            {optionsLabel(item.opciones as never) && <span className="block pl-9 text-sm font-semibold text-white/70">{optionsLabel(item.opciones as never)}</span>}
            {item.notas && <span className="block pl-9 text-sm font-semibold text-amber-200">“{item.notas}”</span>}
          </li>
        ))}
      </ul>
      {order.notas && <p className="mt-2 rounded-lg bg-amber-400/20 px-2 py-1 text-sm font-semibold text-amber-100">Nota: {order.notas}</p>}
      {action && <div className="mt-3">{action}</div>}
    </article>
  );
}
