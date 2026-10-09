import { consiente } from "@/lib/cookies";
import { useEffect, useMemo, useState } from "react";
import { marcarOrigenTienda } from "@/lib/canal";
import { Link, useLocation, useParams } from "react-router-dom";
import { Loader2, Store as StoreIcon } from "lucide-react";
import { ColeccionTienda, PaginaTienda, ServicioTienda, StorefrontReview, StorefrontView } from "@/components/storefront/StorefrontView";
import { normalizeTheme } from "@/lib/storefront";
import { aplicarHead, cargarPixeles } from "@/lib/storeHead";
import { fetchColeccionesPublicas } from "@/services/catalogPro";
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
  const [conTurnos, setConTurnos] = useState(false);
  const [servicios, setServicios] = useState<ServicioTienda[]>([]);
  const [paginas, setPaginas] = useState<PaginaTienda[]>([]);
  const [colecciones, setColecciones] = useState<ColeccionTienda[]>([]);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");

  useEffect(() => {
    let alive = true;
    setState("loading");
    (async () => {
      const { data: found } = await db.from("delivery_comercios").select(COMERCIO_COLS).eq("slug", slug).maybeSingle();
      if (!alive) return;
      if (!found) { setState("missing"); return; }
      // Solo lo publicado: aunque quien mira sea del equipo (que por permisos ve borradores), la tienda muestra lo mismo que ve un cliente.
      const [{ data: catalog }, { data: configured }, { data: opinions }, { data: resumen }, { data: servs }, { data: pags }, cols] = await Promise.all([
        db.from("delivery_productos").select(productSelect).eq("comercio_id", found.id).eq("estado", "publicado").order("orden").order("nombre"),
        db.from("delivery_secciones").select("*").eq("comercio_id", found.id),
        db.from("delivery_resenas").select("id,puntaje,comentario,created_at,cliente:perfiles(nombre)").eq("comercio_id", found.id).order("created_at", { ascending: false }).limit(12),
        db.rpc("delivery_vendedor_resumen", { p_slug: found.slug }),
        db.from("servicios").select("id,nombre,descripcion,duracion_min,precio,imagen_url,capacidad").eq("comercio_id", found.id).eq("activo", true).order("orden").order("nombre"),
        db.from("delivery_tienda_paginas").select("id,slug,titulo,tipo,clase,contenido,bloques,imagen_url,seo_titulo,seo_descripcion").eq("comercio_id", found.id).eq("estado", "publicada").order("orden").order("titulo"),
        fetchColeccionesPublicas(found.id).catch(() => []),
      ]);
      if (!alive) return;
      setStore(found);
      marcarOrigenTienda(found.id);
      setProducts(catalog || []);
      setSections(configured || []);
      setReviews(opinions || []);
      setVendedor((resumen as VendedorResumen | null) ?? null);
      setServicios((servs ?? []) as ServicioTienda[]);
      setPaginas((pags ?? []) as PaginaTienda[]);
      setColecciones(cols as ColeccionTienda[]);
      setConTurnos((servs ?? []).length > 0);
      setState("ready");
    })();
    return () => { alive = false; };
  }, [slug]);

  // Cuenta una visita por sesión del navegador (anónima: solo suma un número al día, no guarda quién entra).
  useEffect(() => {
    // Es medición: solo con consentimiento de cookies.
    if (!store || !consiente("medicion")) return;
    const key = `woref-visita-${store.slug}`;
    try { if (window.sessionStorage.getItem(key)) return; window.sessionStorage.setItem(key, "1"); } catch { /* sin almacenamiento: se cuenta igual */ }
    // La llamada solo se envía al esperar su resultado; si falla, la visita simplemente no se cuenta.
    db.rpc("delivery_tienda_visita", { p_slug: store.slug }).then(() => undefined, () => undefined);
  }, [store]);

  // Título, descripción, canónica, ícono, indexación y datos estructurados (con lo que el comercio configuró en SEO).
  useEffect(() => {
    if (!store) return;
    const tema = normalizeTheme(store.tienda_tema);
    const base = storefrontUrl(store.slug);
    const descripcionTienda = tema.seo_descripcion || store.descripcion || `Pedí online en ${store.nombre}. Envío a domicilio o retiro en el local.`;
    const pagina = vista.tipo === "pagina" ? paginas.find((p) => p.slug === vista.slug) : undefined;
    const curada = vista.tipo === "curada" ? colecciones.find((c) => c.slug === vista.slug) : undefined;
    const titulo = vista.tipo === "coleccion" ? `${vista.categoria} · ${store.nombre}` : vista.tipo === "ofertas" ? `Ofertas · ${store.nombre}` : vista.tipo === "buscar" ? `${vista.q ? `Resultados para ${vista.q}` : "Productos"} · ${store.nombre}`
      : pagina ? `${pagina.seo_titulo || pagina.titulo} · ${store.nombre}` : curada ? `${curada.nombre} · ${store.nombre}` : tema.seo_titulo || `${store.nombre} · Tienda online`;
    const canonica = vista.tipo === "coleccion" ? `${base}/c/${encodeURIComponent(vista.categoria)}` : vista.tipo === "ofertas" ? `${base}/ofertas` : vista.tipo === "pagina" ? `${base}/pagina/${vista.slug}` : vista.tipo === "curada" ? `${base}/coleccion/${vista.slug}` : base;
    return aplicarHead({
      titulo, canonica, favicon: tema.favicon_url, indexar: tema.indexar !== false && vista.tipo !== "buscar",
      descripcion: pagina?.seo_descripcion || curada?.descripcion || descripcionTienda,
      imagen: tema.og_imagen || tema.banner_url || (store.imagen_url ? img(store.imagen_url, 1200) : null),
      jsonLd: {
        "@context": "https://schema.org",
        "@type": store.categoria === "comida" ? "Restaurant" : "Store",
        name: store.nombre, description: descripcionTienda.slice(0, 300), url: base,
        image: store.imagen_url ? img(store.imagen_url, 1200) : undefined, address: store.direccion, telephone: store.telefono ?? undefined,
        ...(store.total_resenas > 0 ? { aggregateRating: { "@type": "AggregateRating", ratingValue: Number(store.rating).toFixed(1), reviewCount: store.total_resenas } } : {}),
      },
    });
  }, [store, vista, paginas, colecciones]);
  // Píxeles del comercio (solo con consentimiento de medición).
  useEffect(() => { if (store) { const t = normalizeTheme(store.tienda_tema); cargarPixeles({ pixel_meta: t.pixel_meta, ga4: t.ga4 }); } }, [store, vista]);

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
  return <StorefrontView store={store} products={products} sections={sections} reviews={reviews} vendedor={vendedor} vista={vista} reservaHref={conTurnos ? `/t/${store.slug}/reservar` : null} servicios={servicios} colecciones={colecciones} paginas={paginas} />;
}
