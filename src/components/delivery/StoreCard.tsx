import { Link } from "react-router-dom";
import { Star } from "lucide-react";
import { useAddressPoint } from "@/hooks/useAddressPoint";
import { DeliveryStore, img, isOpenNow, money, nextOpening } from "@/lib/delivery";
import { formatKm, storeReach } from "@/lib/geo";
import { cn } from "@/lib/utils";
import { FavoriteButton } from "./FavoriteButton";

export type { DeliveryStore } from "@/lib/delivery";

// Colores sobrios para los logos generados de locales que todavía no subieron el suyo.
const LOGO_COLORS = ["#1F2A44", "#7C2D12", "#14532D", "#4C1D95", "#9F1239", "#0F766E", "#92400E", "#1E3A8A", "#3F3F46", "#831843"];
const colorFor = (text: string) => LOGO_COLORS[[...text].reduce((total, char) => total + char.charCodeAt(0), 0) % LOGO_COLORS.length];

export function StoreLogo({ store, className }: { store: Pick<DeliveryStore, "nombre" | "logo_url" | "imagen_url">; className?: string }) {
  if (store.logo_url) {
    return <img src={img(store.logo_url, 200)} alt="" className={cn("rounded-2xl border border-black/5 bg-card object-cover shadow-sm", className)} />;
  }
  const words = store.nombre.replace(/[^\p{L}\p{N}\s&]/gu, "").split(/\s+/).filter((word) => word.length > 2 || /^[A-Z]/.test(word));
  const initials = (words.length > 1 ? words[0][0] + words[1][0] : store.nombre.slice(0, 2)).toUpperCase();
  return (
    <span className={cn("flex items-center justify-center rounded-2xl border border-black/5 font-brand font-black tracking-tight text-white shadow-sm", className)} style={{ backgroundColor: colorFor(store.nombre) }} aria-hidden>
      {initials}
    </span>
  );
}

export function RatingBadge({ store, showCount = false, className }: { store: Pick<DeliveryStore, "rating" | "total_resenas">; showCount?: boolean; className?: string }) {
  if (!store.total_resenas) return <span className={cn("rounded-full bg-success/10 px-2 py-0.5 text-[11px] font-extrabold text-success", className)}>Nuevo</span>;
  return (
    <span className={cn("inline-flex items-center gap-1 text-[13px] font-extrabold", className)}>
      <Star className="h-3.5 w-3.5 fill-warning text-warning" />
      {Number(store.rating).toFixed(1)}
      {showCount && <span className="font-semibold text-muted-foreground">({store.total_resenas >= 1000 ? `${Math.floor(store.total_resenas / 100) / 10}k` : store.total_resenas})</span>}
    </span>
  );
}

/** Costo de envío a mostrar: si hay distancia, el calculado para esa dirección; si no, el base. */
export function deliveryFeeLabel(store: Pick<DeliveryStore, "costo_envio" | "envio_gratis_desde">, fee?: number) {
  const amount = fee ?? Number(store.costo_envio);
  if (amount === 0 || (store.envio_gratis_desde !== null && store.envio_gratis_desde !== undefined && Number(store.envio_gratis_desde) <= 1)) return "Envío gratis";
  return `Envío ${money(amount)}`;
}

function useStoreState(store: DeliveryStore) {
  const point = useAddressPoint();
  const reach = storeReach(store, point);
  const fee = deliveryFeeLabel(store, reach.fee);
  return { reach, fee, free: fee === "Envío gratis", open: isOpenNow(store) };
}

function ClosedOverlay({ store, reachKm, open, inZone }: { store: DeliveryStore; reachKm: number | null; open: boolean; inZone: boolean }) {
  if (open && inZone) return null;
  return (
    <span className="absolute inset-0 flex flex-col items-center justify-center bg-black/55 text-center text-sm font-extrabold text-white">
      {!open ? "Cerrado" : "Fuera de tu zona"}
      <span className="mt-0.5 text-xs font-semibold text-white/85">{!open ? (store.esta_abierto ? nextOpening(store.horarios) : "Volvé más tarde") : `Está a ${formatKm(reachKm || 0)}`}</span>
    </span>
  );
}

