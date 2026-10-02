import { useEffect, useState } from "react";
import { Layers } from "lucide-react";
import { ActiveDelivery } from "@/components/courier/ActiveDelivery";
import { OfferCard } from "@/components/courier/OfferCard";
import type { Offer } from "@/components/courier/useOffers";
import { DeliveryOrder, shortId } from "@/lib/delivery";
import type { GeoPoint } from "@/lib/geo";
import { cn } from "@/lib/utils";

/** Pedido en curso del repartidor. Si lleva dos pedidos agrupados, un selector para pasar de uno a otro; si todavía puede sumar uno, lo ofrece debajo. */
export function ActiveBatch({ orders, offers, position, sharing, onChange }: { orders: DeliveryOrder[]; offers: Offer[]; position: GeoPoint | null; sharing: string; onChange: () => void }) {
  const [selected, setSelected] = useState(orders[0]?.id);
  useEffect(() => { if (!orders.some((order) => order.id === selected)) setSelected(orders[0]?.id); }, [orders, selected]);
  const active = orders.find((order) => order.id === selected) || orders[0];
  if (!active) return null;

  return (
    <div>
      {orders.length > 1 && (
        <div className="mx-auto mb-4 max-w-2xl rounded-3xl border border-primary/30 bg-primary/5 p-3">
          <p className="flex items-center gap-2 text-sm font-extrabold"><Layers className="h-4 w-4 text-primary" />Llevás {orders.length} pedidos juntos</p>
          <p className="mt-0.5 text-xs text-muted-foreground">Retirá los dos en el local y entregá primero el que te quede más cerca.</p>
          <div className="mt-2 flex gap-2" role="tablist" aria-label="Pedidos en curso">
            {orders.map((order) => (
              <button key={order.id} type="button" role="tab" aria-selected={order.id === active.id} onClick={() => setSelected(order.id)} className={cn("min-w-0 flex-1 rounded-2xl border px-3 py-2 text-left text-xs", order.id === active.id ? "border-foreground bg-foreground text-background" : "bg-card")}>
                <span className="block font-extrabold">{shortId(order.id)}</span>
                <span className="block truncate opacity-80">{order.direccion_entrega}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      <ActiveDelivery order={active} position={position} sharing={sharing} onChange={onChange} />
      {offers.length > 0 && orders.length < 2 && (
        <div className="mx-auto mt-6 max-w-2xl">
          <h2 className="mb-2 flex items-center gap-2 font-extrabold"><Layers className="h-4 w-4 text-primary" />Sumá otro pedido y llevá los dos</h2>
          <p className="mb-3 text-sm text-muted-foreground">Es del mismo lugar y va para una zona cercana: ganás el envío de cada uno.</p>
          <div className="space-y-3">{offers.map((offer) => <OfferCard key={offer.pedido_id} offer={offer} onChange={onChange} />)}</div>
        </div>
      )}
    </div>
  );
}
