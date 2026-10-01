import { Link, Navigate } from "react-router-dom";
import { ArrowRight, Bike, Clock3, MapPin, ShieldCheck, Store, Ticket } from "lucide-react";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { verticals } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const photo = (id: string, width = 900) => `https://images.unsplash.com/photo-${id}?w=${width}&q=80&auto=format&fit=crop`;

const collage = [
  { id: "1568901346375-23c9450c58cd", alt: "Hamburguesa", className: "row-span-2" },
  { id: "1579871494447-9811cf80d66c", alt: "Sushi", className: "" },
  { id: "1513104890138-7c749659a591", alt: "Pizza", className: "" },
  { id: "1563805042-7684c019e1cb", alt: "Postre helado", className: "" },
  { id: "1542838132-92c53300491e", alt: "Verduras del súper", className: "" },
];

const steps = [
  { icon: MapPin, title: "Elegí tu dirección", text: "Te mostramos los comercios que llegan a tu zona." },
  { icon: Store, title: "Armá tu pedido", text: "Restaurantes, súper, farmacia y tiendas en un solo lugar." },
  { icon: Bike, title: "Seguilo en vivo", text: "Ves cada paso, desde la cocina hasta tu puerta." },
];

export default function Landing() {
  const { session, loading } = useAuth();
  if (!loading && session) return <Navigate to="/app" replace />;

  return (
    <div className="min-h-screen bg-background">
      <header className="absolute inset-x-0 top-0 z-20">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <DeliveryBrand inverted />
          <div className="flex items-center gap-2">
            <Button asChild variant="ghost" className="rounded-full font-bold text-white hover:bg-white/15 hover:text-white"><Link to="/auth">Ingresar</Link></Button>
            <Button asChild className="rounded-full bg-white font-bold text-primary hover:bg-white/90"><Link to="/auth?registro=1">Crear cuenta</Link></Button>
          </div>
        </div>
      </header>

      <section className="relative overflow-hidden bg-primary pb-16 pt-24 text-primary-foreground sm:pb-24 sm:pt-28">
        <div className="mx-auto grid max-w-7xl items-center gap-10 px-4 sm:px-6 lg:grid-cols-[1.05fr_1fr] lg:px-8">
          <div>
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-3 py-1 text-sm font-bold"><Clock3 className="h-4 w-4" />Entregas en minutos</span>
            <h1 className="mt-5 text-4xl font-extrabold leading-[1.05] sm:text-6xl">Pedí lo que quieras.<br />Te lo llevamos ya.</h1>
            <p className="mt-5 max-w-lg text-lg text-white/85">Comida, supermercado, farmacia y tiendas cerca tuyo. Seguí tu pedido en tiempo real y pagá como prefieras.</p>
            <Link to="/auth?registro=1" className="mt-8 flex max-w-lg items-center gap-3 rounded-full bg-white p-2 pl-5 text-foreground shadow-pop">
              <MapPin className="h-5 w-5 shrink-0 text-primary" />
              <span className="flex-1 truncate text-muted-foreground">¿Dónde querés recibir tu pedido?</span>
              <span className="flex items-center gap-1 rounded-full bg-primary px-5 py-3 font-bold text-primary-foreground">Pedir<ArrowRight className="h-4 w-4" /></span>
            </Link>
            <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-white/85"><Ticket className="h-4 w-4" />30% OFF en tu primer pedido con BIENVENIDA</p>
          </div>
          <div className="grid h-[340px] grid-cols-3 grid-rows-2 gap-3 sm:h-[440px]">
            {collage.map((item, index) => (
              <div key={item.id} className={cn("overflow-hidden rounded-3xl shadow-pop", item.className, index === 0 && "col-span-1")}>
                <img src={photo(item.id, index === 0 ? 700 : 500)} alt={item.alt} className="h-full w-full object-cover" />
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl px-4 py-14 sm:px-6 lg:px-8">
        <h2 className="text-center text-3xl font-extrabold">Todo lo que necesitás, en una app</h2>
        <div className="mx-auto mt-8 grid max-w-5xl grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-7">
          {verticals.slice(0, 7).map(({ id, label, icon: Icon, color }) => (
            <Link key={id} to="/auth?registro=1" className="flex flex-col items-center gap-2">
              <span className={cn("flex h-20 w-20 items-center justify-center rounded-3xl transition-transform hover:-translate-y-1", color)}><Icon className="h-9 w-9" /></span>
              <span className="text-sm font-bold">{label}</span>
            </Link>
          ))}
        </div>
      </section>

      <section className="bg-brand-cream py-14">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-extrabold">Así de fácil</h2>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            {steps.map(({ icon: Icon, title, text }, index) => (
              <div key={title} className="rounded-3xl bg-card p-6 shadow-soft">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground"><Icon className="h-6 w-6" /></span>
                <p className="mt-4 text-sm font-bold text-primary">Paso {index + 1}</p>
                <h3 className="text-xl font-extrabold">{title}</h3>
                <p className="mt-1 text-muted-foreground">{text}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-4 px-4 py-14 sm:px-6 md:grid-cols-2 lg:px-8">
        <div className="relative overflow-hidden rounded-3xl bg-brand-deep p-8 text-white">
          <img src={photo("1555396273-367ea4eb4db5", 900)} alt="" className="absolute inset-0 h-full w-full object-cover opacity-25" />
          <div className="relative">
            <Store className="h-9 w-9" />
            <h3 className="mt-4 text-2xl font-extrabold">¿Tenés un comercio?</h3>
            <p className="mt-2 max-w-sm text-white/80">Sumate, cargá tu menú y recibí pedidos en tiempo real desde tu panel.</p>
            <Button asChild className="mt-6 rounded-full bg-white font-bold text-foreground hover:bg-white/90"><Link to="/auth?registro=1">Sumar mi comercio</Link></Button>
          </div>
        </div>
        <div className="relative overflow-hidden rounded-3xl bg-foreground p-8 text-background">
          <Bike className="absolute -bottom-10 -right-6 h-56 w-56 opacity-10" />
          <div className="relative">
            <Bike className="h-9 w-9" />
            <h3 className="mt-4 text-2xl font-extrabold">Repartí con Woref</h3>
            <p className="mt-2 max-w-sm opacity-80">Conectate cuando quieras y quedate con el 100% de las propinas.</p>
            <Button asChild className="mt-6 rounded-full font-bold"><Link to="/auth?registro=1">Quiero repartir</Link></Button>
          </div>
        </div>
      </section>

      <footer className="border-t">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-4 px-4 py-8 text-sm text-muted-foreground sm:flex-row sm:px-6 lg:px-8">
          <DeliveryBrand />
          <p className="flex items-center gap-1.5"><ShieldCheck className="h-4 w-4" />Seguimiento en vivo · Código de entrega en cada pedido</p>
          <p className="flex gap-4"><Link to="/terminos" className="hover:text-foreground">Términos</Link><Link to="/privacidad" className="hover:text-foreground">Privacidad</Link><span>© {new Date().getFullYear()} Woref</span></p>
        </div>
      </footer>
    </div>
  );
}
