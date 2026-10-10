import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Bike, ChevronRight, Clock3, Heart, Minus, Plus, Share2, Store as StoreIcon, Wallet } from "lucide-react";
import { toast } from "sonner";
import { RichText } from "@/components/storefront/RichText";
import { Politicas } from "@/components/storefront/MarketingBlocks";
import { AddressDialog } from "@/components/delivery/AddressDialog";
import { ProductCard, ProductDialog } from "@/components/delivery/ProductCard";
import { deliveryFeeLabel } from "@/components/delivery/StoreCard";
import { ProductGallery } from "@/components/storefront/ProductGallery";
import { ProductQuestions } from "@/components/storefront/ProductQuestions";
import { AskSeller } from "@/components/messages/AskSeller";
import { ProductReviews } from "@/components/market/ProductReviews";
import { Stars } from "@/components/market/Stars";
import { promedioTexto } from "@/services/reviews";
import { useProductFavorites } from "@/hooks/useProductFavorites";
import { SellerCard } from "@/components/storefront/SellerCard";
import { Button } from "@/components/ui/button";
import { CartStore, useCart } from "@/contexts/CartContext";
import { useAddressPoint } from "@/hooks/useAddressPoint";
import { useTariff } from "@/hooks/useTariff";
import { db, DeliveryProduct, DeliveryStore, isOpenNow, money, nextOpening, precioDesde, sortGroups, tagLabels, variantesDisponibles } from "@/lib/delivery";
import { formatKm, storeReach } from "@/lib/geo";
import { descuentoPct, fotosDe, insignias, type VendedorResumen } from "@/lib/marketplace";
import type { TemaNormalizado } from "@/lib/storefront";
import { estiloTienda } from "@/lib/storefrontStyle";
import { cn } from "@/lib/utils";

/**
 * Parte fija de la ficha de producto (fotos, precio, opciones, compra, descripción, políticas, opiniones, preguntas, vendedor y
 * relacionados). El encabezado, el pie y las secciones de la plantilla "Ficha de producto" los pone la tienda (StorefrontView),
 * así la ficha comparte navegación y diseño con el resto del sitio. En la vista previa del editor, comprar y preguntar quedan inertes.
 */
