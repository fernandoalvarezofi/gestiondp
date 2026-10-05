import { CSSProperties, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Loader2, Search as SearchIcon, SlidersHorizontal, X } from "lucide-react";
import { EmptyState } from "@/components/delivery/Common";
import { ProductCard } from "@/components/delivery/ProductCard";
import { StoreCard, StoreCardSkeleton } from "@/components/delivery/StoreCard";
import { SearchFilters } from "@/components/market/SearchFilters";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { CartStore } from "@/contexts/CartContext";
import { useAddressPoint } from "@/hooks/useAddressPoint";
import { COMERCIO_COLS, db, DeliveryProduct, DeliveryStore, isOpenNow, money, productSelect, verticals } from "@/lib/delivery";
import { useCategorias } from "@/services/categories";
import { Facetas, FiltrosBusqueda, filtrosActivos, filtrosAUrl, filtrosDesdeUrl, hayBusqueda, ORDENES, postgresSearch, ResultadoBusqueda } from "@/services/search";

const POPULARES = ["Hamburguesa", "Pizza", "Sushi", "Helado", "Café", "Ensalada", "Cerveza", "Vitaminas"];
const PAGINA = 24;
// El tema de las tarjetas de producto sale de las variables de la tienda; acá se usa el color de Woref.
const TEMA_APP = { "--sf-accent": "hsl(var(--primary))", "--sf-on-accent": "hsl(var(--primary-foreground))" } as CSSProperties;

type Hit = { product: DeliveryProduct; store: DeliveryStore; km: number | null };

const cartStoreDe = (s: DeliveryStore): CartStore => ({ id: s.id, nombre: s.nombre, slug: s.slug, costo_envio: s.costo_envio, pedido_minimo: s.pedido_minimo, envio_gratis_desde: s.envio_gratis_desde, imagen_url: s.imagen_url });

