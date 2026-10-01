import { Link } from "react-router-dom";
import { Bike, Clock3, Star } from "lucide-react";

export type DeliveryStore = {
  id: string;
  nombre: string;
  slug: string;
  categoria: string;
  descripcion?: string | null;
  imagen_url?: string | null;
  rating: number;
  tiempo_min: number;
  tiempo_max: number;
  costo_envio: number;
  esta_abierto: boolean;
  destacado?: boolean;
};

const money = new Intl.NumberFormat("es-AR", { style: "currency", currency: "ARS", maximumFractionDigits: 0 });

export function StoreCard({ store }: { store: DeliveryStore }) {
  return (
    <Link to={`/lin/local/${store.slug}`} className="group block min-w-0">
      <div className="relative aspect-[16/10] overflow-hidden rounded-lg bg-muted">
        <img src={store.imagen_url || "/placeholder.svg"} alt={store.nombre} loading="lazy" width={1200} height={800} className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]" />
        {!store.esta_abierto && <span className="absolute left-3 top-3 rounded-md bg-foreground px-2.5 py-1 text-xs font-bold text-background">Cerrado</span>}
        {store.destacado && <span className="absolute left-3 top-3 rounded-md bg-primary px-2.5 py-1 text-xs font-bold text-primary-foreground">Recomendado</span>}
      </div>
      <div className="pt-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate text-base font-bold">{store.nombre}</h3>
          <span className="flex shrink-0 items-center gap-1 text-sm font-semibold"><Star className="h-3.5 w-3.5 fill-warning text-warning" />{store.rating}</span>
        </div>
        <p className="mt-0.5 truncate text-sm text-muted-foreground">{store.descripcion}</p>
        <div className="mt-2 flex items-center gap-3 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{store.tiempo_min}-{store.tiempo_max} min</span>
          <span className="flex items-center gap-1"><Bike className="h-3.5 w-3.5" />{store.costo_envio === 0 ? "Envío gratis" : money.format(store.costo_envio)}</span>
        </div>
      </div>
    </Link>
  );
}