import { Link } from "react-router-dom";
import { BookUser, CalendarCheck, CarTaxiFront, ChevronRight, Heart, Package, Search, ShoppingBasket, Store, Ticket, Trophy, Utensils } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { SmartImage } from "@/components/delivery/SmartImage";
import { verticals } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { tono, tonoCategoria, type Tono } from "@/lib/tonos";

type Acceso = { to: string; titulo: string; texto: string; icon: LucideIcon; color: Tono };

/** Lo que el cliente puede hacer en Woref: comprar, enviar, viajar y reservar. */
const accesos: Acceso[] = [
  { to: "/app/categoria/restaurantes", titulo: "Restaurantes", texto: "Comida y bebidas", icon: Utensils, color: "coral" },
  { to: "/app/categoria/tiendas", titulo: "Tiendas", texto: "Moda, hogar y más", icon: Store, color: "violeta" },
  { to: "/app/buscar", titulo: "Productos", texto: "Buscá entre todos los comercios", icon: ShoppingBasket, color: "azul" },
  { to: "/app/turnos/locales", titulo: "Servicios y turnos", texto: "Peluquerías, consultorios, talleres", icon: CalendarCheck, color: "rosa" },
  { to: "/app/enviar", titulo: "Envíos", texto: "Retiramos y entregamos tu paquete", icon: Package, color: "amarillo" },
  { to: "/app/remis", titulo: "Viajes", texto: "Remís con conductores de tu ciudad", icon: CarTaxiFront, color: "tinta" },
];

const descubrir: Acceso[] = [
  { to: "/app/promociones", titulo: "Cupones y promociones", texto: "Descuentos y envíos gratis", icon: Ticket, color: "naranja" },
  { to: "/app/club", titulo: "Woref Club", texto: "Sumá puntos con cada pedido", icon: Trophy, color: "amarillo" },
  { to: "/app/favoritos", titulo: "Tus favoritos", texto: "Locales y productos guardados", icon: Heart, color: "rosa" },
  { to: "/app/directorio", titulo: "Directorio de la ciudad", texto: "Comercios que todavía no están en Woref", icon: BookUser, color: "celeste" },
];

function AccesoCard({ to, titulo, texto, icon: Icon, color }: Acceso) {
  return (
    <Link to={to} className="group flex h-full items-center gap-3.5 rounded-2xl border bg-card p-3.5 transition-colors hover:border-foreground/40 hover:bg-muted/50">
      <span className={cn("flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105", tono(color))}><Icon className="h-6 w-6" /></span>
      <span className="min-w-0 flex-1"><span className="block font-extrabold leading-tight">{titulo}</span><span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{texto}</span></span>
      <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}

function Grupo({ id, titulo, subtitulo, children }: { id: string; titulo: string; subtitulo: string; children: React.ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="flex items-center gap-2 text-lg font-extrabold"><span className="h-5 w-1 rounded-full bg-brand-yellow" />{titulo}</h2>
      <p className="mt-0.5 text-sm text-muted-foreground">{subtitulo}</p>
      <div className="mt-3">{children}</div>
    </section>
  );
}

/** Explorar (contexto Cliente): búsqueda, categorías y todos los servicios para el cliente. Lo de comercios y repartidores está en el selector de contexto. */
export default function Explore() {
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Explorar</h1>
      <p className="mt-1 text-muted-foreground">Comprá, enviá, viajá y reservá en tu ciudad.</p>

      <Link to="/app/buscar" className="mt-4 flex h-12 items-center gap-2 rounded-full border bg-card px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40">
        <Search className="h-4 w-4 text-foreground" />Buscar locales, platos y productos
      </Link>

      <div className="mt-6 space-y-8">
        <Grupo id="explorar-servicios" titulo="¿Qué necesitás?" subtitulo="Pedidos, envíos, viajes y turnos con seguimiento">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{accesos.map((item) => <li key={item.to}><AccesoCard {...item} /></li>)}</ul>
        </Grupo>

        <Grupo id="explorar-categorias" titulo="Categorías" subtitulo="Comercios de tu ciudad con entrega o retiro en el local">
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-6">
            {verticals.map((v) => (
              <li key={v.id}>
                <Link to={`/app/categoria/${v.id}`} className="group flex flex-col items-center gap-2 rounded-2xl p-1 text-center">
                  <span className="relative block aspect-square w-full overflow-hidden rounded-2xl bg-muted"><SmartImage src={v.image} tono={tonoCategoria(v.id)} width={240} alt="" className="h-full w-full object-cover transition-transform group-hover:scale-105" /></span>
                  <span className="text-sm font-bold leading-tight">{v.label}</span>
                </Link>
              </li>
            ))}
          </ul>
        </Grupo>

        <Grupo id="explorar-descubrir" titulo="Descubrí y ahorrá" subtitulo="Beneficios y comercios para vos">
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{descubrir.map((item) => <li key={item.to}><AccesoCard {...item} /></li>)}</ul>
        </Grupo>
      </div>
    </div>
  );
}
