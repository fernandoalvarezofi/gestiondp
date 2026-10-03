import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { Car, ChevronRight, Package, Search, SlidersHorizontal, Star, Store } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { EmptyState } from "@/components/delivery/Common";
import { OutOfZone } from "@/components/delivery/OutOfZone";
import { readPickupPreference, writePickupPreference } from "@/lib/delivery";
import { useAddressPoint } from "@/hooks/useAddressPoint";
import { distanceKm } from "@/lib/geo";
import { StoreCard, StoreCardSkeleton, StoreListItem, StoreListSkeleton, StoreLogo } from "@/components/delivery/StoreCard";
import { useInZone } from "@/hooks/useAddressPoint";
import { db, DeliveryOrder, DeliveryStore, estadoTitulo, img, isOpenNow, pasosDe, verticals } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const banners = [
  { title: "30% OFF en tu primer pedido", text: "Con el código BIENVENIDA", image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=1000&q=80&auto=format&fit=crop", tone: "from-[#F2402A] via-[#F2402A]/85", to: "/app/promociones", cta: "Ver cupones" },
  { title: "Tu súper en minutos", text: "Frescos, almacén y bebidas", image: "https://images.unsplash.com/photo-1542838132-92c53300491e?w=1000&q=80&auto=format&fit=crop", tone: "from-emerald-700 via-emerald-700/80", to: "/app/categoria/super", cta: "Hacer el súper" },
  { title: "Sumá puntos con cada pedido", text: "Woref Club: canjealos por descuentos y envíos gratis", image: "https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1000&q=80&auto=format&fit=crop", tone: "from-brand-deep via-brand-deep/80", to: "/app/club", cta: "Ver mi Club" },
  { title: "Invitá a un amigo", text: "Los dos ganan descuento en su primer pedido", image: "https://images.unsplash.com/photo-1571091718767-18b5b1457add?w=1000&q=80&auto=format&fit=crop", tone: "from-violet-800 via-violet-800/80", to: "/app/club", cta: "Invitar" },
];

type Sort = "relevancia" | "rating" | "rapido";
type Filters = { retiro: boolean; gratis: boolean; promos: boolean; abiertos: boolean; top: boolean };

function Section({ title, subtitle, to, children }: { title: string; subtitle?: string; to?: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <div className="mb-3 flex items-end justify-between gap-4 px-4 sm:px-0">
        <div className="min-w-0">
          <h2 className="truncate text-lg font-black sm:text-xl">{title}</h2>
          {subtitle && <p className="text-[13px] font-semibold text-muted-foreground">{subtitle}</p>}
        </div>
        {to && <Link to={to} className="flex shrink-0 items-center text-sm font-extrabold text-primary">Ver todos<ChevronRight className="h-4 w-4" /></Link>}
      </div>
      {children}
    </section>
  );
}

// Una fila con menos de 3 locales se ve vacía y repetida: se oculta hasta que haya más oferta.
const RAIL_MIN = 3;

const Rail = ({ children }: { children: React.ReactNode }) => (
  <div className="scrollbar-none flex snap-x scroll-px-4 gap-3 overflow-x-auto px-4 pb-1 sm:scroll-px-0 sm:px-0">{children}</div>
);

export default function DeliveryHome() {
  const { user } = useAuth();
  const inZone = useInZone();
  const point = useAddressPoint();
  const [stores, setStores] = useState<DeliveryStore[]>([]);
  const [orders, setOrders] = useState<DeliveryOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [sort, setSort] = useState<Sort>("relevancia");
  const [filters, setFilters] = useState<Filters>(() => ({ retiro: readPickupPreference(), gratis: false, promos: false, abiertos: false, top: false }));

  useEffect(() => {
    db.from("delivery_comercios").select("*").eq("activo", true).order("destacado", { ascending: false }).order("total_resenas", { ascending: false })
      .then(({ data }: { data: DeliveryStore[] | null }) => { setStores(data || []); setLoading(false); });
  }, []);

  useEffect(() => {
    if (!user) return;
    db.from("delivery_pedidos").select("id,estado,calificado,created_at,entrega_estimada,comercio_id,pago_estado,metodo_pago,tipo_entrega,programado_para,comercio:delivery_comercios(nombre,slug,imagen_url,logo_url)")
      .eq("cliente_id", user.id).order("created_at", { ascending: false }).limit(20)
      .then(({ data }: { data: DeliveryOrder[] | null }) => setOrders(data || []));
  }, [user]);

  const available = useMemo(() => stores.filter((store) => isOpenNow(store) && inZone(store)), [stores, inZone]);
  const activeOrder = orders.find((order) => !["entregado", "cancelado"].includes(order.estado) && order.pago_estado !== "pendiente");
  const toRate = orders.find((order) => order.estado === "entregado" && !order.calificado && Date.now() - new Date(order.created_at).getTime() < 7 * 86400000);
  const reorder = useMemo(() => {
    const ids = [...new Set(orders.filter((order) => order.estado === "entregado").map((order) => order.comercio_id))];
    return ids.map((id) => stores.find((store) => store.id === id)).filter(Boolean) as DeliveryStore[];
  }, [orders, stores]);

  // Cada local aparece una sola vez entre las filas de arriba (el listado completo está más abajo).
  const { popular, promos, freeShipping, fast, newStores } = useMemo(() => {
    const seen = new Set<string>();
    const pick = (list: DeliveryStore[]) => {
      const fresh = list.filter((store) => !seen.has(store.id)).slice(0, 10);
      if (fresh.length < RAIL_MIN) return [];
      fresh.forEach((store) => seen.add(store.id));
      return fresh;
    };
    return {
      popular: pick([...available].sort((x, y) => y.total_resenas - x.total_resenas)),
      promos: pick(available.filter((store) => store.promo_texto)),
      freeShipping: pick(available.filter((store) => Number(store.costo_envio) === 0 || (store.envio_gratis_desde ?? Infinity) <= 1)),
      fast: pick([...available].sort((x, y) => x.tiempo_max - y.tiempo_max)),
      newStores: pick(available.filter((store) => !store.total_resenas || (store.created_at && Date.now() - new Date(store.created_at).getTime() < 30 * 86400000))),
    };
  }, [available]);

  const list = useMemo(() => {
    let result = [...stores];
    if (filters.retiro) result = result.filter((store) => store.acepta_retiro !== false);
    if (filters.gratis) result = result.filter((store) => Number(store.costo_envio) === 0 || (store.envio_gratis_desde ?? Infinity) <= 1);
    if (filters.promos) result = result.filter((store) => store.promo_texto);
    if (filters.abiertos) result = result.filter((store) => isOpenNow(store) && inZone(store));
    if (filters.top) result = result.filter((store) => store.total_resenas > 0 && store.rating >= 4.7);
    if (sort === "rating") result.sort((a, b) => b.rating - a.rating);
    if (sort === "rapido") result.sort((a, b) => a.tiempo_max - b.tiempo_max);
    return result.sort((a, b) => Number(isOpenNow(b) && inZone(b)) - Number(isOpenNow(a) && inZone(a)));
  }, [stores, filters, sort, inZone]);

  // "¿Qué se te antoja?": rubros reales de los locales, con la foto del local más pedido de cada uno.
  const cuisines = useMemo(() => {
    const byRubro = new Map<string, DeliveryStore>();
    for (const store of available) {
      const key = store.rubro?.trim();
      if (!key || store.categoria !== "comida") continue;
      const current = byRubro.get(key);
      if (!current || store.total_resenas > current.total_resenas) byRubro.set(key, store);
    }
    return [...byRubro.entries()].map(([rubro, store]) => ({ rubro, image: store.imagen_url }));
  }, [available]);

  // Con una dirección ubicada en el mapa y comercios cargados, ¿llega alguno? Si no, se explica y se registra la demanda.
  const noCoverage = !loading && Boolean(point) && stores.length > 0 && !stores.some((store) => inZone(store));
  const nearestKm = useMemo(() => {
    if (!point) return null;
    const distances = stores.filter((store) => store.latitud != null && store.longitud != null).map((store) => distanceKm(point, { lat: Number(store.latitud), lng: Number(store.longitud) }));
    return distances.length ? Math.min(...distances) : null;
  }, [stores, point]);

  // 7 categorías + "Envíos" completan una sola fila de 8 en pantallas anchas.
  const tiles = verticals.slice(0, 7);
  const toggle = (key: keyof Filters) => setFilters((current) => {
    const next = { ...current, [key]: !current[key] };
    if (key === "retiro") writePickupPreference(next.retiro);
    return next;
  });

  return (
    <div className="pb-16">
      {/* Portada de marca: el buscador vive adentro, como en las apps de delivery */}
      <div className="mx-auto max-w-6xl sm:px-6 md:pt-6 lg:px-8">
        <section className="bg-primary px-4 pb-14 pt-1 text-primary-foreground max-md:rounded-b-[32px] md:rounded-3xl md:px-10 md:pb-16 md:pt-10">
          <h1 className="text-[26px] font-extrabold leading-[1.1] tracking-tight md:text-5xl">¿Qué querés<br className="md:hidden" /> pedir hoy?</h1>
          <p className="mt-1 hidden text-lg font-semibold text-primary-foreground/85 md:block">Comida, súper, farmacia y más, cerca tuyo.</p>
          <Link to="/app/buscar" className="mt-4 flex h-12 items-center gap-3 rounded-full bg-card px-4 text-[15px] font-semibold text-muted-foreground shadow-pop transition-transform active:scale-[0.99] md:mt-6 md:h-14 md:max-w-xl md:text-base">
            <Search className="h-5 w-5 text-primary" />Buscar locales, platos y productos
          </Link>
        </section>
      </div>

      <div className="relative z-10 mx-auto -mt-9 max-w-6xl px-4 sm:px-6 md:-mt-10 lg:px-8">
        <section className="grid grid-cols-4 gap-x-2 gap-y-4 rounded-3xl bg-card p-4 shadow-pop md:grid-cols-9 md:p-5" aria-label="Categorías">
          {tiles.map(({ id, label, icon: Icon, color }, index) => (
            <Link key={id} to={`/app/categoria/${id}`} className={cn("group flex flex-col items-center gap-1.5 text-center", index >= 6 && "max-md:hidden")}>
              <span className={cn("flex h-14 w-14 items-center justify-center rounded-2xl transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95 md:h-16 md:w-16", color)}><Icon className="h-7 w-7 md:h-8 md:w-8" strokeWidth={2.2} /></span>
              <span className="text-[12px] font-bold leading-tight md:text-[13px]">{label}</span>
            </Link>
          ))}
          <Link to="/app/enviar" className="group flex flex-col items-center gap-1.5 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-100 text-amber-700 transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95 dark:bg-amber-500/15 dark:text-amber-300 md:h-16 md:w-16"><Package className="h-7 w-7 md:h-8 md:w-8" strokeWidth={2.2} /></span>
            <span className="text-[12px] font-bold leading-tight md:text-[13px]">Envíos</span>
          </Link>
          <Link to="/app/remis" className="group flex flex-col items-center gap-1.5 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky-100 text-sky-700 transition-transform duration-200 group-hover:-translate-y-0.5 group-active:scale-95 dark:bg-sky-500/15 dark:text-sky-300 md:h-16 md:w-16"><Car className="h-7 w-7 md:h-8 md:w-8" strokeWidth={2.2} /></span>
            <span className="text-[12px] font-bold leading-tight md:text-[13px]">Remís</span>
          </Link>
        </section>
      </div>

      <div className="mx-auto w-full max-w-6xl sm:px-6 lg:px-8">
      <div className="px-4 sm:px-0">
        {activeOrder && <ActiveOrderBanner order={activeOrder} />}
        {!activeOrder && toRate && <RateBanner order={toRate} />}
        {noCoverage && <OutOfZone nearestKm={nearestKm} />}
      </div>

      <BannerCarousel />

      <Link to="/app/directorio" className="mx-4 mt-6 flex items-center gap-3 rounded-3xl border bg-card p-4 transition-colors hover:bg-muted sm:mx-0">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Store className="h-6 w-6" /></span>
        <span className="min-w-0 flex-1"><span className="block font-extrabold">¿No está tu comercio favorito?</span><span className="block text-sm text-muted-foreground">Mirá los comercios de Lincoln que todavía no están y pedí que se sumen.</span></span>
        <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground" />
      </Link>

      {cuisines.length > 2 && (
        <Section title="¿Qué se te antoja?">
          <Rail>
            {cuisines.map(({ rubro, image }) => (
              <Link key={rubro} to={`/app/buscar?q=${encodeURIComponent(rubro)}`} className="group flex w-[84px] shrink-0 snap-start flex-col items-center gap-2 text-center">
                <span className="relative h-[84px] w-[84px] overflow-hidden rounded-full bg-muted ring-2 ring-transparent transition-all duration-300 group-hover:ring-primary group-active:scale-95">
                  <img src={img(image, 240)} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-110" />
                  <span className="absolute inset-0 rounded-full shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)]" />
                </span>
                <span className="text-[13px] font-extrabold leading-tight">{rubro}</span>
              </Link>
            ))}
          </Rail>
        </Section>
      )}

      {reorder.length > 0 && (
        <Section title="Pedí de nuevo" subtitle="Tus locales de siempre">
          <Rail>
            {reorder.map((store) => (
              <Link key={store.id} to={`/app/tienda/${store.slug}`} className="flex w-[88px] shrink-0 snap-start flex-col items-center gap-1.5 text-center">
                <StoreLogo store={store} className="h-[76px] w-[76px] text-xl" />
                <span className="line-clamp-2 text-xs font-bold leading-tight">{store.nombre}</span>
              </Link>
            ))}
          </Rail>
        </Section>
      )}

      {loading ? (
        <Section title="Los más pedidos"><Rail>{[0, 1, 2, 3].map((key) => <StoreCardSkeleton key={key} variant="row" />)}</Rail></Section>
      ) : (
        <>
          {popular.length > 0 && <Section title="Los más pedidos" subtitle="Lo que más se pide cerca tuyo"><Rail>{popular.map((store) => <StoreCard key={store.id} store={store} variant="row" />)}</Rail></Section>}
          {promos.length > 0 && <Section title="Descuentos imperdibles" to="/app/promociones"><Rail>{promos.map((store) => <StoreCard key={store.id} store={store} variant="row" />)}</Rail></Section>}
          {freeShipping.length > 0 && <Section title="Con envío gratis"><Rail>{freeShipping.map((store) => <StoreCard key={store.id} store={store} variant="row" />)}</Rail></Section>}
          {fast.length > 0 && <Section title="Te llega rapidísimo" subtitle="Los que menos tardan"><Rail>{fast.map((store) => <StoreCard key={store.id} store={store} variant="row" />)}</Rail></Section>}
          {newStores.length > 0 && <Section title="Nuevos en Woref"><Rail>{newStores.map((store) => <StoreCard key={store.id} store={store} variant="row" />)}</Rail></Section>}
        </>
      )}

      <section className="mt-10">
        <div className="px-4 sm:px-0">
          <h2 className="text-lg font-black sm:text-xl">Todos los locales</h2>
          <p className="text-[13px] font-semibold text-muted-foreground">{list.length} {list.length === 1 ? "resultado" : "resultados"}</p>
        </div>
        <div className="scrollbar-none mt-3 flex gap-2 overflow-x-auto px-4 pb-1 sm:px-0">
          <label className="relative flex shrink-0 items-center">
            <SlidersHorizontal className="pointer-events-none absolute left-3 h-4 w-4" />
            <select value={sort} onChange={(event) => setSort(event.target.value as Sort)} className="h-9 appearance-none rounded-full border bg-card pl-9 pr-4 text-sm font-bold" aria-label="Ordenar">
              <option value="relevancia">Ordenar: Relevancia</option>
              <option value="rating">Mejor puntuados</option>
              <option value="rapido">Menor tiempo</option>
            </select>
          </label>
          {([["retiro", "Retiro en el local"], ["gratis", "Envío gratis"], ["promos", "Con descuento"], ["abiertos", "Abiertos ahora"], ["top", "Más de 4,7 ★"]] as [keyof Filters, string][]).map(([key, label]) => (
            <button key={key} type="button" onClick={() => toggle(key)} className={cn("h-9 shrink-0 rounded-full border px-4 text-sm font-bold transition-colors", filters[key] ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{label}</button>
          ))}
        </div>
        <div className="mt-2 grid gap-1 px-2 sm:grid-cols-2 sm:px-0 md:hidden">
          {loading ? [0, 1, 2, 3, 4, 5].map((key) => <StoreListSkeleton key={key} />) : list.map((store) => <StoreListItem key={store.id} store={store} />)}
        </div>
        {/* En pantallas anchas los locales se muestran con foto, como en las filas de arriba. */}
        <div className="mt-5 hidden gap-x-5 gap-y-8 md:grid md:grid-cols-3 xl:grid-cols-4">
          {loading ? [0, 1, 2, 3, 4, 5, 6, 7].map((key) => <StoreCardSkeleton key={key} />) : list.map((store) => <StoreCard key={store.id} store={store} />)}
        </div>
        {!loading && list.length === 0 && <EmptyState className="mx-4 mt-4 sm:mx-0" title="No hay locales con esos filtros" text="Probá sacando alguno." />}
      </section>
      </div>
    </div>
  );
}

function ActiveOrderBanner({ order }: { order: DeliveryOrder }) {
  const steps = pasosDe(order);
  const step = Math.max(0, steps.indexOf(order.estado));
  const eta = order.entrega_estimada ? new Date(order.entrega_estimada).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit" }) : null;
  return (
    <Link to={`/app/pedidos/${order.id}`} className="mt-4 block rounded-3xl bg-brand-deep p-4 text-white shadow-pop">
      <div className="flex items-center gap-3">
        {order.comercio && <StoreLogo store={order.comercio as DeliveryStore} className="h-11 w-11 border-0 text-sm" />}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[15px] font-extrabold">{estadoTitulo(order)}</p>
          <p className="truncate text-[13px] font-semibold text-white/75">{order.comercio?.nombre}{eta && ` · ${order.tipo_entrega === "retiro" ? "Listo aprox." : "Llega aprox."} ${eta}`}</p>
        </div>
        <ChevronRight className="h-5 w-5 text-white/70" />
      </div>
      <div className="mt-3 grid grid-cols-5 gap-1">
        {steps.map((_, index) => <span key={index} className={cn("h-1.5 rounded-full", index <= step ? "bg-primary" : "bg-white/20", index === step && "animate-pulse")} />)}
      </div>
    </Link>
  );
}

function RateBanner({ order }: { order: DeliveryOrder }) {
  return (
    <Link to={`/app/pedidos/${order.id}`} className="mt-4 flex items-center gap-3 rounded-3xl border bg-card p-4 shadow-sm">
      {order.comercio && <StoreLogo store={order.comercio as DeliveryStore} className="h-11 w-11 text-sm" />}
      <div className="min-w-0 flex-1">
        <p className="truncate text-[15px] font-extrabold">¿Qué tal estuvo {order.comercio?.nombre}?</p>
        <span className="mt-0.5 flex gap-0.5">{[1, 2, 3, 4, 5].map((value) => <Star key={value} className="h-5 w-5 text-muted-foreground/40" />)}</span>
      </div>
      <span className="text-sm font-extrabold text-primary">Calificar</span>
    </Link>
  );
}

function BannerCarousel() {
  const track = useRef<HTMLDivElement>(null);
  const [current, setCurrent] = useState(0);

  // Avanza solo cada 5 s; si la persona desliza, el indicador sigue al banner visible.
  useEffect(() => {
    const timer = window.setInterval(() => {
      const element = track.current;
      if (!element) return;
      const next = (current + 1) % banners.length;
      element.scrollTo({ left: (element.children[next] as HTMLElement).offsetLeft - element.offsetLeft - 16, behavior: "smooth" });
    }, 5000);
    return () => window.clearInterval(timer);
  }, [current]);

  const onScroll = () => {
    const element = track.current;
    if (!element) return;
    const width = (element.children[0] as HTMLElement).offsetWidth;
    setCurrent(Math.min(banners.length - 1, Math.round(element.scrollLeft / (width + 12))));
  };

  return (
    <section className="mt-6">
      <div ref={track} onScroll={onScroll} className="scrollbar-none flex snap-x snap-mandatory scroll-px-4 gap-3 overflow-x-auto scroll-smooth px-4 sm:scroll-px-0 sm:px-0">
        {banners.map((item) => (
          <Link key={item.title} to={item.to} className="relative aspect-[2/1] w-[86%] shrink-0 snap-start overflow-hidden rounded-3xl sm:aspect-[3/1] sm:w-full">
            <img src={img(item.image, 1000)} alt="" className="absolute inset-0 h-full w-full object-cover" />
            <div className={cn("absolute inset-0 bg-gradient-to-r to-transparent", item.tone)} />
            <div className="relative flex h-full max-w-[70%] flex-col justify-center p-5 text-white sm:max-w-md sm:p-10">
              <h2 className="text-xl font-black leading-tight sm:text-4xl">{item.title}</h2>
              <p className="mt-1 text-[13px] font-semibold text-white/90 sm:text-base">{item.text}</p>
              <span className="mt-3 w-fit rounded-full bg-white px-4 py-1.5 text-[13px] font-extrabold text-foreground">{item.cta}</span>
            </div>
          </Link>
        ))}
      </div>
      <div className="mt-2 flex justify-center gap-1.5">
        {banners.map((item, index) => <span key={item.title} className={cn("h-1.5 rounded-full transition-all", index === current ? "w-5 bg-primary" : "w-1.5 bg-muted-foreground/30")} />)}
      </div>
    </section>
  );
}