/** Buscador del marketplace: texto tolerante a errores, categorías, marca, precio, ofertas y orden. Los filtros viven en la URL. */
export default function Search() {
  const [params, setParams] = useSearchParams();
  const filtros = useMemo(() => filtrosDesdeUrl(params), [params]);
  const point = useAddressPoint();
  const { arbol } = useCategorias();
  const [term, setTerm] = useState(filtros.q);
  const [hits, setHits] = useState<Hit[]>([]);
  const [total, setTotal] = useState(0);
  const [facetas, setFacetas] = useState<Facetas | null>(null);
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [panel, setPanel] = useState(false);
  const seq = useRef(0);

  const actualizar = useCallback((cambios: Partial<FiltrosBusqueda>) => setParams(filtrosAUrl({ ...filtros, ...cambios }), { replace: true }), [filtros, setParams]);
  const limpiar = () => { setTerm(""); setParams({}, { replace: true }); };

  // El texto escrito pasa a la URL con una pausa corta (así no se busca en cada tecla).
  useEffect(() => {
    if (term.trim() === filtros.q.trim()) return;
    const t = window.setTimeout(() => actualizar({ q: term }), 300);
    return () => window.clearTimeout(t);
  }, [term]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setTerm(filtros.q); }, [filtros.q]);

  const cargarProductos = useCallback(async (res: ResultadoBusqueda): Promise<Hit[]> => {
    if (res.items.length === 0) return [];
    const ids = res.items.map((i) => i.id); const storeIds = [...new Set(res.items.map((i) => i.comercio.id))];
    const [{ data: prods }, { data: coms }] = await Promise.all([
      db.from("delivery_productos").select(productSelect).in("id", ids),
      db.from("delivery_comercios").select(COMERCIO_COLS).in("id", storeIds),
    ]);
    const porId = new Map<string, DeliveryProduct>(((prods ?? []) as DeliveryProduct[]).map((p) => [p.id, p]));
    const porStore = new Map<string, DeliveryStore>(((coms ?? []) as DeliveryStore[]).map((s) => [s.id, s]));
    return res.items.flatMap((i) => { const product = porId.get(i.id); const store = porStore.get(i.comercio.id); return product && store ? [{ product, store, km: i.distancia_km }] : []; });
  }, []);

  const clave = JSON.stringify(filtrosAUrl(filtros)) + (point ? "|p" : "");
  useEffect(() => {
    const mio = ++seq.current;
    if (!hayBusqueda(filtros)) { setHits([]); setTotal(0); setFacetas(null); setStores([]); setLoading(false); setError(false); return; }
    setLoading(true); setError(false);
    (async () => {
      try {
        const [res, fac] = await Promise.all([postgresSearch.buscar(filtros, point, 0, PAGINA), postgresSearch.facetas(filtros)]);
        const lista = await cargarProductos(res);
        if (mio !== seq.current) return;
        setHits(lista); setTotal(res.total); setFacetas(fac);
      } catch { if (mio === seq.current) setError(true); } finally { if (mio === seq.current) setLoading(false); }
      // Comercios: solo por texto (nombre, descripción, rubro).
      if (filtros.q.trim().length >= 2) {
        const like = `%${filtros.q.trim().replace(/[%_,()\\]/g, " ")}%`;
        const { data } = await db.from("delivery_comercios").select(COMERCIO_COLS).eq("activo", true).or(`nombre.ilike.${like},descripcion.ilike.${like},rubro.ilike.${like}`).limit(12);
        if (mio === seq.current) setStores((data ?? []) as DeliveryStore[]);
      } else if (mio === seq.current) setStores([]);
    })();
  }, [clave]); // eslint-disable-line react-hooks/exhaustive-deps

  const verMas = async () => {
    setLoadingMore(true);
    try {
      const res = await postgresSearch.buscar(filtros, point, hits.length, PAGINA);
      const lista = await cargarProductos(res);
      setHits((actual) => [...actual, ...lista.filter((n) => !actual.some((a) => a.product.id === n.product.id))]);
      setTotal(res.total);
    } catch { setError(true); } finally { setLoadingMore(false); }
  };

  const activos = filtrosActivos(filtros);
  const buscando = hayBusqueda(filtros);
  const tituloCat = filtros.categoria ? [...arbol.flatMap((r) => [r, ...r.hijas])].find((c) => c.id === filtros.categoria)?.nombre : null;

  const panelFiltros = <SearchFilters filtros={filtros} facetas={facetas} onChange={actualizar} />;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8">
      <label className="flex h-14 items-center gap-3 rounded-full border-2 border-transparent bg-muted px-5 focus-within:border-primary focus-within:bg-card">
        <SearchIcon className="h-5 w-5 text-muted-foreground" />
        <input autoFocus value={term} onChange={(event) => setTerm(event.target.value)} maxLength={80} placeholder="Buscá comercios, platos o productos" aria-label="Buscar" className="h-full min-w-0 flex-1 bg-transparent text-base outline-none placeholder:text-muted-foreground" />
        {term && <button type="button" aria-label="Borrar búsqueda" onClick={limpiar}><X className="h-5 w-5 text-muted-foreground" /></button>}
      </label>

      {!buscando ? (
        <>
          <h2 className="mt-8 text-lg font-extrabold">Búsquedas populares</h2>
          <div className="mt-3 flex flex-wrap gap-2">
            {POPULARES.map((item) => <button key={item} type="button" onClick={() => setTerm(item)} className="rounded-full border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">{item}</button>)}
          </div>
          {arbol.length > 0 && (
            <>
              <h2 className="mt-8 text-lg font-extrabold">Explorá el Market</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                {arbol.map((raiz) => <button key={raiz.id} type="button" onClick={() => actualizar({ categoria: raiz.id })} className="rounded-full border bg-card px-4 py-2 text-sm font-semibold hover:bg-muted">{raiz.nombre}</button>)}
              </div>
            </>
          )}
          <h2 className="mt-8 text-lg font-extrabold">Explorá por rubro</h2>
          <div className="mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {verticals.map(({ id, label, icon: Icon, color }) => (
              <Link key={id} to={`/app/categoria/${id}`} className={`flex h-24 items-end justify-between rounded-2xl p-4 font-bold transition-transform hover:-translate-y-0.5 ${color}`}>
                {label}<Icon className="h-8 w-8 opacity-80" />
              </Link>
            ))}
          </div>
        </>
      ) : (
        <div className="mt-6 lg:grid lg:grid-cols-[250px_1fr] lg:gap-8">
          <aside className="hidden lg:block" aria-label="Filtros">{panelFiltros}</aside>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-lg font-extrabold">{filtros.q.trim() ? `Resultados para “${filtros.q.trim()}”` : tituloCat ?? "Productos"}</h1>
                <p className="text-sm text-muted-foreground" aria-live="polite">{loading ? "Buscando…" : `${total} ${total === 1 ? "producto" : "productos"}`}</p>
              </div>
              <div className="flex items-center gap-2">
                <Sheet open={panel} onOpenChange={setPanel}>
                  <SheetTrigger asChild><Button variant="outline" className="rounded-full lg:hidden"><SlidersHorizontal className="h-4 w-4" />Filtros{activos > 0 && ` (${activos})`}</Button></SheetTrigger>
                  <SheetContent side="left" className="w-[320px] overflow-y-auto"><SheetHeader><SheetTitle>Filtros</SheetTitle></SheetHeader><div className="mt-4">{panelFiltros}</div></SheetContent>
                </Sheet>
                <select aria-label="Ordenar por" value={filtros.orden} onChange={(e) => actualizar({ orden: e.target.value as FiltrosBusqueda["orden"] })} className="h-10 rounded-full border bg-background px-3 text-sm font-semibold">
                  {ORDENES.filter((o) => o.id !== "cercania" || point).map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
              </div>
            </div>
            {activos > 0 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {filtros.categoria && <Chip onQuitar={() => actualizar({ categoria: null })}>{tituloCat ?? "Categoría"}</Chip>}
                {filtros.marca && <Chip onQuitar={() => actualizar({ marca: null })}>{filtros.marca}</Chip>}
                {(filtros.min != null || filtros.max != null) && <Chip onQuitar={() => actualizar({ min: null, max: null })}>{filtros.min != null ? money(filtros.min) : "Desde $0"} – {filtros.max != null ? money(filtros.max) : "sin tope"}</Chip>}
                {filtros.ofertas && <Chip onQuitar={() => actualizar({ ofertas: false })}>Solo ofertas</Chip>}
                {!filtros.conStock && <Chip onQuitar={() => actualizar({ conStock: true })}>Incluye sin stock</Chip>}
              </div>
            )}

            {error ? (
              <EmptyState className="mt-6" icon={<SearchIcon className="h-7 w-7" />} title="No pudimos buscar ahora" text="Revisá tu conexión e intentá de nuevo." action={<Button className="rounded-full" onClick={() => actualizar({})}>Reintentar</Button>} />
            ) : loading && hits.length === 0 ? (
              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">{Array.from({ length: 8 }, (_, i) => <div key={i} className="aspect-[4/5] animate-pulse rounded-2xl bg-muted" />)}</div>
            ) : hits.length > 0 ? (
              <>
                <div style={TEMA_APP} className="mt-6 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
                  {hits.map(({ product, store, km }) => (
                    <div key={product.id} className="min-w-0">
                      <ProductCard product={product} store={cartStoreDe(store)} disabled={!isOpenNow(store)} variant="shop" href={`/t/${store.slug}/p/${product.id}`} />
                      <Link to={`/app/tienda/${store.slug}`} className="mt-1 block truncate text-xs font-semibold text-muted-foreground hover:underline">{store.nombre}{km != null && ` · a ${km} km`}{!isOpenNow(store) && " · Cerrado"}</Link>
                    </div>
                  ))}
                </div>
                {hits.length < total && <div className="mt-8 flex justify-center"><Button variant="outline" className="rounded-full" onClick={verMas} disabled={loadingMore}>{loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}Ver más productos ({total - hits.length})</Button></div>}
              </>
            ) : (
              <EmptyState className="mt-6" icon={<SearchIcon className="h-7 w-7" />} title={filtros.q.trim() ? `No encontramos productos para “${filtros.q.trim()}”` : "No hay productos con esos filtros"}
                text={activos > 0 ? "Probá quitando algún filtro." : "Revisá cómo lo escribiste o probá con algo más general."}
                action={activos > 0 ? <Button variant="outline" className="rounded-full" onClick={() => actualizar({ categoria: null, marca: null, min: null, max: null, ofertas: false, conStock: true })}>Quitar filtros</Button> : <Button asChild variant="outline" className="rounded-full"><Link to="/app/directorio">Ver comercios que todavía no están</Link></Button>} />
            )}

            {filtros.q.trim().length >= 2 && stores.length > 0 && (
              <section className="mt-10">
                <h2 className="text-lg font-extrabold">Comercios</h2>
                <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 xl:grid-cols-3">
                  {loading ? [0, 1, 2].map((key) => <StoreCardSkeleton key={key} />) : stores.map((store) => <StoreCard key={store.id} store={store} />)}
                </div>
              </section>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function Chip({ children, onQuitar }: { children: React.ReactNode; onQuitar: () => void }) {
  return <span className="inline-flex items-center gap-1 rounded-full bg-muted py-1 pl-3 pr-1.5 text-sm font-semibold">{children}<button type="button" aria-label="Quitar filtro" onClick={onQuitar} className="flex h-5 w-5 items-center justify-center rounded-full hover:bg-background"><X className="h-3.5 w-3.5" /></button></span>;
}
