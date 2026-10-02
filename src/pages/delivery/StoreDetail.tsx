import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bike, ChevronRight, Clock3, Copy, Info, MapPin, Phone, Search, Share2, ShoppingBag, Star, Store as StoreIcon, Ticket, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { FavoriteButton } from "@/components/delivery/FavoriteButton";
import { ProductCard } from "@/components/delivery/ProductCard";
import { deliveryFeeLabel, RatingBadge, StoreLogo } from "@/components/delivery/StoreCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CartStore } from "@/contexts/CartContext";
import { useAddressPoint } from "@/hooks/useAddressPoint";
import { useTariff } from "@/hooks/useTariff";
import { Coupon, couponValue, db, DeliveryProduct, DeliverySection, DeliveryStore, formatDateTime, img, isOpenNow, money, nextOpening, orderSections, productSelect, scheduleSummary } from "@/lib/delivery";
import { formatKm, storeReach } from "@/lib/geo";
import { useRoute } from "@/lib/route";
import { cn } from "@/lib/utils";

type Review = { id: string; puntaje: number; comentario?: string | null; respuesta?: string | null; created_at: string; cliente?: { nombre: string } | null };

export default function StoreDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const point = useAddressPoint();
  const tariff = useTariff(point);
  const [store, setStore] = useState<DeliveryStore | null>(null);
  const [products, setProducts] = useState<DeliveryProduct[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [sectionConfig, setSectionConfig] = useState<DeliverySection[]>([]);
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [term, setTerm] = useState("");
  const [searching, setSearching] = useState(false);
  const [activeSection, setActiveSection] = useState<string | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [reviewsOpen, setReviewsOpen] = useState(false);
  const tabsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      const { data: found } = await db.from("delivery_comercios").select("*").eq("slug", slug).maybeSingle();
      if (!found) { setNotFound(true); return; }
      setStore(found);
      const [{ data: catalog }, { data: opinions }, { data: storeCoupons }, { data: configured }] = await Promise.all([
        db.from("delivery_productos").select(productSelect).eq("comercio_id", found.id).order("orden").order("nombre"),
        db.from("delivery_resenas").select("id,puntaje,comentario,respuesta,created_at,cliente:perfiles(nombre)").eq("comercio_id", found.id).order("created_at", { ascending: false }).limit(30),
        db.from("delivery_cupones").select("*").eq("comercio_id", found.id).eq("activo", true),
        db.from("delivery_secciones").select("*").eq("comercio_id", found.id),
      ]);
      setSectionConfig(configured || []);
      setProducts(catalog || []);
      setReviews(opinions || []);
      setCoupons((storeCoupons || []).filter((coupon: Coupon) => !coupon.vence_at || new Date(coupon.vence_at) > new Date()));
    })();
  }, [slug]);

  const filtered = useMemo(() => {
    const value = term.trim().toLowerCase();
    return value ? products.filter((product) => `${product.nombre} ${product.descripcion || ""}`.toLowerCase().includes(value)) : products;
  }, [products, term]);

  const featured = useMemo(() => products.filter((product) => product.destacado && product.disponible), [products]);
  const sections = useMemo(() => orderSections(filtered, sectionConfig, true)
    .map(({ name }) => ({ name, items: filtered.filter((product) => product.categoria === name) }))
    .filter((section) => section.items.length > 0), [filtered, sectionConfig]);

  // Pestaña activa según la sección que se está viendo (scroll-spy).
  useEffect(() => {
    if (!sections.length) return;
    const observer = new IntersectionObserver((entries) => {
      const visible = entries.filter((entry) => entry.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (visible) setActiveSection(visible.target.getAttribute("data-section"));
    }, { rootMargin: "-140px 0px -60% 0px" });
    document.querySelectorAll("[data-section]").forEach((element) => observer.observe(element));
    return () => observer.disconnect();
  }, [sections]);

  useEffect(() => {
    if (!activeSection || !tabsRef.current) return;
    tabsRef.current.querySelector(`[data-tab="${CSS.escape(activeSection)}"]`)?.scrollIntoView({ behavior: "smooth", inline: "center", block: "nearest" });
  }, [activeSection]);

  const storePoint = store?.latitud != null && store?.longitud != null ? { lat: Number(store.latitud), lng: Number(store.longitud) } : null;
  const road = useRoute(storePoint, point, { persist: true });

  if (notFound) return <div className="mx-auto max-w-3xl px-4 py-16"><EmptyState icon={<StoreIcon className="h-7 w-7" />} title="No encontramos este local" text="Puede que ya no esté disponible." /></div>;
  if (!store) return <div className="mx-auto max-w-5xl sm:px-6 sm:pt-6"><div className="h-52 animate-pulse bg-muted sm:rounded-3xl" /><div className="mx-4 mt-4 h-24 animate-pulse rounded-3xl bg-muted" /></div>;

  const open = isOpenNow(store);
  const reach = storeReach(store, point, road?.km, tariff);
  const fee = deliveryFeeLabel(store, reach.fee);
  const cartStore: CartStore = { id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio, pedido_minimo: store.pedido_minimo, envio_gratis_desde: store.envio_gratis_desde, imagen_url: store.imagen_url };

  const scrollTo = (name: string) => {
    const element = document.querySelector(`[data-section="${CSS.escape(name)}"]`);
    if (element) window.scrollTo({ top: element.getBoundingClientRect().top + window.scrollY - 130, behavior: "smooth" });
  };
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: store.nombre, text: `Mirá ${store.nombre} en Woref`, url });
      else { await navigator.clipboard.writeText(url); toast.success("Copiamos el link del local"); }
    } catch { /* la persona cerró el menú de compartir */ }
  };
  const copyCoupon = async (code: string) => {
    try { await navigator.clipboard.writeText(code); toast.success(`Copiaste ${code}. Pegalo en el carrito.`); } catch { toast.info(`Tu código es ${code}`); }
  };

  return (
    <div className="mx-auto max-w-5xl pb-20 sm:px-6 sm:pt-6">
      {/* Portada */}
      <div className="relative h-48 w-full overflow-hidden bg-muted sm:h-72 sm:rounded-3xl">
        <img src={img(store.imagen_url, 1400)} alt="" className={cn("h-full w-full object-cover", !open && "grayscale")} />
        <div className="absolute inset-0 bg-gradient-to-b from-black/35 via-transparent to-black/10" />
        <div className="absolute inset-x-3 top-3 flex items-center gap-2">
          <button type="button" aria-label="Volver" onClick={() => navigate(-1)} className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"><ArrowLeft className="h-5 w-5" /></button>
          <span className="flex-1" />
          <button type="button" aria-label="Compartir" onClick={share} className="flex h-10 w-10 items-center justify-center rounded-full bg-card shadow-soft"><Share2 className="h-[18px] w-[18px]" /></button>
          <FavoriteButton storeId={store.id} className="h-10 w-10" />
        </div>
      </div>

      {/* Ficha del local */}
      <div className="relative -mt-6 rounded-t-3xl bg-card px-4 pb-2 pt-1 sm:mt-4 sm:rounded-3xl sm:border sm:px-6 sm:pb-5">
        <div className="flex items-end gap-3">
          <StoreLogo store={store} className="-mt-10 h-20 w-20 border-4 border-card text-2xl shadow-pop sm:-mt-12 sm:h-24 sm:w-24" />
          <button type="button" onClick={() => setInfoOpen(true)} className="mb-1 ml-auto flex items-center gap-1 rounded-full border px-3 py-1.5 text-[13px] font-bold hover:bg-muted"><Info className="h-4 w-4" />Info del local</button>
        </div>
        <h1 className="mt-3 text-2xl font-black leading-tight sm:text-3xl">{store.nombre}</h1>
        <p className="mt-0.5 text-sm font-semibold text-muted-foreground">{[store.rubro, reach.km != null ? `a ${formatKm(reach.km)}` : null, store.direccion.split(",")[0]].filter(Boolean).join(" · ")}</p>

        <button type="button" onClick={() => (reviews.length ? setReviewsOpen(true) : undefined)} className="mt-2 flex items-center gap-1.5 text-sm font-bold">
          <RatingBadge store={store} />
          {store.total_resenas > 0 && <span className="text-muted-foreground">{store.total_resenas.toLocaleString("es-AR")} calificaciones</span>}
          {reviews.length > 0 && <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>

        <div className="mt-4 grid grid-cols-3 divide-x rounded-2xl border text-center">
          <div className="px-2 py-2.5"><p className="flex items-center justify-center gap-1 text-sm font-extrabold"><Clock3 className="h-4 w-4 text-muted-foreground" />{store.tiempo_min}-{store.tiempo_max} min</p><p className="text-[11px] font-semibold text-muted-foreground">Tiempo de entrega</p></div>
          <div className="px-2 py-2.5"><p className={cn("flex items-center justify-center gap-1 text-sm font-extrabold", fee === "Envío gratis" && "text-success")}><Bike className="h-4 w-4 text-muted-foreground" />{fee.replace("Envío ", "")}</p><p className="text-[11px] font-semibold text-muted-foreground">Costo de envío</p></div>
          <div className="px-2 py-2.5"><p className="flex items-center justify-center gap-1 text-sm font-extrabold"><ShoppingBag className="h-4 w-4 text-muted-foreground" />{Number(store.pedido_minimo) > 0 ? money(store.pedido_minimo) : "Sin mínimo"}</p><p className="text-[11px] font-semibold text-muted-foreground">Pedido mínimo</p></div>
        </div>

        {!open && <p className="mt-3 rounded-2xl bg-muted p-3 text-sm"><span className="font-extrabold">Cerrado ahora.</span> {store.esta_abierto ? nextOpening(store.horarios) || "" : "El local pausó los pedidos por un rato."} Podés ver el menú igual.</p>}
        {open && reach.zoneClosed && <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"><span className="font-extrabold">Por ahora no entregamos en tu zona.</span> Probá más tarde o elegí otra dirección.</p>}
        {open && !reach.inZone && !reach.zoneClosed && <p className="mt-3 rounded-2xl bg-destructive/10 p-3 text-sm text-destructive"><span className="font-extrabold">No llega a tu dirección.</span> Está a {formatKm(reach.km || 0)} y entrega hasta {formatKm(Number(store.radio_entrega_km))}.</p>}

        {(store.promo_texto || coupons.length > 0 || (store.envio_gratis_desde && Number(store.envio_gratis_desde) > 1)) && (
          <div className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
            {store.promo_texto && <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-primary/10 px-3 py-2.5 text-sm font-extrabold text-primary"><Ticket className="h-4 w-4" />{store.promo_texto}</div>}
            {store.envio_gratis_desde && Number(store.envio_gratis_desde) > 1 && <div className="flex shrink-0 items-center gap-2 rounded-2xl bg-success/10 px-3 py-2.5 text-sm font-extrabold text-success"><Bike className="h-4 w-4" />Envío gratis desde {money(store.envio_gratis_desde)}</div>}
            {coupons.map((coupon) => (
              <button key={coupon.id} type="button" onClick={() => copyCoupon(coupon.codigo)} className="flex shrink-0 items-center gap-2 rounded-2xl border border-dashed border-primary px-3 py-2 text-left">
                <span><span className="block text-sm font-black text-primary">{couponValue(coupon)}</span><span className="block text-[11px] font-semibold text-muted-foreground">Código {coupon.codigo}{Number(coupon.minimo) > 0 && ` · mín. ${money(coupon.minimo)}`}</span></span>
                <Copy className="h-4 w-4 text-primary" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Pestañas del menú */}
      <div className="sticky top-16 z-30 border-b bg-card/95 backdrop-blur sm:mt-4 sm:rounded-2xl sm:border">
        {searching ? (
          <label className="flex h-14 items-center gap-2 px-4">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder={`Buscar en ${store.nombre}`} className="min-w-0 flex-1 bg-transparent text-[15px] font-semibold outline-none" />
            <button type="button" aria-label="Cerrar búsqueda" onClick={() => { setSearching(false); setTerm(""); }}><X className="h-5 w-5" /></button>
          </label>
        ) : (
          <div className="flex items-center">
            <button type="button" aria-label="Buscar en el menú" onClick={() => setSearching(true)} className="flex h-14 w-12 shrink-0 items-center justify-center border-r"><Search className="h-5 w-5" /></button>
            <div ref={tabsRef} className="scrollbar-none flex flex-1 gap-1 overflow-x-auto px-2">
              {sections.map((section) => (
                <button key={section.name} data-tab={section.name} type="button" onClick={() => scrollTo(section.name)} className={cn("relative h-14 shrink-0 px-3 text-sm font-extrabold transition-colors", activeSection === section.name ? "text-foreground" : "text-muted-foreground hover:text-foreground")}>
                  {section.name}
                  {activeSection === section.name && <span className="absolute inset-x-3 bottom-0 h-[3px] rounded-full bg-primary" />}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="px-4 sm:px-0">
        {!term && featured.length >= 2 && (
          <section className="pt-6">
            <h2 className="text-lg font-black">Los más pedidos</h2>
            <div className="scrollbar-none -mx-4 mt-3 flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 sm:mx-0 sm:scroll-px-0 sm:px-0">
              {featured.map((product) => <ProductCard key={`tile-${product.id}`} product={product} store={cartStore} disabled={!open || !reach.inZone} variant="tile" />)}
            </div>
          </section>
        )}

        {sections.map((section) => (
          <section key={section.name} data-section={section.name} className="pt-6">
            <h2 className="text-lg font-black">{section.name}</h2>
            <div className="sm:grid sm:grid-cols-2 sm:gap-x-8">
              {section.items.map((product) => <ProductCard key={product.id} product={product} store={cartStore} disabled={!open || !reach.inZone} />)}
            </div>
          </section>
        ))}
        {products.length > 0 && filtered.length === 0 && <EmptyState className="mt-6" title="No encontramos ese producto" text="Probá con otra palabra." />}
        {products.length === 0 && <EmptyState className="mt-6" title="Este local todavía no cargó su menú" />}
      </div>

      <Dialog open={reviewsOpen} onOpenChange={setReviewsOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogHeader><DialogTitle className="text-xl font-black">Opiniones de {store.nombre}</DialogTitle></DialogHeader>
          <div className="flex items-center gap-3 rounded-2xl bg-muted p-3"><span className="text-4xl font-black">{Number(store.rating).toFixed(1)}</span><div><span className="flex">{[1, 2, 3, 4, 5].map((value) => <Star key={value} className={cn("h-4 w-4", value <= Math.round(store.rating) ? "fill-warning text-warning" : "text-muted-foreground/30")} />)}</span><p className="text-xs font-semibold text-muted-foreground">{store.total_resenas.toLocaleString("es-AR")} calificaciones</p></div></div>
          <ul className="divide-y">
            {reviews.map((review) => (
              <li key={review.id} className="py-3">
                <div className="flex items-center justify-between gap-2"><p className="font-extrabold">{review.cliente?.nombre?.split(" ")[0] || "Cliente"}</p><span className="flex">{[1, 2, 3, 4, 5].map((value) => <Star key={value} className={cn("h-3.5 w-3.5", value <= review.puntaje ? "fill-warning text-warning" : "text-muted-foreground/30")} />)}</span></div>
                <p className="text-xs text-muted-foreground">{formatDateTime(review.created_at)}</p>
                {review.comentario && <p className="mt-1 text-sm">{review.comentario}</p>}
                {review.respuesta && <p className="mt-2 rounded-xl bg-muted p-2.5 text-sm"><span className="font-bold">Respuesta del local: </span>{review.respuesta}</p>}
              </li>
            ))}
          </ul>
        </DialogContent>
      </Dialog>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle className="text-xl font-black">{store.nombre}</DialogTitle></DialogHeader>
          {store.descripcion && <p className="text-sm text-muted-foreground">{store.descripcion}</p>}
          <dl className="space-y-4 text-sm">
            <div className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 text-primary" /><div><dt className="font-bold">Dirección</dt><dd className="text-muted-foreground">{store.direccion}</dd></div></div>
            <div className="flex gap-3"><Clock3 className="h-5 w-5 shrink-0 text-primary" /><div><dt className="font-bold">Horarios</dt><dd className="text-muted-foreground">{scheduleSummary(store.horarios) || store.horario}</dd></div></div>
            <div className="flex gap-3"><Bike className="h-5 w-5 shrink-0 text-primary" /><div><dt className="font-bold">Entrega</dt><dd className="text-muted-foreground">Hasta {formatKm(Number(store.radio_entrega_km ?? 6))} · {fee} · {store.tiempo_min}-{store.tiempo_max} min</dd></div></div>
            {store.telefono && <div className="flex gap-3"><Phone className="h-5 w-5 shrink-0 text-primary" /><div><dt className="font-bold">Teléfono</dt><dd><a href={`tel:${store.telefono.replace(/\s/g, "")}`} className="font-semibold text-primary">{store.telefono}</a></dd></div></div>}
          </dl>
        </DialogContent>
      </Dialog>
    </div>
  );
}
