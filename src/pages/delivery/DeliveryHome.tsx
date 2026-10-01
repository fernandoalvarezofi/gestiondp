import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Bike, ChevronRight, Search } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { StoreCard, StoreCardSkeleton } from "@/components/delivery/StoreCard";
import { StatusBadge } from "@/components/delivery/OrderStatus";
import { EmptyState, Rail } from "@/components/delivery/Common";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { db, DeliveryOrder, DeliveryStore, estadoLabel, img, verticals } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const banners = [
  { title: "30% OFF en tu primer pedido", text: "Usá el código BIENVENIDA", image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=1000&q=80&auto=format&fit=crop", tone: "from-primary/95 via-primary/80", to: "/app/promociones" },
  { title: "Súper en 30 minutos", text: "Frescos, almacén y bebidas", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1000&q=80&auto=format&fit=crop", tone: "from-emerald-700/95 via-emerald-700/75", to: "/app/categoria/super" },
  { title: "Envío gratis desde $8.000", text: "Con el código ENVIOGRATIS", image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&q=80&auto=format&fit=crop", tone: "from-brand-deep/95 via-brand-deep/75", to: "/app/promociones" },
];

type Filter = "todos" | "abiertos" | "gratis" | "rating" | "rapido";
const filters: { id: Filter; label: string }[] = [
  { id: "todos", label: "Todos" },
  { id: "abiertos", label: "Abiertos ahora" },
  { id: "gratis", label: "Envío gratis" },
  { id: "rating", label: "Mejor puntuados" },
  { id: "rapido", label: "Más rápidos" },
];

export default function DeliveryHome() {
  const { user } = useAuth();
  const { nombre } = useDeliveryRoles();
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [activeOrder, setActiveOrder] = useState<DeliveryOrder | null>(null);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>("todos");
  const [banner, setBanner] = useState(0);

  useEffect(() => {
    (async () => {
      const { data } = await db.from("delivery_comercios").select("*").eq("activo", true).order("destacado", { ascending: false }).order("total_resenas", { ascending: false });
      setStores(data || []);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (!user) return;
    db.from("delivery_pedidos").select("*, comercio:delivery_comercios(nombre,slug,imagen_url,logo_url)").eq("cliente_id", user.id)
      .not("estado", "in", "(entregado,cancelado)").order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }: { data: DeliveryOrder | null }) => setActiveOrder(data));
  }, [user]);

  useEffect(() => {
    const timer = window.setInterval(() => setBanner((current) => (current + 1) % banners.length), 5000);
    return () => window.clearInterval(timer);
  }, []);

  const open = useMemo(() => stores.filter((store) => store.esta_abierto), [stores]);
  const popular = useMemo(() => [...open].sort((a, b) => b.total_resenas - a.total_resenas).slice(0, 10), [open]);
  const promos = useMemo(() => open.filter((store) => store.promo_texto), [open]);
  const fast = useMemo(() => [...open].sort((a, b) => a.tiempo_max - b.tiempo_max).slice(0, 10), [open]);
  const markets = useMemo(() => open.filter((store) => store.categoria !== "comida"), [open]);

  const all = useMemo(() => {
    const list = [...stores];
    if (filter === "abiertos") return list.filter((store) => store.esta_abierto);
    if (filter === "gratis") return list.filter((store) => Number(store.costo_envio) === 0 || (store.envio_gratis_desde ?? Infinity) <= 1);
    if (filter === "rating") return list.sort((a, b) => b.rating - a.rating);
    if (filter === "rapido") return list.sort((a, b) => a.tiempo_max - b.tiempo_max);
    return list;
  }, [stores, filter]);

  const firstName = nombre.split(" ")[0];

  return (
    <div className="mx-auto w-full max-w-7xl px-4 pb-14 pt-5 sm:px-6 lg:px-8">
      <h1 className="text-2xl font-extrabold sm:text-3xl">{firstName ? `Hola, ${firstName} 👋` : "Hola 👋"}</h1>
      <p className="text-sm text-muted-foreground">¿Qué querés pedir hoy?</p>

      <Link to="/app/buscar" className="mt-4 flex h-12 items-center gap-3 rounded-full bg-muted px-4 text-sm text-muted-foreground md:hidden">
        <Search className="h-5 w-5" />Buscar comercios, platos o productos
      </Link>

      {activeOrder && (
        <Link to={`/app/pedidos/${activeOrder.id}`} className="mt-5 flex items-center gap-3 rounded-2xl border border-primary/30 bg-primary/5 p-3 transition-colors hover:bg-primary/10">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground"><Bike className="h-5 w-5 animate-ride" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">{estadoLabel[activeOrder.estado]}</span>
            <span className="block truncate text-sm text-muted-foreground">{activeOrder.comercio?.nombre} · Seguí tu pedido en vivo</span>
          </span>
          <StatusBadge estado={activeOrder.estado} className="hidden sm:inline-flex" />
          <ChevronRight className="h-5 w-5 text-muted-foreground" />
        </Link>
      )}

      <section className="scrollbar-none -mx-4 mt-6 flex gap-3 overflow-x-auto px-4 pb-1 sm:-mx-6 sm:px-6 lg:mx-0 lg:grid lg:grid-cols-[repeat(13,minmax(0,1fr))] lg:px-0">
        {verticals.map(({ id, label, icon: Icon, color }) => (
          <Link key={id} to={`/app/categoria/${id}`} className="group flex w-[76px] shrink-0 flex-col items-center gap-2 lg:w-auto">
            <span className={cn("flex h-16 w-16 items-center justify-center rounded-2xl transition-transform group-hover:-translate-y-0.5 group-active:scale-95", color)}><Icon className="h-7 w-7" /></span>
            <span className="text-center text-xs font-bold">{label}</span>
          </Link>
        ))}
      </section>

      <section className="relative mt-7 overflow-hidden rounded-3xl">
        <div className="flex transition-transform duration-500" style={{ transform: `translateX(-${banner * 100}%)` }}>
          {banners.map((item) => (
            <Link key={item.title} to={item.to} className="relative block aspect-[16/7] min-h-[170px] w-full shrink-0 sm:aspect-[16/5]">
              <img src={item.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
              <div className={cn("absolute inset-0 bg-gradient-to-r to-transparent", item.tone)} />
              <div className="relative flex h-full max-w-md flex-col justify-center p-6 text-white sm:p-10">
                <h2 className="text-2xl font-extrabold leading-tight sm:text-4xl">{item.title}</h2>
                <p className="mt-2 text-sm font-semibold text-white/85 sm:text-base">{item.text}</p>
                <span className="mt-4 flex w-fit items-center gap-1 rounded-full bg-white px-4 py-2 text-sm font-bold text-foreground">Pedir ahora<ArrowRight className="h-4 w-4" /></span>
              </div>
            </Link>
          ))}
        </div>
        <div className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-1.5">
          {banners.map((item, index) => (
            <button key={item.title} type="button" aria-label={`Ver promoción ${index + 1}`} onClick={() => setBanner(index)} className={cn("h-2 rounded-full bg-white transition-all", banner === index ? "w-6" : "w-2 opacity-60")} />
          ))}
        </div>
      </section>

      {loading ? (
        <Rail title="Los más pedidos">{[0, 1, 2, 3].map((key) => <StoreCardSkeleton key={key} variant="row" />)}</Rail>
      ) : (
        <>
          {popular.length > 0 && <Rail title="Los más pedidos" subtitle="Favoritos de la zona">{popular.map((store) => <StoreCard key={store.id} store={store} variant="row" />)}</Rail>}
          {promos.length > 0 && <Rail title="Promociones imperdibles" subtitle="Descuentos que vencen pronto" to="/app/promociones">{promos.map((store) => <StoreCard key={store.id} store={store} variant="row" />)}</Rail>}
          {fast.length > 0 && <Rail title="Llegan rapidísimo" subtitle="En menos de 35 minutos">{fast.map((store) => <StoreCard key={store.id} store={store} variant="row" />)}</Rail>}
          {markets.length > 0 && <Rail title="Súper, farmacia y tiendas" to="/app/categoria/super">{markets.map((store) => <StoreCard key={store.id} store={store} variant="row" />)}</Rail>}
        </>
      )}

      <section className="pt-10">
        <h2 className="text-xl font-extrabold sm:text-2xl">Todos los comercios</h2>
        <div className="scrollbar-none -mx-4 mt-4 flex gap-2 overflow-x-auto px-4 sm:mx-0 sm:px-0">
          {filters.map((item) => (
            <button key={item.id} type="button" onClick={() => setFilter(item.id)} className={cn("shrink-0 rounded-full border px-4 py-2 text-sm font-bold transition-colors", filter === item.id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{item.label}</button>
          ))}
        </div>
        <div className="mt-6 grid grid-cols-1 gap-x-5 gap-y-8 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {loading ? [0, 1, 2, 3].map((key) => <StoreCardSkeleton key={key} />) : all.map((store) => <StoreCard key={store.id} store={store} />)}
        </div>
        {!loading && all.length === 0 && <EmptyState title="No hay comercios para mostrar" text="Probá con otro filtro." />}
      </section>
    </div>
  );
}
