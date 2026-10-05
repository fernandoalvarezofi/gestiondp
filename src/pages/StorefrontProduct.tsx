import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { Bike, ChevronRight, Clock3, Heart, Loader2, Minus, Plus, Share2, ShoppingBag, Store as StoreIcon, Wallet } from "lucide-react";
import { toast } from "sonner";
import { AddressDialog } from "@/components/delivery/AddressDialog";
import { ProductCard, ProductDialog } from "@/components/delivery/ProductCard";
import { deliveryFeeLabel, StoreLogo } from "@/components/delivery/StoreCard";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { ProductQuestions } from "@/components/storefront/ProductQuestions";
import { SellerCard } from "@/components/storefront/SellerCard";
import { Button } from "@/components/ui/button";
import { CartStore, useCart } from "@/contexts/CartContext";
import { useAddressPoint } from "@/hooks/useAddressPoint";
import { useTariff } from "@/hooks/useTariff";
import { db, DeliveryProduct, DeliveryStore, isOpenNow, money, nextOpening, precioDesde, productSelect, sortGroups, tagLabels, variantesDisponibles } from "@/lib/delivery";
import { formatKm, storeReach } from "@/lib/geo";
import { descuentoPct, fotosDe, insignias, type VendedorResumen } from "@/lib/marketplace";
import { normalizeTheme, storefrontUrl } from "@/lib/storefront";
import { estiloTienda } from "@/lib/storefrontStyle";
import { cn } from "@/lib/utils";

const FAV_KEY = "woref-fav-productos";
const readFavs = (): string[] => { try { const raw = window.localStorage.getItem(FAV_KEY); const list = raw ? JSON.parse(raw) : []; return Array.isArray(list) ? list.filter((item) => typeof item === "string") : []; } catch { return []; } };

