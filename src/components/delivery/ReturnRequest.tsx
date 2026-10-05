import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Minus, PackageOpen, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { DeliveryOrder, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cancelarDevolucion, Devolucion, DestinoDevolucion, ESTADO_DEVOLUCION, fetchMisDevoluciones, motivoLabel, MOTIVOS, MotivoDevolucion, solicitarDevolucion, unidadesDisponibles } from "@/services/returns";
import { cn } from "@/lib/utils";

const PLAZO_DIAS = 7;

/** Devoluciones de un pedido entregado: ver las que ya pediste y pedir una nueva (productos, motivo y a dónde vuelve la plata). */
export function ReturnRequest({ order }: { order: DeliveryOrder }) {
  const [list, setList] = useState<Devolucion[]>([]);
  const [open, setOpen] = useState(false);
  const load = useCallback(async () => { setList((await fetchMisDevoluciones()).filter((d) => d.pedido_id === order.id)); }, [order.id]);
  useEffect(() => { load(); }, [load]);

  const items = order.items ?? [];
  const disponibles = useMemo(() => unidadesDisponibles(items, list), [items, list]);
  const quedan = [...disponibles.values()].some((n) => n > 0);
  const entregado = order.entregado_at ? new Date(order.entregado_at) : null;
  const enPlazo = !entregado || Date.now() - entregado.getTime() <= PLAZO_DIAS * 86_400_000;
  if (order.estado !== "entregado") return null;

  const cancel = async (id: string) => {
    try { await cancelarDevolucion(id); toast.success("Cancelaste la devolución"); load(); } catch (error) { toast.error(errorMessage(error)); }
  };

  return (
    <section className="mt-4 rounded-3xl border bg-card p-4 sm:p-5" aria-label="Devoluciones">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div><h2 className="flex items-center gap-2 text-lg font-extrabold"><PackageOpen className="h-5 w-5 text-primary" />Devoluciones</h2>
          <p className="text-sm text-muted-foreground">Tenés {PLAZO_DIAS} días desde la entrega para pedir una devolución.</p></div>
        {enPlazo && quedan && <Button variant="outline" className="rounded-full" onClick={() => setOpen(true)}>Pedir una devolución</Button>}
      </div>
      {list.length > 0 && (
        <ul className="mt-3 divide-y rounded-2xl border">
          {list.map((d) => (
            <li key={d.id} className="space-y-1.5 p-3 text-sm">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-bold">{money(d.monto)} · {motivoLabel(d.motivo)}</span>
                <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_DEVOLUCION[d.estado].clase)}>{ESTADO_DEVOLUCION[d.estado].texto}</span>
              </div>
              <p className="text-muted-foreground">{d.items.map((i) => `${i.cantidad}× ${i.nombre}`).join(", ")} · {formatDateTime(d.created_at)}</p>
              {d.respuesta && <p className="rounded-xl bg-muted p-2.5"><span className="font-bold">Respuesta del comercio: </span>{d.respuesta}</p>}
              {d.estado === "aprobada" && <p className="text-muted-foreground">El comercio la aprobó. Cuando confirme que recibió los productos, te devuelve la plata{d.destino === "billetera" ? " en tu billetera de Woref" : " por el medio de pago original"}.</p>}
              {d.estado === "reintegrada" && <p className="font-semibold text-success">{d.destino === "billetera" ? "Ya está en tu billetera de Woref." : "Te la devolvemos por el medio de pago original."}</p>}
              {d.estado === "solicitada" && <Button variant="ghost" size="sm" className="rounded-full text-destructive" onClick={() => cancel(d.id)}>Cancelar devolución</Button>}
            </li>
          ))}
        </ul>
      )}
      {open && <RequestDialog order={order} disponibles={disponibles} onClose={() => setOpen(false)} onDone={() => { setOpen(false); load(); }} />}
    </section>
  );
}