export function ProductoDetalle({ store, product, others, vendedor, theme, preview = false }: {
  store: DeliveryStore; product: DeliveryProduct; others: DeliveryProduct[]; vendedor: VendedorResumen | null; theme: TemaNormalizado; preview?: boolean;
}) {
  const navigate = useNavigate();
  const { addItem } = useCart();
  const point = useAddressPoint();
  const tariff = useTariff(point);
  const [pagoOnline, setPagoOnline] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [varianteId, setVarianteId] = useState<string | null>(null);
  const [options, setOptions] = useState(false);
  const favoritos = useProductFavorites();
  const masVendidos = (vendedor?.mas_vendidos ?? []).map((item) => item.producto_id);
  const style = estiloTienda(theme);

  useEffect(() => { if (!preview) db.rpc("delivery_pagos_online_activos").then(({ data }: { data: boolean | null }) => setPagoOnline(Boolean(data)), () => undefined); }, [preview]);
  useEffect(() => { setQuantity(1); setVarianteId(null); }, [product.id]);

  // Barra de compra fija en el celular: aparece cuando el botón principal sale de la pantalla.
  const ctaRef = useRef<HTMLDivElement>(null);
  const [ctaVisible, setCtaVisible] = useState(true);
  useEffect(() => {
    const el = ctaRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setCtaVisible(entry.isIntersecting), { threshold: 0 });
    io.observe(el);
    return () => io.disconnect();
  });

  const { accent, headingStyle, radiusButton, width, tituloClase } = style;
  const open = isOpenNow(store);
  const reach = storeReach(store, point, undefined, tariff);
  const unavailable = !open || !reach.inZone;
  const fee = deliveryFeeLabel(store, reach.fee);
  const conVariantes = Boolean(product.usa_variantes);
  const outOfStock = !product.disponible || product.stock === 0 || (conVariantes && variantesDisponibles(product).length === 0);
  const groups = sortGroups(product.grupos);
  // Variantes sin grupos de opciones se eligen acá mismo (talle, color…), con precio y stock propios; con grupos se sigue usando el detalle emergente.
  const inlineVariantes = conVariantes && groups.length === 0;
  const variantes = inlineVariantes ? [...(product.variantes ?? [])].sort((a, b) => a.orden - b.orden) : [];
  const variante = inlineVariantes ? (variantes.find((v) => v.id === varianteId && v.disponible && v.stock !== 0) ?? variantesDisponibles(product)[0] ?? null) : null;
  const precioActual = variante?.precio != null ? Number(variante.precio) : Number(product.precio);
  const stockActual = variante ? variante.stock : product.stock;
  const maxQty = Math.min(stockActual ?? 50, 50);
  const hasOptions = (conVariantes && !inlineVariantes) || groups.some((group) => group.opciones.some((option) => option.disponible));
  // Con variante elegida el descuento se calcula sobre el precio de esa variante, no sobre el del producto.
  const anterior = Number(product.precio_anterior ?? 0);
  const off = inlineVariantes ? (anterior > precioActual ? Math.round((1 - precioActual / anterior) * 100) : null) : descuentoPct(product);
  const fotos = fotosDe(product);
  const lista = insignias(product, masVendidos);
  const cartStore: CartStore = { id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio, pedido_minimo: store.pedido_minimo, envio_gratis_desde: store.envio_gratis_desde, imagen_url: store.imagen_url };
  const faved = favoritos.isFavorite(product.id);
  // Políticas: las que cargó el comercio en su tienda o, si no cargó ninguna, un resumen con los datos reales del local.
  const bloquePoliticas = theme.bloques.find((b) => b.tipo === "politicas" && b.items.length > 0);
  const politicasItems = bloquePoliticas && bloquePoliticas.tipo === "politicas"
    ? { titulo: bloquePoliticas.titulo || "Envíos, cambios y garantía", items: bloquePoliticas.items }
    : { titulo: "Envíos y pagos", items: [
      { t: "Envíos", x: `${fee === "Envío gratis" ? "Envío gratis" : fee} a tu dirección. Llega en ${store.tiempo_min}-${store.tiempo_max} minutos${store.acepta_retiro ? ". También podés retirarlo en el local." : "."}` },
      { t: "Medios de pago", x: `${pagoOnline ? "Mercado Pago (tarjeta, débito, dinero en cuenta), " : ""}efectivo o transferencia.` },
    ] };
  // Primero los relacionados que eligió el comercio (en su orden), después los de la misma sección y el resto.
  const elegidos = (product.relacionados ?? []).map((rid) => others.find((o) => o.id === rid)).filter((o): o is DeliveryProduct => Boolean(o));
  const related = [...elegidos, ...others.filter((other) => !elegidos.includes(other) && other.categoria === product.categoria), ...others.filter((other) => !elegidos.includes(other) && other.categoria !== product.categoria)].slice(0, 8);

  const add = (goToCart: boolean) => {
    if (preview) return;
    const agregado = addItem(product, cartStore, quantity, undefined, [], variante ? { id: variante.id, nombre: variante.nombre, precio: variante.precio } : undefined);
    if (!agregado) { toast.error("Tu carrito ya tiene 5 comercios. Terminá o quitá uno para sumar otro."); return; }
    if (!goToCart) toast.success("Agregado al carrito");
    if (goToCart) navigate("/app/carrito");
  };
  const toggleFav = async () => {
    if (preview) return;
    const ahora = await favoritos.toggle(product.id);
    toast(ahora ? (favoritos.enCuenta ? "Guardado en tus favoritos" : "Guardado en este dispositivo. Ingresá para verlo en todos") : "Quitado de tus favoritos");
  };
  const share = async () => {
    if (preview) return;
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: product.nombre, text: `${product.nombre} en ${store.nombre}`, url });
      else { await navigator.clipboard.writeText(url); toast.success("Copiamos el enlace del producto"); }
    } catch { /* la persona cerró el menú de compartir */ }
  };

  const cta = () => ({ ...accent, ...radiusButton }) as React.CSSProperties;


  return (
    <>
      <div className={cn("mx-auto px-4 pb-10 pt-6 sm:px-6", width)}>
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
            {!!product.rating_count && product.rating_avg != null && (
              <a href="#opiniones" className="mt-2 flex items-center gap-2 text-sm hover:underline"><span className="font-bold">{promedioTexto(product.rating_avg)}</span><Stars value={Number(product.rating_avg)} size={16} /><span className="text-muted-foreground">({product.rating_count} {product.rating_count === 1 ? "opinión" : "opiniones"})</span></a>
            )}

            <div className="mt-4">
              {off && <p className="text-base text-muted-foreground line-through">{money(product.precio_anterior ?? 0)}</p>}
              <p className="flex flex-wrap items-baseline gap-3"><span className="text-4xl font-black tabular-nums">{conVariantes && !inlineVariantes && <span className="mr-2 text-lg font-bold text-muted-foreground">Desde</span>}{money(inlineVariantes ? precioActual : precioDesde(product))}</span>{off && <span className="text-lg font-extrabold text-success">{off}% OFF</span>}</p>
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
                : stockActual != null && stockActual <= 5 && (!conVariantes || inlineVariantes) ? <span className="text-destructive">¡Últimas {stockActual} unidades disponibles!</span>
                : <span className="text-success">Stock disponible</span>}
            </p>

            {unavailable && !outOfStock && (
              <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-foreground">
                {!open ? <><span className="font-extrabold">Cerrado ahora.</span> {store.esta_abierto ? nextOpening(store.horarios) || "" : "El local pausó los pedidos por un rato."}</> : <><span className="font-extrabold">No llega a tu dirección.</span> Elegí otra dirección para pedir.</>}
              </p>
            )}

            {!outOfStock && !unavailable && (
              <div ref={ctaRef} className="mt-5 space-y-3">
                {inlineVariantes && variantes.length > 0 && (
                  <fieldset>
                    <legend className="text-sm font-bold">Elegí una opción{variante && <span className="ml-1 font-semibold text-muted-foreground">· {variante.nombre}</span>}</legend>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {variantes.map((v) => {
                        const agotada = !v.disponible || v.stock === 0;
                        const active = v.id === variante?.id;
                        return (
                          <button key={v.id} type="button" disabled={agotada} aria-pressed={active} onClick={() => { setVarianteId(v.id); setQuantity(1); }}
                            className={cn("min-w-[3rem] border-2 px-4 py-2 text-sm font-bold transition-colors", agotada && "cursor-not-allowed line-through opacity-40")}
                            style={{ ...radiusButton, ...(active ? { borderColor: "var(--sf-accent)", background: "var(--sf-accent)", color: "var(--sf-on-accent)" } : {}) }}>
                            {v.nombre}
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>
                )}
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
                      {stockActual != null && <span className="text-xs text-muted-foreground">({stockActual} disponibles)</span>}
                    </div>
                    <button type="button" onClick={() => add(true)} className="w-full py-3.5 text-base font-bold" style={cta()}>Comprar ahora · {money(precioActual * quantity)}</button>
                    <button type="button" onClick={() => add(false)} className="w-full border-2 py-3 text-base font-bold" style={{ borderColor: "var(--sf-accent)", color: "var(--sf-accent)", ...radiusButton }}>Agregar al carrito</button>
                  </>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="mt-14 grid gap-10 lg:grid-cols-[minmax(0,1.25fr)_minmax(0,1fr)] lg:gap-12">
          <div className="min-w-0 space-y-12">
            {(product.descripcion || product.descripcion_larga || !!product.etiquetas?.length) && (
              <section>
                <h2 className={cn("font-extrabold", tituloClase)} style={headingStyle}>Descripción</h2>
                {product.descripcion && !product.descripcion_larga && <p className="mt-4 whitespace-pre-line leading-relaxed text-muted-foreground">{product.descripcion}</p>}
                {product.descripcion_larga && <RichText texto={product.descripcion_larga} className="mt-4 text-muted-foreground" />}
                {(product.sku || product.marca) && <p className="mt-4 text-xs text-muted-foreground">{product.marca ? `Marca: ${product.marca}` : ""}{product.marca && product.sku ? " · " : ""}{product.sku ? `Código: ${product.sku}` : ""}</p>}
                {!!product.etiquetas?.length && <p className="mt-4 flex flex-wrap gap-2">{product.etiquetas.map((tag) => <span key={tag} className="rounded-full bg-muted px-3 py-1 text-xs font-bold text-muted-foreground">{tagLabels[tag] ?? tag}</span>)}</p>}
              </section>
            )}
            <section>
              <h2 className={cn("mb-4 font-extrabold", tituloClase)} style={headingStyle}>{politicasItems.titulo}</h2>
              <Politicas items={politicasItems.items} />
            </section>
            <ProductReviews productId={product.id} />
            <ProductQuestions productId={product.id} disabled={preview || !store.aprobado} />
          </div>
          <aside className="space-y-4 lg:self-start">
            {vendedor && <SellerCard store={store} vendedor={vendedor} />}
            {!preview && <Button asChild variant="outline" className="w-full rounded-full font-bold"><Link to={`/t/${store.slug}`}>Ver todos los productos del vendedor</Link></Button>}
            {!preview && <AskSeller storeId={store.id} storeName={store.nombre} productId={product.id} productName={product.nombre} />}
          </aside>
        </div>

        {related.length > 0 && (
          <section className="mt-14">
            <h2 className={cn("mb-5 font-extrabold", tituloClase)} style={headingStyle}>Más productos de {store.nombre}</h2>
            <div className="grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 lg:grid-cols-4">
              {related.map((other) => <ProductCard key={other.id} product={other} store={cartStore} disabled={unavailable} variant="shop" badges={insignias(other, masVendidos)} href={preview ? undefined : `/t/${store.slug}/p/${other.slug || other.id}`} />)}
            </div>
          </section>
        )}
      </div>

      {!outOfStock && !unavailable && !ctaVisible && (
        <div className="fixed inset-x-0 bottom-0 z-40 border-t bg-background/95 px-4 py-3 backdrop-blur md:hidden" role="region" aria-label="Comprar este producto">
          <div className="mx-auto flex max-w-md items-center gap-3">
            <div className="min-w-0"><p className="truncate text-xs text-muted-foreground">{product.nombre}</p><p className="font-black tabular-nums">{conVariantes && !inlineVariantes && <span className="mr-1 text-xs font-bold text-muted-foreground">Desde</span>}{money(inlineVariantes ? precioActual : precioDesde(product))}</p></div>
            <button type="button" onClick={() => (hasOptions ? setOptions(true) : add(true))} className="ml-auto shrink-0 px-6 py-3 text-base font-bold" style={cta()}>{hasOptions ? "Elegir opción" : "Comprar ahora"}</button>
          </div>
        </div>
      )}
      {options && <ProductDialog product={product} groups={groups} store={cartStore} onClose={() => setOptions(false)} />}
    </>
  );
}
