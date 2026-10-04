import { CSSProperties, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Bike, Clock3, Facebook, Globe, Instagram, MapPin, MessageCircle, Search, ShoppingBag, Star, Store as StoreIcon } from "lucide-react";
import { ProductCard } from "@/components/delivery/ProductCard";
import { SmartImage } from "@/components/delivery/SmartImage";
import { deliveryFeeLabel, StoreLogo } from "@/components/delivery/StoreCard";
import { CartStore, useCart } from "@/contexts/CartContext";
import { useAddressPoint } from "@/hooks/useAddressPoint";
import { useTariff } from "@/hooks/useTariff";
import { DeliveryProduct, DeliverySection, DeliveryStore, isOpenNow, money, nextOpening, orderSections, scheduleSummary } from "@/lib/delivery";
import { storeReach } from "@/lib/geo";
import { normalizeTheme, readableOn, TemaNormalizado, whatsappLink } from "@/lib/storefront";
import { cn } from "@/lib/utils";

export type StorefrontReview = { id: string; puntaje: number; comentario?: string | null; created_at: string; cliente?: { nombre: string } | null };

type Props = {
  store: DeliveryStore;
  /** Tema ya normalizado (en el editor se pasa el borrador para ver los cambios al instante). */
  tema?: TemaNormalizado;
  products: DeliveryProduct[];
  sections: DeliverySection[];
  reviews?: StorefrontReview[];
  /** En la vista previa del editor no se navega: los enlaces y el carrito quedan inertes. */
  preview?: boolean;
};

const RADIUS = { clasica: "1rem", minimal: "0.25rem", moderno: "1.75rem" } as const;

