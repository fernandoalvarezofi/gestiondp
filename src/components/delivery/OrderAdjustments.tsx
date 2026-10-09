import { useEffect, useState } from "react";
import { Clock3, Loader2, PackageX } from "lucide-react";
import { toast } from "sonner";
import { OrderAdjustment, useOrderAdjustments } from "@/components/merchant/StockAdjust";
import { Button } from "@/components/ui/button";
import { db, errorMessage, money } from "@/lib/delivery";
import { confirmar } from "@/components/ui/dialogos";

/** Cuando al comercio le falta un producto, el cliente elige: aceptar el reemplazo, seguir sin el producto o cancelar. */
export function OrderAdjustments({ orderId, onChange }: { orderId: string; onChange: () => void }) {
  const { list } = useOrderAdjustments(orderId);
  const [now, setNow] = useState(() => Date.now());
  const [busy, setBusy] = useState<string | null>(null);
  const signature = list.map((adjustment) => `${adjustment.id}:${adjustment.estado}`).join("|");

  // Cuando cambia el estado de un aviso, el pedido (productos y total) también cambió: se vuelve a cargar.
  useEffect(() => { if (signature) onChange(); }, [signature]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, []);

  const respond = async (adjustment: OrderAdjustment, accept: boolean) => {
    if (!accept && adjustment.tipo === "quitar" && !(await confirmar({ titulo: "¿Cancelar el pedido?", descripcion: "Si no aceptás seguir sin este producto, el pedido se cancela. Si pagaste online, se te reintegra.", confirmar: "Cancelar pedido", cancelar: "Volver", peligro: true }))) return;
    setBusy(adjustment.id);
    const { error } = await db.rpc("delivery_responder_ajuste", { p_ajuste: adjustment.id, p_acepta: accept });
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success(accept ? "Listo, avisamos al comercio" : adjustment.tipo === "quitar" ? "Pedido cancelado" : "Seguimos sin ese producto");
    onChange();
  };

  const pending = list.filter((adjustment) => adjustment.estado === "pendiente");
  const resolved = list.filter((adjustment) => adjustment.estado !== "pendiente");
  if (list.length === 0) return null;

  return (
    <section className="mt-4 space-y-3" aria-label="Productos sin stock">
      {pending.map((adjustment) => {
        const seconds = Math.max(0, Math.ceil((new Date(adjustment.vence_at).getTime() - now) / 1000));
        const difference = adjustment.tipo === "reemplazo" ? (Number(adjustment.reemplazo_precio) - Number(adjustment.item_precio)) * adjustment.item_cantidad : 0;
        return (
          <article key={adjustment.id} className="rounded-3xl border-2 border-warning bg-warning/10 p-4 sm:p-5">
            <p className="flex items-center gap-2 font-extrabold"><PackageX className="h-5 w-5" />Falta un producto de tu pedido</p>
            <p className="mt-1 text-sm"><span className="font-bold">{adjustment.item_cantidad}× {adjustment.item_nombre}</span> no está disponible.
              {adjustment.tipo === "reemplazo" ? <> El comercio te ofrece <span className="font-bold">{adjustment.reemplazo_nombre}</span> ({money(adjustment.reemplazo_precio)} c/u){difference !== 0 && <> · tu total {difference > 0 ? "sube" : "baja"} {money(Math.abs(difference))} (más tarifa de servicio)</>}.</> : " ¿Querés seguir con el resto del pedido?"}</p>
            <p className="mt-1 flex items-center gap-1 text-xs font-semibold text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Respondé en {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, "0")}. Sin respuesta, se quita el producto y el pedido sigue.</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button className="rounded-full" disabled={busy === adjustment.id} onClick={() => respond(adjustment, true)}>{busy === adjustment.id && <Loader2 className="h-4 w-4 animate-spin" />}{adjustment.tipo === "reemplazo" ? "Aceptar el reemplazo" : "Seguir sin ese producto"}</Button>
              <Button variant="outline" className="rounded-full" disabled={busy === adjustment.id} onClick={() => respond(adjustment, false)}>{adjustment.tipo === "reemplazo" ? "Quitar el producto" : "Cancelar el pedido"}</Button>
            </div>
          </article>
        );
      })}
      {resolved.length > 0 && (
        <ul className="space-y-1 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">
          {resolved.map((adjustment) => (
            <li key={adjustment.id}><span className="font-bold text-foreground">{adjustment.item_nombre}</span>: {adjustment.estado === "aceptado" ? (adjustment.tipo === "reemplazo" ? `cambiado por ${adjustment.reemplazo_nombre}` : "quitado del pedido") : "quitado del pedido"}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
