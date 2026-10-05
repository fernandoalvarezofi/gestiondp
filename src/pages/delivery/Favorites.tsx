import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { StoreCard, StoreCardSkeleton } from "@/components/delivery/StoreCard";
import { Button } from "@/components/ui/button";
import { useFavorites } from "@/contexts/FavoritesContext";
import { COMERCIO_COLS, db, DeliveryStore } from "@/lib/delivery";

export default function Favorites() {
  const { ids } = useFavorites();
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [loading, setLoading] = useState(true);
  const key = [...ids].sort().join(",");

  useEffect(() => {
    const list = key ? key.split(",") : [];
    if (!list.length) { setStores([]); setLoading(false); return; }
    db.from("delivery_comercios").select(COMERCIO_COLS).in("id", list).then(({ data }: { data: DeliveryStore[] | null }) => {
      setStores(data || []);
      setLoading(false);
    });
  }, [key]);

  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8">
      <PageHeader eyebrow="Guardados" title="Tus favoritos" subtitle="Los comercios que marcaste con ♥ para pedir rápido." />
      {loading ? (
        <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{[0, 1, 2].map((item) => <StoreCardSkeleton key={item} />)}</div>
      ) : stores.length ? (
        <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{stores.map((store) => <StoreCard key={store.id} store={store} />)}</div>
      ) : (
        <EmptyState className="mt-6" icon={<Heart className="h-7 w-7" />} title="Todavía no tenés favoritos" text="Tocá el corazón de un comercio para guardarlo acá." action={<Button asChild className="rounded-full"><Link to="/app">Descubrir comercios</Link></Button>} />
      )}
    </div>
  );
}