/** Ficha de producto de una tienda online (/t/:slug/p/:id), con el diseño de esa tienda: fotos, precio, envío, vendedor, preguntas y más productos. */
export default function StorefrontProduct() {
  const { slug, id } = useParams();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const point = useAddressPoint();
  const tariff = useTariff(point);
  const [pagoOnline, setPagoOnline] = useState(false);
  const [store, setStore] = useState<DeliveryStore | null>(null);
  const [product, setProduct] = useState<DeliveryProduct | null>(null);
  const [others, setOthers] = useState<DeliveryProduct[]>([]);
  const [vendedor, setVendedor] = useState<VendedorResumen | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [quantity, setQuantity] = useState(1);
  const [options, setOptions] = useState(false);
  const [favs, setFavs] = useState<string[]>(readFavs);

  useEffect(() => {
    db.rpc("delivery_pagos_online_activos").then(({ data }: { data: boolean | null }) => setPagoOnline(Boolean(data)), () => undefined);
  }, []);

  useEffect(() => {
    let alive = true;
    setState("loading");
    setQuantity(1);
    (async () => {
      const { data: found } = await db.from("delivery_comercios").select("*").eq("slug", slug).maybeSingle();
      if (!alive) return;
      if (!found) { setState("missing"); return; }
      const [{ data: item }, { data: catalog }, { data: resumen }] = await Promise.all([
        db.from("delivery_productos").select(productSelect).eq("id", id).eq("comercio_id", found.id).maybeSingle(),
        db.from("delivery_productos").select(productSelect).eq("comercio_id", found.id).eq("disponible", true).order("orden").order("nombre").limit(200),
        db.rpc("delivery_vendedor_resumen", { p_slug: found.slug }),
      ]);
      if (!alive) return;
      if (!item) { setState("missing"); return; }
      setStore(found);
      setProduct(item);
      setOthers(((catalog ?? []) as DeliveryProduct[]).filter((other) => other.id !== item.id));
      setVendedor((resumen as VendedorResumen | null) ?? null);
      setState("ready");
    })();
    return () => { alive = false; };
  }, [slug, id]);

  const theme = useMemo(() => normalizeTheme(store?.tienda_tema), [store?.tienda_tema]);
  const style = useMemo(() => estiloTienda(theme), [theme]);
  const masVendidos = useMemo(() => (vendedor?.mas_vendidos ?? []).map((item) => item.producto_id), [vendedor]);

  // Título, descripción y datos estructurados (Product) para buscadores y para compartir.
  useEffect(() => {
    if (!store || !product) return;
    const previousTitle = document.title;
    document.title = `${product.nombre} · ${store.nombre}`;
    const description = (product.descripcion || `${product.nombre} en ${store.nombre}. Pedilo online.`).slice(0, 155);
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", description);
    const script = document.createElement("script");
    script.type = "application/ld+json";
    const fotos = fotosDe(product).filter((url) => /^https:\/\//i.test(url));
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "Product",
      name: product.nombre,
      description,
      image: fotos.length ? fotos : undefined,
      brand: { "@type": "Brand", name: store.nombre },
      offers: { "@type": "Offer", priceCurrency: "ARS", price: Number(product.precio), availability: product.stock === 0 || !product.disponible ? "https://schema.org/OutOfStock" : "https://schema.org/InStock", url: `${storefrontUrl(store.slug)}/p/${product.id}` },
    }).replace(/</g, "\\u003c");
    document.head.appendChild(script);
    return () => { document.title = previousTitle; if (previousDescription !== null) meta?.setAttribute("content", previousDescription); script.remove(); };
  }, [store, product]);

  if (state === "loading") return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (state === "missing" || !store || !product) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <StoreIcon className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-extrabold">No encontramos este producto</h1>
        <p className="mt-1 text-muted-foreground">Puede que ya no esté disponible.</p>
        <Button asChild className="mt-6 rounded-full"><Link to={slug ? `/t/${slug}` : "/app"}>Ver la tienda</Link></Button>
      </div>
    );
  }

  const { d, darkPage, pageStyle, accent, headingStyle, radiusButton, width } = style;
  const open = isOpenNow(store);
  const reach = storeReach(store, point, undefined, tariff);
  const unavailable = !open || !reach.inZone;
  const fee = deliveryFeeLabel(store, reach.fee);
  const conVariantes = Boolean(product.usa_variantes);
  const outOfStock = !product.disponible || product.stock === 0 || (conVariantes && variantesDisponibles(product).length === 0);
  const groups = sortGroups(product.grupos);
  const hasOptions = conVariantes || groups.some((group) => group.opciones.some((option) => option.disponible));
  const maxQty = Math.min(product.stock ?? 50, 50);
  const off = descuentoPct(product);
  const fotos = fotosDe(product);
  const lista = insignias(product, masVendidos);
  const cartStore: CartStore = { id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio, pedido_minimo: store.pedido_minimo, envio_gratis_desde: store.envio_gratis_desde, imagen_url: store.imagen_url };
  const faved = favs.includes(product.id);
  const related = [...others.filter((other) => other.categoria === product.categoria), ...others.filter((other) => other.categoria !== product.categoria)].slice(0, 8);

  const add = (goToCart: boolean) => {
    const sameStore = addItem(product, cartStore, quantity);
    if (!sameStore) toast.info(`Vaciamos tu carrito anterior para pedir en ${store.nombre}`);
    else if (!goToCart) toast.success("Agregado al carrito");
    if (goToCart) navigate("/app/carrito");
  };
  const toggleFav = () => {
    const next = faved ? favs.filter((item) => item !== product.id) : [...favs, product.id];
    setFavs(next);
    try { window.localStorage.setItem(FAV_KEY, JSON.stringify(next.slice(-200))); } catch { /* sin almacenamiento */ }
    toast(faved ? "Quitado de tus favoritos" : "Guardado en tus favoritos");
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.nombre, text: `${product.nombre} en ${store.nombre}`, url });
      else { await navigator.clipboard.writeText(url); toast.success("Copiamos el enlace del producto"); }
    } catch { /* la persona cerró el menú de compartir */ }
  };

  const cta = () => ({ ...accent, ...radiusButton }) as React.CSSProperties;

  return (
    <div style={pageStyle} className={cn("min-h-screen bg-background text-foreground", darkPage && "dark")}>
      {theme.anuncio && <p className="px-4 py-2 text-center text-sm font-semibold" style={accent}>{theme.anuncio}</p>}
      <header className="sticky top-0 z-30 border-b bg-card/95 text-card-foreground backdrop-blur">
        <div className={cn("mx-auto flex h-16 items-center gap-3 px-4 sm:px-6", width)}>
          <Link to={`/t/${store.slug}`} className="flex min-w-0 items-center gap-3" aria-label={`Volver a ${store.nombre}`}>
            <StoreLogo store={store} className={cn("h-10 w-10 shrink-0 text-sm", d.radio === "cuadrado" && "!rounded-none")} />
            <span className="truncate text-lg font-extrabold" style={headingStyle}>{store.nombre}</span>
          </Link>
          <Link to="/app/carrito" className="ml-auto inline-flex shrink-0 items-center gap-2 px-4 py-2 text-sm font-bold" style={{ ...accent, ...radiusButton }}><ShoppingBag className="h-4 w-4" />Mi pedido</Link>
        </div>
      </header>

      <main className={cn("mx-auto px-4 pb-24 pt-6 sm:px-6", width)}>
        <nav aria-label="Ruta" className="mb-5 flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <Link to={`/t/${store.slug}`} className="hover:underline">{store.nombre}</Link><ChevronRight className="h-3.5 w-3.5" />
          <span>{product.categoria}</span><ChevronRight className="h-3.5 w-3.5" />
          <span className="truncate font-semibold text-foreground">{product.nombre}</span>
        </nav>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
          <ProductGallery photos={fotos} alt={product.nombre} />

          <div className="min-w-0 lg:sticky lg:top-24 lg:self-start">
            <div className="flex items-start justify-between gap-3">
              <div className="flex flex-wrap gap-1.5">
                {lista.filter((badge) => badge.id !== "oferta").map((badge) => <span key={badge.id} className={cn("rounded-full px-2.5 py-0.5 text-xs font-black", badge.id === "masvendido" ? "bg-[#FFE14D] text-black" : badge.id === "nuevo" ? "bg-[#4FE3B8] text-black" : "bg-destructive/90 text-white")}>{badge.texto}</span>)}
              </div>
              <div className="flex shrink-0 gap-1">
                <button type="button" aria-label="Compartir" onClick={share} className="flex h-10 w-10 items-center justify-center rounded-full border hover:bg-muted"><Share2 className="h-4 w-4" /></button>
                <button type="button" aria-label={faved ? "Quitar de favoritos" : "Guardar en favoritos"} aria-pressed={faved} onClick={toggleFav} className="flex h-10 w-10 items-center justify-center rounded-full border hover:bg-muted"><Heart className={cn("h-4 w-4", faved && "fill-destructive text-destructive")} /></button>
              </div>
            </div>

            <h1 className="mt-3 text-2xl font-extrabold leading-tight sm:text-3xl" style={headingStyle}>{product.nombre}</h1>

            <div className="mt-4">
              {off && <p className="text-base text-muted-foreground line-through">{money(product.precio_anterior ?? 0)}</p>}
              <p className="flex flex-wrap items-baseline gap-3"><span className="text-4xl font-black tabular-nums">{conVariantes && <span className="mr-2 text-lg font-bold text-muted-foreground">Desde</span>}{money(precioDesde(product))}</span>{off && <span className="text-lg font-extrabold text-success">{off}% OFF</span>}</p>
            </div>

            <ul className="mt-5 space-y-2.5 rounded-2xl border bg-card p-4 text-sm text-card-foreground">
              <li className="flex items-start gap-2.5"><Bike className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                <span>
                  {point ? <><span className="font-bold">{fee === "Envío gratis" ? "Envío gratis" : fee}</span> a tu dirección{reach.km != null && <span className="text-muted-foreground"> · a {formatKm(reach.km)}</span>}</> : <span className="font-bold">Elegí tu dirección para ver el costo de envío</span>}
                  {" · "}<AddressDialog trigger={<button type="button" className="font-bold underline underline-offset-4">{point ? "Cambiar" : "Elegir dirección"}</button>} />
                </span>
              </li>
              <li className="flex items-center gap-2.5"><Clock3 className="h-4 w-4 shrink-0 text-muted-foreground" />Llega en {store.tiempo_min}-{store.tiempo_max} minutos</li>
              <li className="flex items-center gap-2.5"><Wallet className="h-4 w-4 shrink-0 text-muted-foreground" /><span><span className="font-bold">Medios de pago:</span> {pagoOnline ? "Mercado Pago (tarjeta, débito, dinero en cuenta), " : ""}efectivo o transferencia</span></li>
              {store.acepta_retiro && <li className="flex items-center gap-2.5"><StoreIcon className="h-4 w-4 shrink-0 text-muted-foreground" />También podés retirarlo en el local</li>}
            </ul>

            <p className="mt-4 text-sm font-semibold">
              {outOfStock ? <span className="text-destructive">Sin stock por el momento</span>
                : !conVariantes && product.stock != null && product.stock <= 5 ? <span className="text-destructive">¡Últimas {product.stock} unidades disponibles!</span>
                : <span className="text-success">Stock disponible</span>}
            </p>

            {unavailable && !outOfStock && (
              <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-foreground">
                {!open ? <><span className="font-extrabold">Cerrado ahora.</span> {store.esta_abierto ? nextOpening(store.horarios) || "" : "El local pausó los pedidos por un rato."}</> : <><span className="font-extrabold">No llega a tu dirección.</span> Elegí otra dirección para pedir.</>}
              </p>
            )}

            {!outOfStock && !unavailable && (
              <div className="mt-5 space-y-3">
                {hasOptions ? (
                  <button type="button" onClick={() => setOptions(true)} className="h-13 w-full py-3.5 text-base font-bold" style={cta()}>{conVariantes ? "Elegir opción y agregar" : "Elegir opciones y agregar"}</button>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-semibold">Cantidad</span>
                      <div className="flex items-center border" style={radiusButton}>
                        <button type="button" aria-label="Menos" className="flex h-10 w-10 items-center justify-center disabled:opacity-40" disabled={quantity <= 1} onClick={() => setQuantity((q) => Math.max(1, q - 1))}><Minus className="h-4 w-4" /></button>
                        <span className="w-10 text-center font-extrabold tabular-nums" aria-live="polite">{quantity}</span>
                        <button type="button" aria-label="Más" className="flex h-10 w-10 items-center justify-center disabled:opacity-40" disabled={quantity >= maxQty} onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}><Plus className="h-4 w-4" /></button>
                      </div>
                      {product.stock != null && <span className="text-xs text-muted-foreground">({product.stock} disponibles)</span>}
                    </div>
                    <button type="button" onClick={() => add(true)} className="w-full py-3.5 text-base font-bold" style={cta()}>Comprar ahora · {money(Number(product.precio) * quantity)}</button>
                    <button type="button" onClick={() => add(false)} className="w-full border-2 py-3 text-base font-bold" style={{ borderColor: "var(--sf-accent)", color: "var(--sf-accent)", ...radiusButton }}>Agregar al carrito</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0 space-y-12">
            {(product.descripcion || !!product.etiquetas?.length) && (
              <section>
                <h2 className="text-xl font-extrabold sm:text-2xl">Descripción</h2>
                {product.descripcion && <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground">{product.descripcion}</p>}
                {!!product.etiquetas?.length && <p className="mt-4 flex flex-wrap gap-2">{product.etiquetas.map((tag) => <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">{tagLabels[tag] ?? tag}</span>)}</p>}
              </section>
            )}
            <ProductQuestions productId={product.id} disabled={!store.aprobado} />
          </div>
          <aside className="space-y-4 lg:self-start">
            {vendedor && <SellerCard store={store} vendedor={vendedor} />}
            <Button asChild variant="outline" className="w-full rounded-full font-bold"><Link to={`/t/${store.slug}`}>Ver todos los productos del vendedor</Link></Button>
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-14">
            <h2 className="mb-5 text-xl font-extrabold sm:text-2xl">Más productos de {store.nombre}</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {related.map((other) => <ProductCard key={other.id} product={other} store={cartStore} disabled={unavailable} variant="shop" badges={insignias(other, masVendidos)} href={`/t/${store.slug}/p/${other.id}`} />)}
            </div>
          </section>
        )}
      </main>

      {options && <ProductDialog product={product} groups={groups} store={cartStore} onClose={() => setOptions(false)} />}
    </div>
  );
}
