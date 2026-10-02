import { Link } from "react-router-dom";
import { Bike, Clock3, Star } from "lucide-react";
import { useCart } from "@/contexts/CartContext";
import { DeliveryStore, img, isOpenNow, money, nextOpening } from "@/lib/delivery";
import { formatKm, storeReach } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "./FavoriteButton";

export type { DeliveryStore } from "@/lib/delivery";

export function StoreLogo({ store, className }: { store: Pick<DeliveryStore, "nombre" | "logo_url" | "imagen_url">; className?: string }) {
  if (store.logo_url) {
    return <img src={img(store.logo_url, 160)} alt="" className={cn("rounded-full border-2 border-card bg-card object-cover", className)} />;
  }
  const initials = store.nombre.split(" ").filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
  return (
    <span className={cn("flex items-center justify-center rounded-full border-2 border-card bg-brand-deep font-display font-extrabold text-white", className)} aria-hidden>
      {initials}
    </span>
  );
}

export function RatingBadge({ store, className }: { store: Pick<DeliveryStore, "rating" | "total_resenas">; className?: string }) {
  if (!store.total_resenas) return <span className={cn("rounded-md bg-success/10 px-1.5 py-0.5 text-[11px] font-bold text-success", className)}>Nuevo</span>;
  return (
    <span className={cn("flex items-center gap-1 text-sm font-bold", className)}>
      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
      {Number(store.rating).toFixed(1)}
    </span>
  );
}

/** Costo de envío a mostrar: si hay distancia, el calculado para esa dirección; si no, el base. */
export function deliveryFeeLabel(store: Pick<DeliveryStore, "costo_envio" | "envio_gratis_desde">, fee?: number) {
  const amount = fee ?? Number(store.costo_envio);
  if (amount === 0 || (store.envio_gratis_desde !== null && store.envio_gratis_desde !== undefined && Number(store.envio_gratis_desde) <= 1)) return "Envío gratis";
  return money(amount);
}

export function StoreCard({ store, variant = "grid" }: { store: DeliveryStore; variant?: "grid" | "row" }) {
  const { address } = useCart();
  const reach = storeReach(store, address?.lat != null && address?.lng != null ? { lat: address.lat, lng: address.lng } : null);
  const feeLabel = deliveryFeeLabel(store, reach.fee);
  const free = feeLabel === "Envío gratis";
  const open = isOpenNow(store);
  return (
    <Link to={`/app/tienda/${store.slug}`} className={cn("group block min-w-0", variant === "row" && "w-[260px] shrink-0 sm:w-[300px]")}>
      <div className="relative">
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-muted">
          <img src={img(store.imagen_url, 640)} alt={store.nombre} loading="lazy" className={cn("h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]", (!open || !reach.inZone) && "grayscale")} />
          {store.promo_texto && <span className="absolute left-2.5 top-2.5 rounded-lg bg-primary px-2 py-1 text-[11px] font-bold text-primary-foreground shadow-soft">{store.promo_texto}</span>}
          {!open && <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-center text-sm font-bold text-white">Cerrado<span className="text-xs font-semibold text-white/80">{store.esta_abierto ? nextOpening(store.horarios) : "Pausado por el local"}</span></span>}
          {open && !reach.inZone && <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/50 text-center text-sm font-bold text-white">No llega a tu dirección<span className="text-xs font-semibold text-white/80">Está a {formatKm(reach.km || 0)}</span></span>}
          <FavoriteButton storeId={store.id} className="absolute right-2.5 top-2.5" />
        </div>
        <StoreLogo store={store} className="absolute -bottom-5 left-3 h-12 w-12 text-sm shadow-soft" />
      </div>
      <div className="px-0.5 pt-6">
        <div className="flex items-start justify-between gap-2">
          <h3 className="truncate font-display text-[15px] font-bold">{store.nombre}</h3>
          <RatingBadge store={store} className="shrink-0" />
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs font-semibold text-muted-foreground">
          <span className="flex items-center gap-1"><Clock3 className="h-3.5 w-3.5" />{store.tiempo_min}-{store.tiempo_max} min</span>
          <span aria-hidden>·</span>
          <span className={cn("flex items-center gap-1", free && "text-success")}><Bike className="h-3.5 w-3.5" />{feeLabel}</span>
          {reach.km != null ? <><span aria-hidden>·</span><span className="truncate">{formatKm(reach.km)}</span></> : store.rubro && <><span aria-hidden className="hidden sm:inline">·</span><span className="hidden truncate sm:inline">{store.rubro}</span></>}
        </div>
      </div>
    </Link>
  );
}

export function StoreCardSkeleton({ variant = "grid" }: { variant?: "grid" | "row" }) {
  return (
    <div className={cn(variant === "row" && "w-[260px] shrink-0 sm:w-[300px]")}>
      <div className="aspect-[16/9] animate-pulse rounded-2xl bg-muted" />
      <div className="mt-6 h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  );
}
