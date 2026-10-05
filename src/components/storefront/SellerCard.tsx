import { BadgeCheck, CalendarDays, MessageCircleQuestion, ShoppingBag, ThumbsUp } from "lucide-react";
import { StoreLogo } from "@/components/delivery/StoreCard";
import type { DeliveryStore } from "@/lib/delivery";
import { antiguedad, nivelReputacion, type VendedorResumen } from "@/lib/marketplace";
import { cn } from "@/lib/utils";

/** Tarjeta del vendedor: reputación en cinco tramos (termómetro) y datos reales de su actividad. */
export function SellerCard({ store, vendedor, className }: { store: Pick<DeliveryStore, "nombre" | "logo_url" | "imagen_url">; vendedor: VendedorResumen; className?: string }) {
  const nivel = nivelReputacion(vendedor);
  const datos = [
    vendedor.entregados > 0 && { icon: ShoppingBag, texto: `${vendedor.entregados.toLocaleString("es-AR")} ${vendedor.entregados === 1 ? "venta" : "ventas"} entregadas` },
    vendedor.positivas != null && vendedor.resenas > 0 && { icon: ThumbsUp, texto: `${vendedor.positivas}% de opiniones positivas` },
    vendedor.preguntas_respondidas > 0 && { icon: MessageCircleQuestion, texto: `${vendedor.preguntas_respondidas.toLocaleString("es-AR")} preguntas respondidas` },
    { icon: CalendarDays, texto: antiguedad(vendedor.desde) },
  ].filter(Boolean) as { icon: typeof ShoppingBag; texto: string }[];

  return (
    <section className={cn("border bg-card p-5 text-card-foreground", className)} style={{ borderRadius: "var(--sf-radius, 1rem)" }} aria-label="Información del vendedor">
      <div className="flex items-center gap-3">
        <StoreLogo store={store} className="h-12 w-12 shrink-0 text-base" />
        <div className="min-w-0"><p className="truncate font-extrabold">{store.nombre}</p><p className="flex items-center gap-1 text-xs font-semibold" style={{ color: nivel.color }}><BadgeCheck className="h-3.5 w-3.5" />{nivel.nombre}</p></div>
      </div>
      <div className="mt-4" role="img" aria-label={`Reputación: ${nivel.nivel} de 5. ${nivel.nombre}`}>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => <span key={n} className="h-2 flex-1 rounded-full" style={{ background: n <= nivel.nivel ? nivel.color : "hsl(var(--muted))" }} />)}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{nivel.detalle}</p>
      </div>
      <ul className="mt-4 space-y-2 text-sm">
        {datos.map(({ icon: Icon, texto }) => <li key={texto} className="flex items-center gap-2 text-muted-foreground"><Icon className="h-4 w-4 shrink-0" />{texto}</li>)}
      </ul>
    </section>
  );
}
