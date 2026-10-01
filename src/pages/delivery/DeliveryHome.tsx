import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Building2, ChevronRight, Cross, MapPin, Search, ShoppingBasket, Store as StoreIcon, Utensils } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { StoreCard, DeliveryStore } from "@/components/delivery/StoreCard";
import { Button } from "@/components/ui/button";

const categories = [
  { id: "comida", label: "Restaurantes", note: "Hasta 50% OFF", icon: Utensils, tone: "bg-category-food text-category-food-foreground" },
  { id: "supermercado", label: "Supermercados", note: "Envíos rápidos", icon: ShoppingBasket, tone: "bg-category-market text-category-market-foreground" },
  { id: "farmacia", label: "Farmacias", note: "Abiertas 24 h", icon: Cross, tone: "bg-category-pharmacy text-category-pharmacy-foreground" },
  { id: "tiendas", label: "Tiendas", note: "Todo lo que buscás", icon: StoreIcon, tone: "bg-category-store text-category-store-foreground" },
];

export default function DeliveryHome() {
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchParams] = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("categoria") || "todos");
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("delivery_comercios").select("*").order("destacado", { ascending: false }).order("rating", { ascending: false });
      setStores((data || []) as DeliveryStore[]);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => stores.filter((store) => {
    const categoryMatch = category === "todos" || store.categoria === category;
    const term = query.trim().toLowerCase();
    return categoryMatch && (!term || `${store.nombre} ${store.descripcion || ""} ${store.categoria}`.toLowerCase().includes(term));
  }), [stores, category, query]);

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-12 pt-5 sm:px-6 lg:px-8">
      <section className="grid gap-5 lg:grid-cols-[1.5fr_0.8fr]">
        <div className="flex min-h-[260px] flex-col justify-end overflow-hidden rounded-lg bg-brand-deep p-6 text-primary-foreground sm:p-9">
          <span className="mb-auto flex w-fit items-center gap-1.5 rounded-md bg-primary-foreground/10 px-2.5 py-1 text-xs font-bold"><MapPin className="h-3.5 w-3.5" /> Entregamos en CABA</span>
          <h1 className="max-w-2xl text-3xl font-extrabold sm:text-5xl">Lo que necesitás, llega hoy.</h1>
          <p className="mt-3 max-w-xl text-sm text-primary-foreground/75 sm:text-base">Comida, supermercado, farmacia y tiendas cerca tuyo.</p>
          <label className="mt-6 flex max-w-xl items-center gap-3 rounded-md bg-card px-4 text-foreground shadow-pop">
            <Search className="h-5 w-5 text-muted-foreground" />
            <input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="¿Qué querés pedir?" className="h-14 min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          </label>
        </div>
        <div className="relative min-h-[220px] overflow-hidden rounded-lg bg-primary p-6 text-primary-foreground sm:p-8">
          <p className="text-xs font-bold uppercase">Woref+</p>
          <h2 className="mt-3 max-w-xs text-3xl font-extrabold">Envíos bonificados todo el mes</h2>
          <p className="mt-3 max-w-xs text-sm text-primary-foreground/80">Probalo gratis durante 30 días.</p>
          <Button variant="secondary" className="mt-6" onClick={() => navigate("/lin/pedidos")}>Conocer más <ChevronRight className="h-4 w-4" /></Button>
          <Building2 className="absolute -bottom-8 -right-5 h-40 w-40 text-primary-foreground/10" />
        </div>
      </section>

      <section className="py-8">
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          {categories.map(({ id, label, note, icon: Icon, tone }) => (
            <button key={id} type="button" onClick={() => setCategory(category === id ? "todos" : id)} className={`min-h-[128px] rounded-lg border p-4 text-left transition-transform hover:-translate-y-0.5 ${tone} ${category === id ? "ring-2 ring-primary ring-offset-2" : ""}`}>
              <Icon className="h-7 w-7" />
              <span className="mt-5 block font-bold">{label}</span>
              <span className="mt-1 block text-xs opacity-70">{note}</span>
            </button>
          ))}
        </div>
      </section>

      <section>
        <div className="mb-5 flex items-end justify-between gap-4">
          <div><p className="text-xs font-bold uppercase text-primary">Cerca tuyo</p><h2 className="mt-1 text-2xl font-extrabold sm:text-3xl">Comercios para pedir ahora</h2></div>
          {category !== "todos" && <Button variant="ghost" size="sm" onClick={() => setCategory("todos")}>Ver todos</Button>}
        </div>
        {loading ? <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"><div className="h-64 animate-pulse rounded-lg bg-muted" /><div className="h-64 animate-pulse rounded-lg bg-muted" /><div className="h-64 animate-pulse rounded-lg bg-muted" /></div> : filtered.length ? (
          <div className="grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3">{filtered.map((store) => <StoreCard key={store.id} store={store} />)}</div>
        ) : <div className="rounded-lg border bg-card p-10 text-center"><p className="font-bold">No encontramos comercios</p><p className="mt-1 text-sm text-muted-foreground">Probá otra búsqueda o categoría.</p></div>}
      </section>
    </div>
  );
}