import { useCallback, useEffect, useState } from "react";
import { Check, Clock3, Loader2, PackageX, Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { db, DeliveryOrder, DeliveryProduct, errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export type OrderAdjustment = {
  id: string; pedido_id: string; item_id: string | null; item_nombre: string; item_cantidad: number; item_precio: number; tipo: "reemplazo" | "quitar";
  reemplazo_nombre?: string | null; reemplazo_precio?: number | null; estado: "pendiente" | "aceptado" | "rechazado" | "vencido"; vence_at: string;
};
type Item = NonNullable<DeliveryOrder["items"]>[number];

/** ¿Se puede avisar una falta de stock en este pedido? (preparando, no pagado online) */
export const canAdjust = (order: Pick<DeliveryOrder, "estado" | "metodo_pago">) => (order.estado === "confirmado" || order.estado === "preparando") && order.metodo_pago !== "mercadopago";

export function useOrderAdjustments(orderId: string) {
  const [list, setList] = useState<OrderAdjustment[]>([]);
  const load = useCallback(async () => {
    const { data } = await db.from("delivery_pedido_ajustes").select("*").eq("pedido_id", orderId).order("created_at");
    setList(data || []);
  }, [orderId]);
  useEffect(() => {
    load();
    // Nombre único por uso: dos componentes del mismo pedido no pueden compartir canal.
    const channel = db.channel(`ajustes-${orderId}-${crypto.randomUUID()}`).on("postgres_changes", { event: "*", schema: "public", table: "delivery_pedido_ajustes", filter: `pedido_id=eq.${orderId}` }, load).subscribe();
    return () => { db.removeChannel(channel); };
  }, [orderId, load]);
  return { list, reload: load };
}

const statusText: Record<OrderAdjustment["estado"], string> = { pendiente: "Esperando respuesta del cliente", aceptado: "El cliente aceptó", rechazado: "El cliente no aceptó", vencido: "Sin respuesta: se quitó el producto" };

/** Estado de los avisos de falta de stock de un pedido, para el comercio. */
export function AdjustmentsList({ orderId }: { orderId: string }) {
  const { list } = useOrderAdjustments(orderId);
  if (list.length === 0) return null;
  return (
    <ul className="mt-2 space-y-1" aria-label="Avisos por falta de stock">
      {list.map((adjustment) => (
        <li key={adjustment.id} className={cn("flex items-start gap-2 rounded-lg p-2 text-xs", adjustment.estado === "pendiente" ? "bg-warning/15" : adjustment.estado === "aceptado" ? "bg-success/10" : "bg-muted")}>
          {adjustment.estado === "pendiente" ? <Clock3 className="mt-0.5 h-3.5 w-3.5 shrink-0" /> : <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />}
          <span><span className="font-bold">{adjustment.item_nombre}</span> {adjustment.tipo === "reemplazo" ? `→ ${adjustment.reemplazo_nombre}` : "sin reemplazo"} · {statusText[adjustment.estado]}</span>
        </li>
      ))}
    </ul>
  );
}

/** Botón "Sin stock" de un producto del pedido: propone un reemplazo (o quitarlo) y el cliente decide. */
export function ItemStockButton({ order, item, onChange }: { order: DeliveryOrder; item: Item; onChange: () => void }) {
  const { list } = useOrderAdjustments(order.id);
  const [open, setOpen] = useState(false);
  const pending = list.some((adjustment) => adjustment.item_id === item.id && adjustment.estado === "pendiente");
  if (!item.id || !canAdjust(order)) return null;
  return (
    <>
      <button type="button" disabled={pending} onClick={() => setOpen(true)} className="ml-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-bold text-muted-foreground hover:bg-muted disabled:opacity-50"><PackageX className="h-3 w-3" />{pending ? "Avisado" : "Sin stock"}</button>
      {open && <SubstituteDialog order={order} item={item} onClose={() => setOpen(false)} onDone={() => { setOpen(false); onChange(); }} />}
    </>
  );
}

function SubstituteDialog({ order, item, onClose, onDone }: { order: DeliveryOrder; item: Item; onClose: () => void; onDone: () => void }) {
  const [products, setProducts] = useState<DeliveryProduct[] | null>(null);
  const [term, setTerm] = useState("");
  const [choice, setChoice] = useState<string | "none" | null>(null);
  const [pause, setPause] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    db.from("delivery_productos").select("*, grupos:delivery_producto_grupos(minimo)").eq("comercio_id", order.comercio_id).eq("disponible", true).eq("usa_variantes", false).order("nombre").then(({ data }: { data: (DeliveryProduct & { grupos?: { minimo: number }[] })[] | null }) => {
      setProducts((data || []).filter((product) => !(product.grupos || []).some((group) => group.minimo > 0) && (product.stock == null || product.stock >= item.cantidad)));
    });
  }, [order.comercio_id, item.cantidad]);

  const visible = (products || []).filter((product) => product.id !== item.producto_id && product.nombre.toLowerCase().includes(term.trim().toLowerCase())).slice(0, 30);

  const send = async () => {
    setSaving(true);
    const { error } = await db.rpc("delivery_proponer_ajuste", { p_item: item.id, p_reemplazo: choice === "none" ? null : choice, p_pausar: pause });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Le avisamos al cliente. Tiene 10 minutos para responder.");
    onDone();
  };

  return (
    <Dialog open onOpenChange={(next) => !next && !saving && onClose()}>
      <DialogContent className="max-h-[90vh] max-w-md overflow-y-auto">
        <DialogTitle className="text-xl font-black">{item.nombre} sin stock</DialogTitle>
        <DialogDescription>Ofrecele un reemplazo al cliente o quitalo del pedido. El cliente decide y el total se ajusta solo.</DialogDescription>
        <label className="flex h-10 items-center gap-2 rounded-full bg-muted px-4"><Search className="h-4 w-4 text-muted-foreground" /><input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar un reemplazo en tu menú" aria-label="Buscar reemplazo" className="min-w-0 flex-1 bg-transparent text-sm outline-none" /></label>
        {!products ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
          <ul className="max-h-56 space-y-1 overflow-y-auto" role="radiogroup" aria-label="Reemplazo">
            {visible.map((product) => (
              <li key={product.id}><button type="button" role="radio" aria-checked={choice === product.id} onClick={() => setChoice(product.id)} className={cn("flex w-full items-center justify-between gap-3 rounded-xl border p-2.5 text-left text-sm", choice === product.id ? "border-primary bg-primary/5" : "hover:bg-muted")}><span className="min-w-0 truncate font-semibold">{product.nombre}</span><span className="shrink-0 font-bold">{money(product.precio)}</span></button></li>
            ))}
            {visible.length === 0 && <li className="p-3 text-center text-sm text-muted-foreground">No hay productos para ofrecer.</li>}
          </ul>
        )}
        <button type="button" role="radio" aria-checked={choice === "none"} onClick={() => setChoice("none")} className={cn("w-full rounded-xl border p-2.5 text-left text-sm font-bold", choice === "none" ? "border-primary bg-primary/5" : "hover:bg-muted")}>Sin reemplazo: quitarlo del pedido</button>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={pause} onChange={(event) => setPause(event.target.checked)} className="h-4 w-4 accent-primary" />Pausar “{item.nombre}” en mi menú</label>
        <Button className="rounded-full" disabled={!choice || saving} onClick={send}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Avisar al cliente</Button>
      </DialogContent>
    </Dialog>
  );
}
