import { useEffect, useMemo, useState } from "react";
import { Navigate, useParams } from "react-router-dom";
import { Store } from "lucide-react";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { StoreCard, StoreCardSkeleton } from "@/components/delivery/StoreCard";
import { db, DeliveryStore, matchesVertical, verticals } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Sort = "recomendados" | "rating" | "rapido" | "envio";
const sorts: { id: Sort; label: string }[] = [
  { id: "recomendados", label: "Recomendados" },
  { id: "rating", label: "Mejor puntuados" },
  { id: "rapido", label: "Más rápidos" },
  { id: "envio", label: "Menor costo de envío" },
];

export default function Category() {
  const { id } = useParams();
  const vertical = verticals.find((item) => item.id === id);
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("recomendados");
  const [rubro, setRubro] = useState<string | null>(null);

  useEffect(() => {
    if (!vertical) return;
    setLoading(true);
    setRubro(null);
    let query = db.from("delivery_comercios").select("*").eq("activo", true);
    if (vertical.categoria) query = query.eq("categoria", vertical.categoria);
    if (vertical.rubro) query = query.eq("rubro", vertical.rubro);
    query.order("destacado", { ascending: false }).then(({ data }: { data: DeliveryStore[] | null }) => {
      setStores((data || []).filter((store) => matchesVertical(store, vertical)));
      setLoading(false);
    });
  }, [vertical]);

  const rubros = useMemo(() => [...new Set(stores.map((store) => store.rubro).filter(Boolean))] as string[], [stores]);
  const list = useMemo(() => {
    const filtered = stores.filter((store) => !rubro || store.rubro === rubro);
    const sorted = [...filtered];
    if (sort === "rating") sorted.sort((a, b) => b.rating - a.rating);
    if (sort === "rapido") sorted.sort((a, b) => a.tiempo_max - b.tiempo_max);
    if (sort === "envio") sorted.sort((a, b) => a.costo_envio - b.costo_envio);
    return sorted.sort((a, b) => Number(b.esta_abierto) - Number(a.esta_abierto));
  }, [stores, sort, rubro]);

  if (!vertical) return <Navigate to="/app" replace />;
  const Icon = vertical.icon;

  return (
    <div className="mx-auto max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8">
      <PageHeader back="/app" title={vertical.label} subtitle={`${list.length} ${list.length === 1 ? "comercio" : "comercios"} cerca tuyo`} actions={<span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl", vertical.color)}><Icon className="h-7 w-7" /></span>} />

      <div className="scrollbar-none -mx-4 mt-6 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
        {sorts.map((item) => (
          <button key={item.id} type="button" onClick={() => setSort(item.id)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-bold", sort === item.id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{item.label}</button>
        ))}
        {rubros.length > 1 && rubros.map((item) => (
          <button key={item} type="button" onClick={() => setRubro(rubro === item ? null : item)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-bold", rubro === item ? "border-primary bg-primary/10 text-primary" : "bg-card hover:bg-muted")}>{item}</button>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {loading ? [0, 1, 2, 3].map((key) => <StoreCardSkeleton key={key} />) : list.map((store) => <StoreCard key={store.id} store={store} />)}
      </div>
      {!loading && list.length === 0 && <EmptyState icon={<Store className="h-7 w-7" />} title="Todavía no hay comercios en esta categoría" text="Estamos sumando nuevos comercios todas las semanas." />}
    </div>
  );
}
