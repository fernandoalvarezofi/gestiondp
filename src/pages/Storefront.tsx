import { useEffect, useMemo, useState } from "react";
import { marcarOrigenTienda } from "@/lib/canal";
import { Link, useLocation, useParams } from "react-router-dom";
import { Loader2, Store as StoreIcon } from "lucide-react";
import { StorefrontReview, StorefrontView } from "@/components/storefront/StorefrontView";
import { Button } from "@/components/ui/button";
import { COMERCIO_COLS, db, DeliveryProduct, DeliverySection, DeliveryStore, img, productSelect } from "@/lib/delivery";
import type { VendedorResumen } from "@/lib/marketplace";
import { storefrontUrl } from "@/lib/storefront";
import { parseVista } from "@/lib/storeRoutes";

/** Tienda online pública de un comercio (/t/:slug): se puede ver y armar el pedido sin cuenta; al confirmar se pide ingresar. */
export default function Storefront() {
  const { slug, categoria } = useParams();
  const location = useLocation();
  // Página de la tienda según la dirección: inicio, /c/<categoría>, /ofertas o /buscar?q=
  const vista = useMemo(() => parseVista(location.pathname, location.search, categoria), [location.pathname, location.search, categoria]);
  const [store, setStore] = useState<DeliveryStore | null>(null);
  const [products, setProducts] = useState<DeliveryProduct[]>([]);
  const [sections, setSections] = useState<DeliverySection[]>([]);
  const [reviews, setReviews] = useState<StorefrontReview[]>([]);
  const [vendedor, setVendedor] = useState<VendedorResumen | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    (async () => {
      const { data: found } = await db.from("delivery_comercios").select(COMERCIO_COLS).eq("slug", slug).maybeSingle();
      if (!alive) return;
      if (!found) { setState("missing"); return; }
      const [{ data: catalog }, { data: configured }, { data: opinions }, { data: resumen }] = await Promise.all([
        db.from("delivery_productos").select(productSelect).eq("comercio_id", found.id).order("orden").order("nombre"),
        db.from("delivery_secciones").select("*").eq("comercio_id", found.id),
        db.from("delivery_resenas").select("id,puntaje,comentario,created_at,cliente:perfiles(nombre)").eq("comercio_id", found.id).order("created_at", { ascending: false }).limit(12),
        db.rpc("delivery_vendedor_resumen", { p_slug: found.slug }),
      ]);
      if (!alive) return;
      setStore(found);
      marcarOrigenTienda(found.id);
      setProducts(catalog || []);
      setSections(configured || []);
      setReviews(opinions || []);
      setVendedor((resumen as VendedorResumen | null) ?? null);
      setState("ready");
    })();
    return () => { alive = false; };
  }, [slug]);

  // Cuenta una visita por sesión del navegador (anónima: solo suma un número al día, no guarda quién entra).
  useEffect(() => {
    if (!store) return;
    const key = `woref-visita-${store.slug}`;
    try { if (window.sessionStorage.getItem(key)) return; window.sessionStorage.setItem(key, "1"); } catch { /* sin almacenamiento: se cuenta igual */ }
    // La llamada solo se envía al esperar su resultado; si falla, la visita simplemente no se cuenta.
    db.rpc("delivery_tienda_visita", { p_slug: store.slug }).then(() => undefined, () => undefined);
  }, [store]);

  // Título, descripción y datos estructurados para buscadores y para compartir el enlace.
  useEffect(() => {
    if (!store) return;
    const previousTitle = document.title;
    document.title = vista.tipo === "coleccion" ? `${vista.categoria} · ${store.nombre}` : vista.tipo === "ofertas" ? `Ofertas · ${store.nombre}` : vista.tipo === "buscar" ? `${vista.q ? `Resultados para ${vista.q}` : "Productos"} · ${store.nombre}` : `${store.nombre} · Tienda online`;
    const description = (store.descripcion || `Pedí online en ${store.nombre}. Envío a domicilio o retiro en el local.`).slice(0, 155);
    const meta = document.querySelector('meta[name="description"]');
    const previousDescription = meta?.getAttribute("content") ?? null;
    meta?.setAttribute("content", description);
    const script = document.createElement("script");
    script.type = "application/ld+json";
    script.text = JSON.stringify({
      "@context": "https://schema.org",
      "@type": store.categoria === "comida" ? "Restaurant" : "Store",
      name: store.nombre,
      description,
      url: storefrontUrl(store.slug),
      image: store.imagen_url ? img(store.imagen_url, 1200) : undefined,
      address: store.direccion,
      ...(store.total_resenas > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(store.rating).toFixed(1), reviewCount: store.total_resenas } } : {}),
    }).replace(/</g, "\\u003c");
    document.head.appendChild(script);
    return () => {
      document.title = previousTitle;
      if (previousDescription !== null) meta?.setAttribute("content", previousDescription);
      script.remove();
    };
  }, [store, vista]);

  if (state === "loading") return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (state === "missing" || !store) {
    return (
      <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center">
        <StoreIcon className="h-10 w-10 text-muted-foreground" />
        <h1 className="mt-4 text-2xl font-extrabold">No encontramos esta tienda</h1>
        <p className="mt-1 text-muted-foreground">Puede que el enlace esté mal escrito o que la tienda ya no esté disponible.</p>
        <Button asChild className="mt-6 rounded-full"><Link to="/app">Ver otros comercios</Link></Button>
      </div>
    );
  }
  return <StorefrontView store={store} products={products} sections={sections} reviews={reviews} vendedor={vendedor} vista={vista} />;
}
