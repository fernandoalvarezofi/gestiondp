import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Bike, Clock3, Info, MapPin, Search, Star, Store as StoreIcon, Tag } from "lucide-react";
import { EmptyState } from "@/components/delivery/Common";
import { FavoriteButton } from "@/components/delivery/FavoriteButton";
import { ProductCard } from "@/components/delivery/ProductCard";
import { deliveryFeeLabel, RatingBadge, StoreLogo } from "@/components/delivery/StoreCard";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { CartStore } from "@/contexts/CartContext";
import { db, DeliveryProduct, DeliveryStore, formatDateTime, img, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Review = { id: string; puntaje: number; comentario?: string | null; respuesta?: string | null; created_at: string; cliente?: { nombre: string } | null };

export default function StoreDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const [store, setStore] = useState<DeliveryStore | null>(null);
  const [products, setProducts] = useState<DeliveryProduct[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [notFound, setNotFound] = useState(false);
  const [term, setTerm] = useState("");
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data: found } = await db.from("delivery_comercios").select("*").eq("slug", slug).maybeSingle();
      if (!found) { setNotFound(true); return; }
      setStore(found);
      const [{ data: catalog }, { data: opinions }] = await Promise.all([
        db.from("delivery_productos").select("*").eq("comercio_id", found.id).order("destacado", { ascending: false }).order("nombre"),
        db.from("delivery_resenas").select("id,puntaje,comentario,respuesta,created_at,cliente:perfiles(nombre)").eq("comercio_id", found.id).order("created_at", { ascending: false }).limit(20),
      ]);
      setProducts(catalog || []);
      setReviews(opinions || []);
    })();
  }, [slug]);

  const filtered = useMemo(() => {
    const value = term.trim().toLowerCase();
    return value ? products.filter((product) => `${product.nombre} ${product.descripcion || ""}`.toLowerCase().includes(value)) : products;
  }, [products, term]);

  const sections = useMemo(() => {
    const featured = filtered.filter((product) => product.destacado);
    const groups = [...new Set(filtered.map((product) => product.categoria))].map((name) => ({ name, items: filtered.filter((product) => product.categoria === name) }));
    return featured.length >= 2 && !term ? [{ name: "Destacados", items: featured }, ...groups] : groups;
  }, [filtered, term]);

  if (notFound) return <div className="mx-auto max-w-3xl px-4 py-16"><EmptyState icon={<StoreIcon className="h-7 w-7" />} title="No encontramos este comercio" text="Puede que ya no esté disponible." /></div>;
  if (!store) return <div className="mx-auto max-w-6xl px-4 py-6"><div className="aspect-[16/6] animate-pulse rounded-3xl bg-muted" /><div className="mt-6 h-8 w-1/3 animate-pulse rounded bg-muted" /></div>;

  const cartStore: CartStore = { id: store.id, nombre: store.nombre, slug: store.slug, costo_envio: store.costo_envio, pedido_minimo: store.pedido_minimo, envio_gratis_desde: store.envio_gratis_desde, imagen_url: store.imagen_url };
  const scrollTo = (name: string) => {
    setActiveSection(name);
    document.getElementById(`sec-${name}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto max-w-6xl pb-16 sm:px-6 sm:pt-5">
      <div className="relative aspect-[16/8] max-h-[340px] w-full overflow-hidden bg-muted sm:aspect-[16/6] sm:rounded-3xl">
        <img src={img(store.imagen_url, 1400)} alt={store.nombre} className="h-full w-full object-cover" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent" />
        <button type="button" aria-label="Volver" onClick={() => navigate(-1)} className="absolute left-4 top-4 flex h-10 w-10 items-center justify-center rounded-full bg-card/95 shadow-soft"><ArrowLeft className="h-5 w-5" /></button>
        <FavoriteButton storeId={store.id} className="absolute right-4 top-4 h-10 w-10" />
      </div>

      <div className="relative px-4 sm:px-0">
        <StoreLogo store={store} className="-mt-10 h-20 w-20 border-4 text-xl shadow-pop sm:-mt-12 sm:ml-6 sm:h-24 sm:w-24" />
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-xs font-bold uppercase tracking-wide text-primary">{store.rubro || store.categoria}</p>
            <h1 className="text-3xl font-extrabold sm:text-4xl">{store.nombre}</h1>
            {store.descripcion && <p className="mt-1 text-muted-foreground">{store.descripcion}</p>}
          </div>
          <StoreInfoDialog store={store} />
        </div>

        <div className="mt-4 grid grid-cols-3 divide-x rounded-2xl border bg-card py-3 text-center">
          <div><RatingBadge store={store} className="justify-center" /><p className="mt-0.5 text-[11px] text-muted-foreground">{store.total_resenas ? `${store.total_resenas.toLocaleString("es-AR")} opiniones` : "Sin opiniones"}</p></div>
          <div><p className="flex items-center justify-center gap-1 text-sm font-bold"><Clock3 className="h-3.5 w-3.5" />{store.tiempo_min}-{store.tiempo_max}′</p><p className="mt-0.5 text-[11px] text-muted-foreground">Entrega</p></div>
          <div><p className="flex items-center justify-center gap-1 text-sm font-bold"><Bike className="h-3.5 w-3.5" />{deliveryFeeLabel(store)}</p><p className="mt-0.5 text-[11px] text-muted-foreground">Envío</p></div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          {store.promo_texto && <span className="flex items-center gap-1.5 rounded-full bg-primary/10 px-3 py-1.5 text-xs font-bold text-primary"><Tag className="h-3.5 w-3.5" />{store.promo_texto}</span>}
          {store.envio_gratis_desde && Number(store.envio_gratis_desde) > 1 && <span className="rounded-full bg-success/10 px-3 py-1.5 text-xs font-bold text-success">Envío gratis desde {money(store.envio_gratis_desde)}</span>}
          {Number(store.pedido_minimo) > 0 && <span className="rounded-full bg-muted px-3 py-1.5 text-xs font-bold text-muted-foreground">Pedido mínimo {money(store.pedido_minimo)}</span>}
        </div>

        {!store.esta_abierto && <div className="mt-4 rounded-2xl border border-warning/40 bg-warning/10 p-4 text-sm font-semibold">Este comercio está cerrado ahora. Podés mirar el menú y pedir cuando abra ({store.horario}).</div>}

        <div className="sticky top-16 z-30 -mx-4 mt-6 border-b bg-background/95 px-4 pb-3 pt-3 backdrop-blur sm:mx-0 sm:px-0">
          <label className="flex h-11 items-center gap-2 rounded-full bg-muted px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input value={term} onChange={(event) => setTerm(event.target.value)} placeholder={`Buscar en ${store.nombre}`} className="min-w-0 flex-1 bg-transparent text-sm outline-none" />
          </label>
          <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto">
            {sections.map((section) => (
              <button key={section.name} type="button" onClick={() => scrollTo(section.name)} className={cn("shrink-0 rounded-full px-3.5 py-1.5 text-sm font-bold", activeSection === section.name ? "bg-foreground text-background" : "bg-muted text-muted-foreground hover:text-foreground")}>{section.name}</button>
            ))}
            {reviews.length > 0 && <button type="button" onClick={() => scrollTo("opiniones")} className="shrink-0 rounded-full bg-muted px-3.5 py-1.5 text-sm font-bold text-muted-foreground hover:text-foreground">Opiniones</button>}
          </div>
        </div>

        {sections.map((section) => (
          <section key={section.name} id={`sec-${section.name}`} className="scroll-mt-44 pt-7">
            <h2 className="mb-3 text-xl font-extrabold">{section.name}</h2>
            <div className="grid gap-3 md:grid-cols-2">
              {section.items.map((product) => <ProductCard key={`${section.name}-${product.id}`} product={product} store={cartStore} disabled={!store.esta_abierto} />)}
            </div>
          </section>
        ))}
        {products.length > 0 && filtered.length === 0 && <EmptyState className="mt-6" title="No encontramos ese producto" text="Probá con otra palabra." />}
        {products.length === 0 && <EmptyState className="mt-6" title="Este comercio todavía no cargó productos" />}

        {reviews.length > 0 && (
          <section id="sec-opiniones" className="scroll-mt-44 pt-10">
            <h2 className="text-xl font-extrabold">Opiniones</h2>
            <div className="mt-3 grid gap-3 md:grid-cols-2">
              {reviews.map((review) => (
                <article key={review.id} className="rounded-2xl border bg-card p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="font-bold">{review.cliente?.nombre?.split(" ")[0] || "Cliente"}</p>
                    <span className="flex gap-0.5">{[1, 2, 3, 4, 5].map((value) => <Star key={value} className={cn("h-4 w-4", value <= review.puntaje ? "fill-warning text-warning" : "text-muted")} />)}</span>
                  </div>
                  {review.comentario && <p className="mt-2 text-sm">{review.comentario}</p>}
                  {review.respuesta && <p className="mt-3 rounded-xl bg-muted p-3 text-sm"><span className="font-bold">Respuesta del comercio: </span>{review.respuesta}</p>}
                  <p className="mt-2 text-xs text-muted-foreground">{formatDateTime(review.created_at)}</p>
                </article>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

function StoreInfoDialog({ store }: { store: DeliveryStore }) {
  return (
    <Dialog>
      <DialogTrigger asChild>
        <button type="button" className="flex items-center gap-1.5 rounded-full border px-3 py-2 text-sm font-bold hover:bg-muted"><Info className="h-4 w-4" />Info</button>
      </DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader><DialogTitle className="text-xl font-extrabold">{store.nombre}</DialogTitle></DialogHeader>
        <dl className="space-y-4 text-sm">
          <div className="flex gap-3"><MapPin className="h-5 w-5 shrink-0 text-primary" /><div><dt className="font-bold">Dirección</dt><dd className="text-muted-foreground">{store.direccion}</dd></div></div>
          <div className="flex gap-3"><Clock3 className="h-5 w-5 shrink-0 text-primary" /><div><dt className="font-bold">Horario</dt><dd className="text-muted-foreground">{store.horario}</dd></div></div>
          <div className="flex gap-3"><Bike className="h-5 w-5 shrink-0 text-primary" /><div><dt className="font-bold">Envío</dt><dd className="text-muted-foreground">{deliveryFeeLabel(store)} · {store.tiempo_min}-{store.tiempo_max} min · Pedido mínimo {money(store.pedido_minimo)}</dd></div></div>
          {store.telefono && <div className="flex gap-3"><Info className="h-5 w-5 shrink-0 text-primary" /><div><dt className="font-bold">Teléfono</dt><dd className="text-muted-foreground">{store.telefono}</dd></div></div>}
        </dl>
      </DialogContent>
    </Dialog>
  );
}