/** Tienda online de un comercio: la misma pantalla para el sitio público y la vista previa del editor. */
export function StorefrontView({ store, tema, products, sections: sectionConfig, reviews = [], preview = false }: Props) {
  const theme = useMemo(() => tema ?? normalizeTheme(store.tienda_tema), [tema, store.tienda_tema]);
  const { itemCount, subtotal } = useCart();
  const point = useAddressPoint();
  const tariff = useTariff(point);
  const [term, setTerm] = useState("");
  const [category, setCategory] = useState<string | null>(null);

  const open = isOpenNow(store);
  const reach = storeReach(store, point, undefined, tariff);
  const unavailable = !open || !reach.inZone;
  const fee = deliveryFeeLabel(store, reach.fee);
  const cartStore: CartStore = { id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio, pedido_minimo: store.pedido_minimo, envio_gratis_desde: store.envio_gratis_desde, imagen_url: store.imagen_url };

  const onAccent = readableOn(theme.color);
  const style = {
    "--sf-accent": theme.color,
    "--sf-on-accent": onAccent,
    "--sf-radius": RADIUS[theme.plantilla],
    fontFamily: theme.tipografia === "serif" ? "Georgia, 'Times New Roman', serif" : undefined,
  } as CSSProperties;

  const visible = useMemo(() => {
    const value = term.trim().toLowerCase();
    return products.filter((product) => product.disponible !== false && (!value || `${product.nombre} ${product.descripcion || ""}`.toLowerCase().includes(value)));
  }, [products, term]);
  const groups = useMemo(() => orderSections(visible, sectionConfig, true)
    .map(({ name }) => ({ name, items: visible.filter((product) => product.categoria === name) }))
    .filter((group) => group.items.length > 0), [visible, sectionConfig]);
  const compact = !category && visible.length <= 12;
  const shown = category ? groups.filter((group) => group.name === category) : groups;
  const featured = !category && !term && !compact ? visible.filter((product) => product.destacado) : [];

  const title = theme.titulo || store.nombre;
  const subtitle = theme.subtitulo || store.descripcion || "";
  const rated = theme.mostrar_opiniones && store.total_resenas > 0;
  const social = [
    theme.whatsapp && { href: whatsappLink(theme.whatsapp, store.nombre), label: "WhatsApp", icon: MessageCircle },
    theme.instagram && { href: `https://instagram.com/${theme.instagram}`, label: "Instagram", icon: Instagram },
    theme.facebook && { href: `https://facebook.com/${theme.facebook}`, label: "Facebook", icon: Facebook },
    theme.web && { href: theme.web, label: "Sitio web", icon: Globe },
  ].filter(Boolean) as { href: string; label: string; icon: typeof Globe }[];

  const accentButton = "inline-flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-2 text-sm font-bold";
  const cartLabel = itemCount > 0 ? `${itemCount} · ${money(subtotal)}` : "Mi pedido";

  const info = (
    <div className={cn("flex flex-wrap items-center gap-x-4 gap-y-1 text-sm", theme.plantilla === "moderno" ? "opacity-90" : "text-muted-foreground", theme.plantilla === "minimal" && "justify-center")}>
      <span className={cn("inline-flex items-center gap-1.5 font-semibold", theme.plantilla !== "moderno" && (open ? "text-success" : "text-destructive"))}><span className="h-2 w-2 rounded-full bg-current" />{open ? "Abierto ahora" : "Cerrado"}</span>
      <span className="inline-flex items-center gap-1.5"><Clock3 className="h-4 w-4" />{store.tiempo_min}-{store.tiempo_max} min</span>
      <span className="inline-flex items-center gap-1.5"><Bike className="h-4 w-4" />{fee}</span>
      {Number(store.pedido_minimo) > 0 && <span className="inline-flex items-center gap-1.5"><ShoppingBag className="h-4 w-4" />Mínimo {money(store.pedido_minimo)}</span>}
      {rated && <span className="inline-flex items-center gap-1 font-semibold"><Star className="h-4 w-4 fill-warning text-warning" />{Number(store.rating).toFixed(1)} <span className="font-normal opacity-80">({store.total_resenas})</span></span>}
    </div>
  );

  return (
    <div style={style} className="min-h-screen bg-background text-foreground">
      {theme.anuncio && <p className="px-4 py-2 text-center text-sm font-semibold" style={{ background: "var(--sf-accent)", color: "var(--sf-on-accent)" }}>{theme.anuncio}</p>}

      <header className={cn("z-30 border-b bg-card/95 backdrop-blur", preview ? "relative" : "sticky top-0")}>
        <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
          <div className="flex min-w-0 items-center gap-3">
            <StoreLogo store={store} className="h-10 w-10 shrink-0 text-sm" />
            <span className="truncate text-lg font-extrabold">{store.nombre}</span>
          </div>
          <label className="ml-auto hidden h-10 w-72 items-center gap-2 rounded-full border bg-background px-3 md:flex">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar productos" aria-label="Buscar productos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          {preview
            ? <span className={cn(accentButton, "ml-auto md:ml-0")} style={{ background: "var(--sf-accent)", color: "var(--sf-on-accent)" }}><ShoppingBag className="h-4 w-4" />{cartLabel}</span>
            : <Link to="/app/carrito" className={cn(accentButton, "ml-auto md:ml-0")} style={{ background: "var(--sf-accent)", color: "var(--sf-on-accent)" }}><ShoppingBag className="h-4 w-4" />{cartLabel}</Link>}
        </div>
      </header>

      {/* Portada según la plantilla */}
      {theme.plantilla === "clasica" && (
        <section className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div className="relative h-44 overflow-hidden bg-muted sm:h-72" style={{ borderRadius: "var(--sf-radius)" }}>
            <SmartImage src={theme.banner_url || store.imagen_url} width={1400} loading="eager" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-black/5 to-transparent" />
            <div className="absolute inset-x-0 bottom-0 p-4 text-white sm:p-8">
              <h1 className="text-2xl font-black leading-tight sm:text-5xl">{title}</h1>
              {subtitle && <p className="mt-1 max-w-2xl text-sm opacity-90 sm:text-lg">{subtitle}</p>}
            </div>
          </div>
          <div className="mt-4">{info}</div>
        </section>
      )}
      {theme.plantilla === "minimal" && (
        <section className="mx-auto max-w-3xl px-4 pb-2 pt-10 text-center sm:px-6">
          <StoreLogo store={store} className="mx-auto h-20 w-20 text-2xl" />
          <h1 className="mt-4 text-3xl font-extrabold tracking-tight sm:text-5xl">{title}</h1>
          {subtitle && <p className="mx-auto mt-2 max-w-xl text-muted-foreground">{subtitle}</p>}
          <div className="mt-4">{info}</div>
          <div className="mx-auto mt-6 h-px w-16" style={{ background: "var(--sf-accent)" }} />
        </section>
      )}
      {theme.plantilla === "moderno" && (
        <section className="mx-auto max-w-6xl px-4 pt-4 sm:px-6">
          <div className="grid items-center gap-6 overflow-hidden p-6 sm:p-10 lg:grid-cols-[1.2fr_1fr]" style={{ background: "var(--sf-accent)", color: "var(--sf-on-accent)", borderRadius: "var(--sf-radius)" }}>
            <div>
              <h1 className="text-3xl font-black leading-[1.05] sm:text-6xl">{title}</h1>
              {subtitle && <p className="mt-3 max-w-xl text-base opacity-90 sm:text-lg">{subtitle}</p>}
              <div className="mt-5">{info}</div>
            </div>
            <div className="relative hidden aspect-[4/3] overflow-hidden bg-black/10 lg:block" style={{ borderRadius: "calc(var(--sf-radius) * 0.7)" }}>
              <SmartImage src={theme.banner_url || store.imagen_url} width={900} loading="eager" />
            </div>
          </div>
        </section>
      )}

      {unavailable && (
        <p className="mx-auto mt-4 max-w-6xl rounded-2xl bg-muted px-4 py-3 text-sm sm:mx-6 lg:mx-auto">
          {!open ? <><span className="font-extrabold">Cerrado ahora.</span> {store.esta_abierto ? nextOpening(store.horarios) || "" : "El local pausó los pedidos por un rato."} Podés mirar los productos igual.</> : <><span className="font-extrabold">No llega a tu dirección.</span> Elegí otra dirección para pedir.</>}
        </p>
      )}

      {/* Colecciones */}
      <nav className={cn("z-20 mt-6 border-y bg-background/95 backdrop-blur", preview ? "relative" : "sticky top-16")} aria-label="Colecciones">
        <div className="scrollbar-none mx-auto flex max-w-6xl gap-2 overflow-x-auto px-4 py-3 sm:px-6">
          {[{ name: null as string | null, label: "Todo" }, ...groups.map((group) => ({ name: group.name as string | null, label: group.name }))].map((item) => {
            const active = category === item.name;
            return (
              <button key={item.label} type="button" onClick={() => setCategory(item.name)} aria-pressed={active}
                className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm font-bold transition-colors", !active && "hover:bg-muted")}
                style={active ? { background: "var(--sf-accent)", color: "var(--sf-on-accent)", borderColor: "var(--sf-accent)" } : undefined}>
                {item.label}
              </button>
            );
          })}
        </div>
      </nav>

      <main className="mx-auto max-w-6xl px-4 pb-28 pt-6 sm:px-6">
        <label className="mb-6 flex h-11 items-center gap-2 rounded-full border bg-card px-4 md:hidden">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscar productos" aria-label="Buscar productos" className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
        </label>

        {featured.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-xl font-extrabold sm:text-2xl">Destacados</h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
              {featured.slice(0, 4).map((product) => <ProductCard key={`f-${product.id}`} product={product} store={cartStore} disabled={unavailable} variant="shop" />)}
            </div>
          </section>
        )}

        {shown.length === 0 && <p className="py-16 text-center text-muted-foreground">No encontramos productos{term ? ` para “${term}”` : ""}.</p>}
        {compact && shown.length > 0 && (
          <section className="mb-10">
            <h2 className="mb-4 text-xl font-extrabold sm:text-2xl">Productos <span className="text-base font-normal text-muted-foreground">({visible.length})</span></h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
              {shown.flatMap((group) => group.items).map((product) => <ProductCard key={product.id} product={product} store={cartStore} disabled={unavailable} variant="shop" />)}
            </div>
          </section>
        )}
        {!compact && shown.map((group) => (
          <section key={group.name} className="mb-10">
            <h2 className="mb-4 text-xl font-extrabold sm:text-2xl">{group.name} <span className="text-base font-normal text-muted-foreground">({group.items.length})</span></h2>
            <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:grid-cols-3 sm:gap-x-5 lg:grid-cols-4">
              {group.items.map((product) => <ProductCard key={product.id} product={product} store={cartStore} disabled={unavailable} variant="shop" />)}
            </div>
          </section>
        ))}

        {(theme.acerca || reviews.length > 0) && (
          <section className="mt-6 grid gap-8 border-t pt-10 md:grid-cols-2">
            {theme.acerca && (
              <div>
                <h2 className="text-xl font-extrabold">Sobre nosotros</h2>
                <p className="mt-3 whitespace-pre-line text-muted-foreground">{theme.acerca}</p>
              </div>
            )}
            {theme.mostrar_opiniones && reviews.length > 0 && (
              <div>
                <h2 className="text-xl font-extrabold">Lo que dicen nuestros clientes</h2>
                <ul className="mt-3 space-y-3">
                  {reviews.filter((review) => review.comentario).slice(0, 3).map((review) => (
                    <li key={review.id} className="rounded-2xl border bg-card p-4 text-sm">
                      <p className="flex items-center gap-1 font-bold"><Star className="h-4 w-4 fill-warning text-warning" />{review.puntaje}<span className="font-normal text-muted-foreground"> · {review.cliente?.nombre?.split(" ")[0] || "Cliente"}</span></p>
                      <p className="mt-1 text-muted-foreground">{review.comentario}</p>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}
      </main>

      <footer className="border-t bg-card">
        <div className="mx-auto grid max-w-6xl gap-6 px-4 py-8 text-sm sm:px-6 md:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <p className="text-lg font-extrabold">{store.nombre}</p>
            <p className="mt-2 flex items-start gap-2 text-muted-foreground"><MapPin className="mt-0.5 h-4 w-4 shrink-0" />{store.direccion}</p>
            {scheduleSummary(store.horarios) && <p className="mt-1 flex items-start gap-2 text-muted-foreground"><Clock3 className="mt-0.5 h-4 w-4 shrink-0" />{scheduleSummary(store.horarios)}</p>}
          </div>
          {social.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="font-extrabold">Seguinos</p>
              {social.map(({ href, label, icon: Icon }) => (
                <a key={label} href={preview ? undefined : href} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-muted-foreground hover:text-foreground"><Icon className="h-4 w-4" />{label}</a>
              ))}
            </div>
          )}
          <div className="flex flex-col gap-2 md:items-end">
            <p className="inline-flex items-center gap-1.5 text-muted-foreground"><StoreIcon className="h-4 w-4" />Tienda online creada en Woref</p>
            {!preview && <Link to={`/app/tienda/${store.slug}`} className="font-semibold text-muted-foreground hover:text-foreground">Ver en la app de Woref</Link>}
          </div>
        </div>
      </footer>

      {!preview && itemCount > 0 && (
        <Link to="/app/carrito" className="fixed inset-x-4 bottom-4 z-40 mx-auto flex max-w-md items-center justify-between rounded-full px-5 py-3.5 font-bold shadow-pop md:hidden" style={{ background: "var(--sf-accent)", color: "var(--sf-on-accent)" }}>
          <span className="inline-flex items-center gap-2"><ShoppingBag className="h-5 w-5" />Ver mi pedido ({itemCount})</span>
          <span>{money(subtotal)}</span>
        </Link>
      )}
    </div>
  );
}
