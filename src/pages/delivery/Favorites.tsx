import { CSSProperties, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { ProductCard } from "@/components/delivery/ProductCard";
import { StoreCard, StoreCardSkeleton } from "@/components/delivery/StoreCard";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/contexts/FavoritesContext";
import { useProductFavorites } from "@/hooks/useProductFavorites";
import { COMERCIO_COLS, db, DeliveryStore, isOpenNow } from "@/lib/delivery";
import { cartStoreDe, fetchProductosConComercio, ProductoConComercio } from "@/services/catalog";

const TEMA_APP = { "--sf-accent": "hsl(var(--primary))", "--sf-on-accent": "hsl(var(--primary-foreground))" } as CSSProperties;

export default function Favorites() {
  const { ids } = useFavorites();
  const productFavs = useProductFavorites();
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [productos, setProductos] = useState<ProductoConComercio[]>([]);
  const [loading, setLoading] = useState(true);
  const key = [...ids].sort().join(",");
  const keyProductos = productFavs.ids.join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!list.length) { setStores([]); setLoading(false); return; }
    db.from("delivery_comercios").select(COMERCIO_COLS).in("id", list).then(({ data }: { data: DeliveryStore[] | null }) => {
      setStores(data || []);
      setLoading(false);
    });
  }, [key]);

  useEffect(() => {
    if (!productFavs.ready) return;
    let alive = true;
    // Los más recientes primero.
    fetchProductosConComercio([...productFavs.ids].reverse()).then((lista) => { if (alive) setProductos(lista); });
    return () => { alive = false; };
  }, [keyProductos, productFavs.ready]); // eslint-disable-line react-hooks/exhaustive-deps

  const vacio = !loading && stores.length === 0 && productos.length === 0 && productFavs.ready;
  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Guardados" title="Tus favoritos" subtitle="Los comercios y productos que marcaste con ♥ para volver rápido." />
      {loading && <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <StoreCardSkeleton key={item} />)}</div>}
      {productos.length > 0 && (
        <section className="mt-6" aria-label="Productos favoritos">
          <h2 className="text-lg font-extrabold">Productos</h2>
          <div style={TEMA_APP} className="mt-4 grid grid-cols-2 gap-x-4 gap-y-8 md:grid-cols-3 xl:grid-cols-4">
            {productos.map(({ product, store }) => (
              <div key={product.id} className="min-w-0">
                <ProductCard product={product} store={cartStoreDe(store)} disabled={!isOpenNow(store)} variant="shop" href={`/t/${store.slug}/p/${product.id}`} />
                <Link to={`/app/tienda/${store.slug}`} className="mt-1 block truncate text-xs font-semibold text-muted-foreground hover:underline">{store.nombre}</Link>
              </div>
            ))}
          </div>
        </section>
      )}
      {stores.length > 0 && (
        <section className="mt-8" aria-label="Comercios favoritos">
          <h2 className="text-lg font-extrabold">Comercios</h2>
          <div className="mt-4 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{stores.map((store) => <StoreCard key={store.id} store={store} />)}</div>
        </section>
      )}
      {vacio && <EmptyState className="mt-6" icon={<Heart className="h-7 w-7" />} title="Todavía no tenés favoritos" text="Tocá el corazón de un comercio o de un producto para guardarlo acá." action={<Button asChild className="rounded-full"><Link to="/app">Descubrir comercios</Link></Button>} />}
    </div>
  );
}