/** Tarjeta con foto, para carruseles y grillas. */
export function StoreCard({ store, variant = "grid" }: { store: DeliveryStore; variant?: "grid" | "row" }) {
  const { reach, fee, free, open } = useStoreState(store);
  return (
    <Link to={`/app/tienda/${store.slug}`} className={cn("group block min-w-0", variant === "row" && "w-[248px] shrink-0 snap-start sm:w-[288px]")}>
      <div className="relative">
        <div className="relative aspect-[16/9] overflow-hidden rounded-2xl bg-muted">
          <img src={img(store.imagen_url, 640)} alt="" loading="lazy" className={cn("h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]", (!open || !reach.inZone) && "grayscale")} />
          <div className="absolute left-2 top-2 flex flex-col items-start gap-1">
            {store.promo_texto && <span className="rounded-full bg-primary px-2.5 py-1 text-[11px] font-extrabold text-primary-foreground shadow-sm">{store.promo_texto}</span>}
            {free && open && <span className="rounded-full bg-success px-2.5 py-1 text-[11px] font-extrabold text-white shadow-sm">Envío gratis</span>}
          </div>
          <ClosedOverlay store={store} reachKm={reach.km} open={open} inZone={reach.inZone} />
          <FavoriteButton storeId={store.id} className="absolute right-2 top-2 h-8 w-8" />
          {open && reach.inZone && <span className="absolute bottom-2 right-2 rounded-full bg-card px-2.5 py-1 text-[11px] font-extrabold shadow-soft">{store.tiempo_min}-{store.tiempo_max} min</span>}
        </div>
        <StoreLogo store={store} className="absolute -bottom-4 left-3 h-12 w-12 border-2 border-card text-sm" />
      </div>
      <div className="px-0.5 pt-5">
        <h3 className="truncate text-[15px] font-extrabold leading-tight">{store.nombre}</h3>
        <div className="mt-1 flex items-center gap-1.5 text-[13px] font-semibold text-muted-foreground">
          <RatingBadge store={store} />
          <span aria-hidden>·</span>
          <span className="truncate">{store.rubro || "Local"}</span>
          <span aria-hidden>·</span>
          <span className={cn("truncate", free && "font-bold text-success")}>{fee}</span>
        </div>
      </div>
    </Link>
  );
}

/** Fila de lista, como en el listado de locales de las apps de delivery. */
export function StoreListItem({ store }: { store: DeliveryStore }) {
  const { reach, fee, free, open } = useStoreState(store);
  const unavailable = !open || !reach.inZone;
  return (
    <Link to={`/app/tienda/${store.slug}`} className={cn("group flex items-center gap-3 rounded-2xl p-2 transition-colors hover:bg-muted/60", unavailable && "opacity-60")}>
      <StoreLogo store={store} className="h-[72px] w-[72px] shrink-0 text-xl" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <h3 className="truncate text-base font-extrabold">{store.nombre}</h3>
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] font-semibold text-muted-foreground">
          <RatingBadge store={store} showCount />
          <span aria-hidden>·</span>
          <span>{store.rubro || "Local"}</span>
          {reach.km != null && <><span aria-hidden>·</span><span>{formatKm(reach.km)}</span></>}
        </div>
        <div className="mt-0.5 flex flex-wrap items-center gap-x-1.5 text-[13px] font-semibold text-muted-foreground">
          {unavailable ? (
            <span className="font-bold text-foreground">{!open ? (store.esta_abierto ? nextOpening(store.horarios) || "Cerrado" : "Cerrado por ahora") : "No llega a tu dirección"}</span>
          ) : (
            <>
              <span>{store.tiempo_min}-{store.tiempo_max} min</span>
              <span aria-hidden>·</span>
              <span className={cn(free && "font-bold text-success")}>{fee}</span>
            </>
          )}
        </div>
        {store.promo_texto && <span className="mt-1.5 inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary">{store.promo_texto}</span>}
      </div>
      <FavoriteButton storeId={store.id} className="h-8 w-8 shrink-0 shadow-none" />
    </Link>
  );
}

export function StoreCardSkeleton({ variant = "grid" }: { variant?: "grid" | "row" }) {
  return (
    <div className={cn(variant === "row" && "w-[248px] shrink-0 sm:w-[288px]")}>
      <div className="aspect-[16/9] animate-pulse rounded-2xl bg-muted" />
      <div className="mt-5 h-4 w-2/3 animate-pulse rounded bg-muted" />
      <div className="mt-2 h-3 w-1/2 animate-pulse rounded bg-muted" />
    </div>
  );
}

export function StoreListSkeleton() {
  return (
    <div className="flex items-center gap-3 p-2">
      <div className="h-[72px] w-[72px] animate-pulse rounded-2xl bg-muted" />
      <div className="flex-1 space-y-2"><div className="h-4 w-1/2 animate-pulse rounded bg-muted" /><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /><div className="h-3 w-1/3 animate-pulse rounded bg-muted" /></div>
    </div>
  );
}
