import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Bike, CheckCircle2, Clock3, CreditCard, KeyRound, MapPin, Navigation, ShieldCheck, Star, Store, Ticket } from "lucide-react";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { SmartImage } from "@/components/delivery/SmartImage";
import { StoreLogo } from "@/components/delivery/StoreCard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { COMERCIO_COLS, db, DeliveryStore, money, verticals } from "@/lib/delivery";

const photo = (id: string, width = 900) => `https://images.unsplash.com/photo-${id}?w=${width}&q=75&auto=format&fit=crop`;

const trust = [
  { icon: Navigation, title: "Seguimiento en vivo", text: "Ves a tu repartidor en el mapa, paso a paso." },
  { icon: KeyRound, title: "Código de entrega", text: "Solo recibe tu pedido quien tiene tu código." },
  { icon: CreditCard, title: "Pagá como prefieras", text: "Efectivo, tarjeta o saldo en tu billetera." },
];

const steps = [
  { icon: MapPin, title: "Elegí tu dirección", text: "Te mostramos solo los comercios que llegan a tu zona." },
  { icon: Store, title: "Armá tu pedido", text: "Restaurantes, súper, farmacia y tiendas en un solo carrito." },
  { icon: Bike, title: "Seguilo hasta tu puerta", text: "Del local a tu casa, con avisos en cada paso." },
];

function useLandingStores() {
  return useQuery({
    queryKey: ["landing-stores"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await db.from("delivery_comercios").select(COMERCIO_COLS).eq("activo", true).order("destacado", { ascending: false }).order("total_resenas", { ascending: false }).limit(8);
      return (data ?? []) as DeliveryStore[];
    },
  });
}

