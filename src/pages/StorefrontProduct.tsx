import { useEffect, useMemo } from "react";
import { Link, useParams } from "react-router-dom";
import { Loader2, Store as StoreIcon } from "lucide-react";
import { ProductoDetalle } from "@/components/storefront/ProductoDetalle";
import { StorefrontView } from "@/components/storefront/StorefrontView";
import { Button } from "@/components/ui/button";
import { ErrorState } from "@/components/delivery/Common";
import { useTiendaPublica } from "@/hooks/useTiendaPublica";
import { aplicarHead, cargarPixeles } from "@/lib/storeHead";
import { normalizeTheme, storefrontUrl } from "@/lib/storefront";
import { fotosDe } from "@/lib/marketplace";

/**
 * Ficha de producto de una tienda online (/t/:slug/p/:id). Usa el mismo encabezado, menú y pie que el resto del sitio y, debajo de la
 * ficha, las secciones de la plantilla "Ficha de producto" que el comercio arma en el editor.
 */
export default function StorefrontProduct() {
  const { slug, id } = useParams();
  const tienda = useTiendaPublica(slug);
  const datos = tienda.estado === "ready" ? tienda.datos : null;
  const store = datos?.store ?? null;
  // El producto se abre por su id o por su dirección amigable. Solo lo publicado en la tienda online.
  const product = useMemo(() => datos?.products.find((p) => (p.id === id || p.slug === id) && p.en_tienda !== false) ?? null, [datos, id]);
  const others = useMemo(() => (datos?.products ?? []).filter((p) => p.id !== product?.id && p.disponible !== false && p.en_tienda !== false), [datos, product]);
  const theme = useMemo(() => normalizeTheme(store?.tienda_tema), [store?.tienda_tema]);
  useEffect(() => { window.scrollTo({ top: 0 }); }, [id]);

  // Título, descripción y datos estructurados (Product) para buscadores y para compartir.
  useEffect(() => {
    if (!store || !product) return;
    const description = product.seo_descripcion || product.descripcion || `${product.nombre} en ${store.nombre}. Pedilo online.`;
    const fotos = fotosDe(product).filter((url) => /^https:\/\//i.test(url));
    const canonica = `${storefrontUrl(store.slug)}/p/${product.slug || product.id}`;
    const agotado = product.stock === 0 || !product.disponible;
    cargarPixeles({ pixel_meta: theme.pixel_meta, ga4: theme.ga4 }, "ViewContent", { content_ids: [product.id], content_type: "product", value: Number(product.precio), currency: "ARS" });
    return aplicarHead({
      titulo: `${product.seo_titulo || product.nombre} · ${store.nombre}`, descripcion: description, canonica, favicon: theme.favicon_url, imagen: fotos[0] ?? null, indexar: theme.indexar !== false,
      jsonLd: {
        "@context": "https://schema.org",
        "@type": "Product",
        name: product.nombre,
        description: description.slice(0, 500),
        image: fotos.length ? fotos : undefined,
        sku: product.sku ?? undefined,
        gtin: product.codigo_barras && /^\d{8,14}$/.test(product.codigo_barras) ? product.codigo_barras : undefined,
        brand: { "@type": "Brand", name: product.marca || store.nombre },
        ...(Number(product.rating_count) > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(product.rating_avg).toFixed(1), reviewCount: product.rating_count } } : {}),
        offers: {
          "@type": "Offer", priceCurrency: "ARS", price: Number(product.precio), url: canonica, availability: agotado ? "https://schema.org/OutOfStock" : "https://schema.org/InStock",
          ...(product.promo_activa && product.promo_hasta ? { priceValidUntil: product.promo_hasta.slice(0, 10) } : {}),
        },
      },
    });
  }, [store, product, theme]);

  if (tienda.estado === "loading") return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (tienda.estado === "error") return <div className="mx-auto flex min-h-screen max-w-md items-center px-6"><ErrorState className="w-full" title="No pudimos abrir esta tienda" onRetry={() => window.location.reload()} /></div>;
  if (!datos || !store || !product) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <StoreIcon className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-extrabold">No encontramos este producto</h1>
        <p className="mt-1 text-muted-foreground">Puede que ya no esté disponible.</p>
        <Button asChild className="mt-6 rounded-full"><Link to={slug ? `/t/${slug}` : "/app"}>Ver la tienda</Link></Button>
      </div>
    );
  }
  return (
    <StorefrontView store={store} tema={theme} products={datos.products} sections={datos.sections} reviews={datos.reviews} vendedor={datos.vendedor} vista={{ tipo: "producto" }}
      reservaHref={datos.servicios.length ? `/t/${store.slug}/reservar` : null} servicios={datos.servicios} colecciones={datos.colecciones} paginas={datos.paginas}
      principal={<ProductoDetalle store={store} product={product} others={others} vendedor={datos.vendedor} theme={theme} />} />
  );
}