function RequestDialog({ order, disponibles, onClose, onDone }: { order: DeliveryOrder; disponibles: Map<string, number>; onClose: () => void; onDone: () => void }) {
  const items = (order.items ?? []).filter((i) => i.id && (disponibles.get(i.id as string) ?? 0) > 0);
  const [qty, setQty] = useState<Record<string, number>>({});
  const [motivo, setMotivo] = useState<MotivoDevolucion>("danado");
  const [detalle, setDetalle] = useState("");
  const [destino, setDestino] = useState<DestinoDevolucion>("billetera");
  const [saving, setSaving] = useState(false);

  const elegidos = Object.entries(qty).filter(([, n]) => n > 0);
  const todas = (order.items ?? []).every((i) => (qty[i.id as string] ?? 0) === i.cantidad);
  const online = order.metodo_pago === "mercadopago" && order.pago_estado === "aprobado";
  const aproximado = useMemo(() => {
    const bruto = items.reduce((total, i) => total + (qty[i.id as string] ?? 0) * Number(i.precio_unitario), 0);
    const sub = Number(order.subtotal);
    return sub > 0 ? Math.round(bruto * Math.max(sub - Number(order.descuento || 0), 0) / sub) : bruto;
  }, [items, qty, order.subtotal, order.descuento]);

  const send = async () => {
    setSaving(true);
    try {
      await solicitarDevolucion({ pedido: order.id, items: elegidos.map(([item_id, cantidad]) => ({ item_id, cantidad })), motivo, detalle, destino: online && todas ? destino : "billetera" });
      toast.success("Pedimos la devolución. El comercio la va a revisar.");
      onDone();
    } catch (error) { toast.error(errorMessage(error)); } finally { setSaving(false); }
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogTitle className="text-xl font-extrabold">Pedir una devolución</DialogTitle>
        <DialogDescription>Elegí qué querés devolver. El comercio la revisa y, si la aprueba, te devuelve la plata.</DialogDescription>
        <ul className="divide-y rounded-2xl border">
          {items.map((i) => {
            const id = i.id as string; const max = disponibles.get(id) ?? 0; const n = qty[id] ?? 0;
            return (
              <li key={id} className="flex items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1"><span className="block truncate font-bold">{i.nombre}</span><span className="block text-xs text-muted-foreground">{money(i.precio_unitario)} c/u · podés devolver hasta {max}</span></span>
                <div className="flex items-center gap-1 rounded-full border p-0.5">
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Menos ${i.nombre}`} disabled={n <= 0} onClick={() => setQty((c) => ({ ...c, [id]: n - 1 }))}><Minus className="h-4 w-4" /></Button>
                  <span className="w-5 text-center font-bold tabular-nums">{n}</span>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8 rounded-full" aria-label={`Más ${i.nombre}`} disabled={n >= max} onClick={() => setQty((c) => ({ ...c, [id]: n + 1 }))}><Plus className="h-4 w-4" /></Button>
                </div>
              </li>
            );
          })}
        </ul>
        <fieldset>
          <legend className="text-sm font-bold">Motivo</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {MOTIVOS.map((m) => <button key={m.id} type="button" aria-pressed={motivo === m.id} onClick={() => setMotivo(m.id)} className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", motivo === m.id ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{m.label}</button>)}
          </div>
        </fieldset>
        <div>
          <label htmlFor="dev-detalle" className="text-sm font-bold">Contale al comercio qué pasó (opcional)</label>
          <Textarea id="dev-detalle" value={detalle} maxLength={500} onChange={(event) => setDetalle(event.target.value)} className="mt-2 min-h-[72px] resize-none" />
        </div>
        {online && todas ? (
          <fieldset>
            <legend className="text-sm font-bold">¿Dónde querés recibir la plata?</legend>
            <div className="mt-2 grid gap-2">
              {([["billetera", "En mi billetera de Woref", "Al instante, cuando el comercio confirme."], ["medio_original", "En mi tarjeta o cuenta de Mercado Pago", "Puede demorar unos días según tu banco."]] as const).map(([id, label, hint]) => (
                <button key={id} type="button" aria-pressed={destino === id} onClick={() => setDestino(id)} className={cn("rounded-2xl border p-3 text-left", destino === id ? "border-primary bg-primary/5" : "hover:bg-muted")}><span className="block font-bold">{label}</span><span className="block text-xs text-muted-foreground">{hint}</span></button>
              ))}
            </div>
          </fieldset>
        ) : <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">La plata vuelve a tu billetera de Woref, para usarla en tu próximo pedido.</p>}
        <p className="text-sm font-semibold">Te devolvemos aproximadamente <span className="font-black">{money(aproximado)}</span>. No se devuelve el envío ni la propina.</p>
        <Button className="rounded-full" disabled={saving || elegidos.length === 0} onClick={send}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Pedir devolución</Button>
      </DialogContent>
    </Dialog>
  );
}