export default function Landing() {
  const { session, loading } = useAuth();
  const stores = useLandingStores();
  if (!loading && session) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen overflow-x-clip bg-background">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:px-6 lg:h-20 lg:px-8">
          <DeliveryBrand inverted />
          <nav className="hidden items-center gap-1 lg:flex" aria-label="Principal">
            <a href="#comercios" className="rounded-full px-4 py-2 text-sm font-bold text-white/90 hover:bg-white/15">Comercios</a>
            <a href="#negocios" className="rounded-full px-4 py-2 text-sm font-bold text-white/90 hover:bg-white/15">Para tu negocio</a>
            <a href="#repartir" className="rounded-full px-4 py-2 text-sm font-bold text-white/90 hover:bg-white/15">Repartí</a>
          </nav>
          <div className="flex items-center gap-1.5 sm:gap-2">
            <Button asChild variant="ghost" size="sm" className="rounded-full font-bold text-white hover:bg-white/15 hover:text-white sm:h-10 sm:px-4"><Link to="/auth">Ingresar</Link></Button>
            <Button asChild size="sm" className="rounded-full bg-none bg-white font-bold text-primary hover:bg-white/90 sm:h-10 sm:px-5"><Link to="/auth?registro=1">Crear cuenta</Link></Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden border-b-4 border-brand-yellow bg-primary text-white">
        <div aria-hidden className="pointer-events-none absolute -right-32 -top-32 h-[520px] w-[520px] rounded-full bg-white/10 blur-2xl" />
        <div aria-hidden className="pointer-events-none absolute -bottom-40 left-1/4 h-[420px] w-[420px] rounded-full bg-black/10 blur-3xl" />
        <div className="relative mx-auto grid max-w-7xl items-center gap-10 px-4 pb-24 pt-24 sm:px-6 sm:pb-28 lg:grid-cols-[1.1fr_1fr] lg:gap-14 lg:px-8 lg:pb-32 lg:pt-32">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-bold"><Clock3 className="h-4 w-4" />Entregas en minutos</span>
            <h1 className="mt-5 text-[2.5rem] font-extrabold leading-[1.04] sm:text-6xl lg:text-[3.6rem] xl:text-6xl">Pedí lo que quieras.<span className="block">Te lo llevamos ya.</span></h1>
            <p className="mt-5 max-w-xl text-base text-white/85 sm:text-lg">Comida, supermercado, farmacia y tiendas de tu ciudad. Seguí tu pedido en tiempo real y pagá como prefieras.</p>
            <Link to="/auth?registro=1" className="mt-8 flex max-w-xl items-center gap-2 rounded-full bg-white p-1.5 pl-4 text-foreground shadow-pop sm:gap-3 sm:p-2 sm:pl-5">
              <MapPin className="h-5 w-5 shrink-0 text-primary" />
              <span className="min-w-0 flex-1 truncate text-sm text-muted-foreground sm:text-base">¿Dónde querés recibir tu pedido?</span>
              <span className="flex shrink-0 items-center gap-1 rounded-full bg-primary px-4 py-3 font-bold text-white sm:px-6">Pedir<ArrowRight className="h-4 w-4" /></span>
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-white/90"><Ticket className="h-4 w-4 shrink-0" />30% OFF en tu primer pedido con BIENVENIDA</p>
          </div>

          <div className="relative mx-auto w-full max-w-md lg:max-w-none">
            <div className="grid grid-cols-5 grid-rows-2 gap-3 sm:gap-4">
              <div className="col-span-3 row-span-2 aspect-[3/4] overflow-hidden rounded-[2rem] shadow-pop"><img src={photo("1568901346375-23c9450c58cd", 700)} alt="Hamburguesa" className="h-full w-full object-cover" /></div>
              <div className="col-span-2 aspect-square overflow-hidden rounded-[1.75rem] shadow-pop"><img src={photo("1579871494447-9811cf80d66c", 400)} alt="Sushi" className="h-full w-full object-cover" /></div>
              <div className="col-span-2 aspect-square overflow-hidden rounded-[1.75rem] shadow-pop"><img src={photo("1513104890138-7c749659a591", 400)} alt="Pizza" className="h-full w-full object-cover" /></div>
            </div>
            <div className="absolute -bottom-5 left-2 flex items-center gap-3 rounded-2xl bg-white p-3 pr-5 text-foreground shadow-pop sm:left-[-1.5rem]">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-success/15 text-success"><Bike className="h-6 w-6" /></span>
              <span><span className="block text-sm font-extrabold">Tu pedido va en camino</span><span className="block text-xs text-muted-foreground">Llega en unos 15 min</span></span>
            </div>
            <div className="absolute -top-4 right-2 hidden items-center gap-1.5 rounded-full bg-white px-4 py-2 text-sm font-extrabold text-foreground shadow-pop sm:flex"><Star className="h-4 w-4 fill-warning text-warning" />Calificados por clientes</div>
          </div>
        </div>
      </section>

      <section className="relative z-10 mx-auto -mt-10 max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="grid gap-px overflow-hidden rounded-3xl border-2 border-brand-yellow bg-border shadow-pop sm:grid-cols-3">
          {trust.map(({ icon: Icon, title, text }) => (
            <div key={title} className="flex items-start gap-3 bg-card p-5">
              <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl brand-tile"><Icon className="h-5 w-5" /></span>
              <div><p className="font-extrabold">{title}</p><p className="text-sm text-muted-foreground">{text}</p></div>
            </div>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8 lg:py-20">
        <h2 className="text-2xl font-extrabold sm:text-4xl">Todo lo que necesitás, en una app</h2>
        <p className="mt-2 text-muted-foreground">Elegí qué querés pedir y te mostramos lo que hay cerca.</p>
        <div className="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-3 sm:gap-4 lg:grid-cols-4">
          {verticals.slice(0, 8).map(({ id, label, image }) => (
            <Link key={id} to="/auth?registro=1" className="group relative aspect-[4/3] overflow-hidden rounded-3xl border-2 border-transparent bg-muted transition-colors hover:border-brand-yellow">
              <img src={image} alt="" loading="lazy" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
              <span aria-hidden className="absolute inset-0 bg-gradient-to-t from-black/65 via-black/10 to-transparent" />
              <span className="absolute inset-x-0 bottom-0 p-4 text-lg font-extrabold text-white">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      {!!stores.data?.length && (
        <section id="comercios" className="bg-muted/50 py-14 lg:py-20">
          <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
            <div className="flex items-end justify-between gap-4">
              <div><h2 className="text-2xl font-extrabold sm:text-4xl">Comercios en Woref</h2><p className="mt-2 text-muted-foreground">Mirá el menú sin crear cuenta.</p></div>
              <Button asChild variant="outline" className="hidden rounded-full font-bold sm:inline-flex"><Link to="/app">Ver todos<ArrowRight className="h-4 w-4" /></Link></Button>
            </div>
            <ul className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {stores.data.slice(0, 8).map((store, index) => (
                <li key={store.id} className={index >= 4 ? "hidden sm:block" : undefined}>
                  <Link to={`/app/tienda/${store.slug}`} className="group block overflow-hidden rounded-3xl border-2 bg-card shadow-soft transition-all hover:border-brand-yellow hover:shadow-pop">
                    <div className="relative aspect-[16/9] overflow-hidden bg-muted">
                      <SmartImage src={store.imagen_url} width={480} className="transition-transform duration-500 group-hover:scale-105" />
                      <StoreLogo store={store} className="absolute bottom-2 left-3 h-12 w-12 border-2 border-white text-sm" />
                    </div>
                    <div className="p-3 sm:p-4">
                      <p className="truncate font-extrabold">{store.nombre}</p>
                      <p className="mt-1 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground sm:text-sm">
                        {store.total_resenas ? <span className="flex items-center gap-1 font-bold text-foreground"><Star className="h-3.5 w-3.5 fill-warning text-warning" />{Number(store.rating).toFixed(1)}</span> : <span className="font-bold text-success">Nuevo</span>}
                        <span>· {store.tiempo_min} min</span>
                        <span>· {Number(store.costo_envio) > 0 ? `Envío ${money(store.costo_envio)}` : "Envío gratis"}</span>
                      </p>
                    </div>
                  </Link>
                </li>
              ))}
            </ul>
            <Button asChild variant="outline" className="mt-6 w-full rounded-full font-bold sm:hidden"><Link to="/app">Ver todos los comercios</Link></Button>
          </div>
        </section>
      )}

      <section className="bg-brand-cream py-14 lg:py-20">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl font-extrabold sm:text-4xl">Así de fácil</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="relative rounded-3xl border-t-4 border-brand-yellow bg-card p-6 shadow-soft">
                <span className="absolute right-5 top-4 font-display text-5xl font-black text-brand-yellow/20">{index + 1}</span>
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-white"><Icon className="h-6 w-6" /></span>
                <h3 className="mt-4 text-xl font-extrabold">{title}</h3>
                <p className="mt-1 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-2 lg:px-8 lg:py-20">
        <div id="negocios" className="relative scroll-mt-24 overflow-hidden rounded-3xl border-2 border-brand-yellow bg-brand-deep p-8 text-white lg:p-10">
          <img src={photo("1555396273-367ea4eb4db5", 900)} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="relative">
            <Store className="h-9 w-9" />
            <h3 className="mt-4 text-2xl font-extrabold sm:text-3xl">¿Tenés un comercio?</h3>
            <p className="mt-2 max-w-sm text-white/80">Sumate, cargá tu menú y recibí pedidos en tiempo real desde tu panel.</p>
            <ul className="mt-4 space-y-1.5 text-sm font-semibold text-white/90">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />Menú y stock al instante</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />Liquidaciones claras</li>
            </ul>
            <Button asChild className="mt-6 rounded-full bg-none bg-white font-bold text-foreground hover:bg-white/90"><Link to="/auth?registro=1">Sumar mi comercio</Link></Button>
          </div>
        </div>
        <div id="repartir" className="relative scroll-mt-24 overflow-hidden rounded-3xl border-b-4 border-brand-yellow bg-primary p-8 text-white lg:p-10">
          <Bike className="absolute -bottom-10 -right-6 h-56 w-56 opacity-10" />
          <div className="relative">
            <Bike className="h-9 w-9" />
            <h3 className="mt-4 text-2xl font-extrabold sm:text-3xl">Repartí con Woref</h3>
            <p className="mt-2 max-w-sm opacity-80">Conectate cuando quieras y quedate con el 100% de las propinas.</p>
            <ul className="mt-4 space-y-1.5 text-sm font-semibold opacity-90">
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />Cobrás por viaje, con billetera</li>
              <li className="flex items-center gap-2"><CheckCircle2 className="h-4 w-4 shrink-0" />Bonos y turnos con cupo</li>
            </ul>
            <Button asChild variant="accent" className="mt-6 rounded-full font-bold"><Link to="/auth?registro=1">Quiero repartir</Link></Button>
          </div>
        </div>
      </section>

      <footer className="border-t-4 border-brand-yellow bg-card">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-10 text-sm sm:px-6 md:grid-cols-[1.4fr_1fr_1fr] lg:px-8">
          <div className="space-y-3">
            <DeliveryBrand />
            <p className="flex items-center gap-1.5 text-muted-foreground"><ShieldCheck className="h-4 w-4 shrink-0" />Seguimiento en vivo · Código de entrega en cada pedido</p>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-extrabold">Woref</p>
            <Link to="/auth?registro=1" className="text-muted-foreground hover:text-foreground">Crear cuenta</Link>
            <a href="#negocios" className="text-muted-foreground hover:text-foreground">Sumar mi comercio</a>
            <a href="#repartir" className="text-muted-foreground hover:text-foreground">Quiero repartir</a>
          </div>
          <div className="flex flex-col gap-2">
            <p className="font-extrabold">Legal</p>
            <Link to="/terminos" className="text-muted-foreground hover:text-foreground">Términos</Link>
            <Link to="/privacidad" className="text-muted-foreground hover:text-foreground">Privacidad</Link>
            <Link to="/arrepentimiento" className="text-muted-foreground hover:text-foreground">Botón de arrepentimiento</Link>
          </div>
        </div>
        <p className="border-t py-4 text-center text-xs text-muted-foreground">© {new Date().getFullYear()} Woref</p>
      </footer>
    </div>
  );
}
