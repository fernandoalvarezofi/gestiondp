import { useState } from "react";
import { BellRing, Bike, Check, ChefHat, Clock3, PackageCheck, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { Button } from "@/components/ui/button";
import { db, DeliveryOrder, EstadoPedido, errorMessage, formatDateTime, formatTime, metodoPagoLabel, money, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const columns: { estado: EstadoPedido; title: string }[] = [
  { estado: "pendiente", title: "Nuevos" },
  { estado: "confirmado", title: "Aceptados" },
  { estado: "preparando", title: "En preparación" },
  { estado: "en_camino", title: "En camino" },
];

export async function changeOrderStatus(id: string, estado: EstadoPedido, motivo?: string, codigo?: string) {
  const { error } = await db.rpc("delivery_actualizar_estado", { p_pedido: id, p_estado: estado, p_motivo: motivo ?? null, p_codigo: codigo ?? null });
  if (error) { toast.error(errorMessage(error)); return false; }
  return true;
}

export function MerchantOrders({ orders, onChange }: { orders: DeliveryOrder[]; onChange: () => void }) {
  const [view, setView] = useState<"tablero" | "historial">("tablero");
  const history = orders.filter((order) => order.estado === "entregado" || order.estado === "cancelado");

  return (
    <div>
      <div className="flex gap-2">
        {(["tablero", "historial"] as const).map((item) => (
          <button key={item} type="button" onClick={() => setView(item)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", view === item ? "border-foreground bg-foreground text-background" : "bg-card")}>{item === "tablero" ? "En curso" : `Historial (${history.length})`}</button>
        ))}
      </div>

      {view === "tablero" ? (
        <div className="mt-4 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {columns.map((column) => {
            const list = orders.filter((order) => order.estado === column.estado);
            return (
              <section key={column.estado} className="rounded-3xl bg-muted/60 p-3">
                <h3 className="flex items-center justify-between px-1 font-extrabold">{column.title}<span className={cn("rounded-full px-2 py-0.5 text-xs", list.length && column.estado === "pendiente" ? "bg-primary text-primary-foreground" : "bg-card")}>{list.length}</span></h3>
                <div className="mt-3 space-y-3">
                  {list.map((order) => <OrderCard key={order.id} order={order} onChange={onChange} />)}
                  {list.length === 0 && <p className="px-1 py-6 text-center text-sm text-muted-foreground">Sin pedidos</p>}
                </div>
              </section>
            );
          })}
        </div>
      ) : history.length ? (
        <div className="mt-4 overflow-x-auto rounded-3xl border bg-card">
          <table className="w-full min-w-[640px] text-sm">
            <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Pedido</th><th className="p-3">Fecha</th><th className="p-3">Cliente</th><th className="p-3">Productos</th><th className="p-3">Estado</th><th className="p-3 text-right">Total</th></tr></thead>
            <tbody className="divide-y">
              {history.map((order) => (
                <tr key={order.id}>
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
      ) : (
        <EmptyState className="mt-4" title="Todavía no hay pedidos finalizados" />
      )}
    </div>
  );
}

function OrderCard({ order, onChange }: { order: DeliveryOrder; onChange: () => void }) {
  const [busy, setBusy] = useState(false);
  const run = async (estado: EstadoPedido, motivo?: string) => {
    setBusy(true);
    const ok = await changeOrderStatus(order.id, estado, motivo);
    setBusy(false);
    if (ok) { toast.success("Pedido actualizado"); onChange(); }
  };
  const reject = () => {
    const motivo = window.prompt("¿Por qué rechazás el pedido? (lo verá el cliente)", "No tenemos stock de un producto");
    if (motivo !== null) run("cancelado", motivo || "Rechazado por el comercio");
  };

  return (
    <article className={cn("rounded-2xl border bg-card p-3 shadow-soft", order.estado === "pendiente" && "border-primary/50")}>
      <div className="flex items-start justify-between gap-2">
        <div><p className="font-extrabold">{shortId(order.id)}</p><p className="text-xs text-muted-foreground">{order.cliente?.nombre || "Cliente"} · {formatTime(order.created_at)}</p></div>
        <p className="font-display font-extrabold">{money(order.subtotal)}</p>
      </div>
      <ul className="mt-2 space-y-0.5 text-sm">
        {(order.items || []).map((item, index) => <li key={item.id || index}><span className="font-bold">{item.cantidad}×</span> {item.nombre}{item.notas && <span className="block pl-5 text-xs text-muted-foreground">“{item.notas}”</span>}</li>)}
      </ul>
      {order.notas && <p className="mt-2 rounded-lg bg-warning/15 p-2 text-xs"><span className="font-bold">Nota: </span>{order.notas}</p>}
      <p className="mt-2 text-xs text-muted-foreground">{metodoPagoLabel[order.metodo_pago]} · {order.direccion_entrega}</p>
      {order.repartidor_id && <p className="mt-1 flex items-center gap-1 text-xs font-bold text-success"><Bike className="h-3.5 w-3.5" />Repartidor asignado</p>}
      {order.entrega_estimada && order.estado !== "pendiente" && <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />Entrega estimada {formatTime(order.entrega_estimada)}</p>}

      <div className="mt-3 flex flex-wrap gap-2">
        {order.estado === "pendiente" && <>
          <Button size="sm" className="flex-1 rounded-full" disabled={busy} onClick={() => run("confirmado")}><Check className="h-4 w-4" />Aceptar</Button>
          <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={reject}><X className="h-4 w-4" />Rechazar</Button>
        </>}
        {order.estado === "confirmado" && <>
          <Button size="sm" className="flex-1 rounded-full" disabled={busy} onClick={() => run("preparando")}><ChefHat className="h-4 w-4" />Empezar a preparar</Button>
          <Button size="sm" variant="ghost" className="rounded-full text-destructive" disabled={busy} onClick={reject}>Cancelar</Button>
        </>}
        {order.estado === "preparando" && (order.repartidor_id
          ? <p className="w-full rounded-xl bg-muted p-2 text-center text-xs font-semibold">El repartidor lo retira y lo marca en camino</p>
          : <Button size="sm" className="w-full rounded-full" disabled={busy} onClick={() => run("en_camino")}><Bike className="h-4 w-4" />Despachar con envío propio</Button>)}
        {order.estado === "en_camino" && (order.repartidor_id
          ? <p className="w-full rounded-xl bg-muted p-2 text-center text-xs font-semibold">En manos del repartidor</p>
          : <Button size="sm" className="w-full rounded-full" disabled={busy} onClick={() => run("entregado")}><PackageCheck className="h-4 w-4" />Marcar entregado</Button>)}
      </div>
    </article>
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
