import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Search as SearchIcon, X } from "lucide-react";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { StoreCard, StoreCardSkeleton } from "@/components/delivery/StoreCard";
import { db, DeliveryProduct, DeliveryStore, img, money, verticals } from "@/lib/delivery";

type ProductHit = DeliveryProduct & { comercio: Pick<DeliveryStore, "nombre" | "slug" | "esta_abierto"> };
const suggestions = ["Hamburguesa", "Pizza", "Sushi", "Helado", "Café", "Ensalada", "Cerveza", "Vitaminas"];

export default function Search() {
  const [params, setParams] = useSearchParams();
  const [term, setTerm] = useState(params.get("q") || "");
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [products, setProducts] = useState<ProductHit[]>([]);
  const [loading, setLoading] = useState(false);
  const query = term.trim();

  useEffect(() => {
    if (query.length < 2) { setStores([]); setProducts([]); return; }
    setLoading(true);
    const timer = window.setTimeout(async () => {
      const like = `%${query.replace(/[%_,()]/g, " ")}%`;
      const [storeResult, productResult] = await Promise.all([
        db.from("delivery_comercios").select("*").eq("activo", true).or(`nombre.ilike.${like},descripcion.ilike.${like},rubro.ilike.${like}`).limit(24),
        db.from("delivery_productos").select("*, comercio:delivery_comercios!inner(nombre,slug,esta_abierto,activo)").eq("disponible", true).eq("comercio.activo", true).or(`nombre.ilike.${like},descripcion.ilike.${like},categoria.ilike.${like}`).limit(30),
      ]);
      setStores(storeResult.data || []);
      setProducts(productResult.data || []);
      setLoading(false);
      setParams(query ? { q: query } : {}, { replace: true });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [query, setParams]);

  const productsByStore = useMemo(() => products.slice(0, 18), [products]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8">
      <label className="flex h-14 items-center gap-3 rounded-full border-2 border-transparent bg-muted px-5 focus-within:border-primary focus-within:bg-card">
        <SearchIcon className="h-5 w-5 text-muted-foreground" />
        <input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} placeholder="Buscá comercios, platos o productos" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
        {term && <button type="button" aria-label="Borrar búsqueda" onClick={() => setTerm("")}><X className="h-5 w-5 text-muted-foreground" /></button>}
      </label>

      {query.length < 2 ? (
        <>
          <h2 className="mt-8 text-lg font-extrabold">Búsquedas populares</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {suggestions.map((item) => <button key={item} type="button" onClick={() => setTerm(item)} className="rounded-full border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">{item}</button>)}
          </div>
          <h2 className="mt-8 text-lg font-extrabold">Explorá por categoría</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {verticals.map(({ id, label, icon: Icon, color }) => (
              <Link key={id} to={`/app/categoria/${id}`} className={`flex h-24 items-end justify-between rounded-2xl p-4 font-bold transition-transform hover:-translate-y-0.5 ${color}`}>
                {label}<Icon className="h-8 w-8 opacity-80" />
              </Link>
            ))}
          </div>
        </>
      ) : (
        <>
          {productsByStore.length > 0 && (
            <section className="mt-8">
              <h2 className="text-lg font-extrabold">Productos</h2>
              <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {productsByStore.map((product) => (
                  <Link key={product.id} to={`/app/tienda/${product.comercio.slug}`} className="flex items-center gap-3 rounded-2xl border bg-card p-3 hover:shadow-soft">
                    <img src={img(product.imagen_url, 200)} alt="" loading="lazy" className="h-16 w-16 shrink-0 rounded-xl object-cover" />
                    <span className="min-w-0">
                      <span className="block truncate font-bold">{product.nombre}</span>
                      <span className="block truncate text-sm text-muted-foreground">{product.comercio.nombre}</span>
                      <span className="block font-display text-sm font-extrabold">{money(product.precio)}</span>
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
          <section className="mt-8">
            <h2 className="text-lg font-extrabold">Comercios</h2>
            <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {loading && stores.length === 0 ? [0, 1, 2].map((key) => <StoreCardSkeleton key={key} />) : stores.map((store) => <StoreCard key={store.id} store={store} />)}
            </div>
          </section>
          {!loading && stores.length === 0 && productsByStore.length === 0 && (
            <EmptyState className="mt-6" icon={<SearchIcon className="h-7 w-7" />} title={`No encontramos resultados para “${query}”`} text="Revisá cómo lo escribiste o probá con algo más general." action={<Button asChild variant="outline" className="rounded-full"><Link to="/app/directorio">Ver comercios que todavía no están</Link></Button>} />
          )}
        </>
      )}
    </div>
  );
}
