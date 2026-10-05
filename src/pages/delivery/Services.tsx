import { Link } from "react-router-dom";
import { Bike, BookUser, CalendarCheck, CarTaxiFront, ChevronRight, CircleHelp, Globe, Heart, Package, Receipt, Store, Ticket, Trophy, UserCircle, Wallet } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { verticals } from "@/lib/delivery";

type Servicio = { to: string; titulo: string; texto: string; icon: LucideIcon };
type Grupo = { titulo: string; subtitulo: string; items: Servicio[] };

/** Todo lo que se puede hacer en Woref, ordenado por lo que la persona quiere lograr. */
export function gruposDeServicios(roles: { storeId: string | null; isCourier: boolean }): Grupo[] {
  return [
    {
      titulo: "Pedí lo que necesitás",
      subtitulo: "Comercios de tu ciudad con entrega o retiro en el local",
      items: verticals.slice(0, 4).map((v) => ({ to: `/app/categoria/${v.id}`, titulo: v.label, texto: v.id === "restaurantes" ? "Comida y bebidas" : v.id === "super" ? "Almacén, frescos y limpieza" : v.id === "farmacia" ? "Salud y cuidado personal" : "Moda, hogar y más", icon: v.icon })),
    },
    {
      titulo: "Enviá y viajá",
      subtitulo: "Mensajería y traslados con seguimiento",
      items: [
        { to: "/app/enviar", titulo: "Enviar un paquete", texto: "Retiramos y entregamos donde necesites", icon: Package },
        { to: "/app/remis", titulo: "Pedir un remis", texto: "Viajes con conductores de tu ciudad", icon: CarTaxiFront },
        { to: "/app/turnos/locales", titulo: "Reservar un turno", texto: "Peluquerías, consultorios, talleres y más", icon: CalendarCheck },
      ],
    },
    {
      titulo: "Descubrí y ahorrá",
      subtitulo: "Beneficios y comercios para vos",
      items: [
        { to: "/app/promociones", titulo: "Cupones y promociones", texto: "Descuentos y envíos gratis", icon: Ticket },
        { to: "/app/club", titulo: "Woref Club", texto: "Sumá puntos con cada pedido", icon: Trophy },
        { to: "/app/directorio", titulo: "Directorio de la ciudad", texto: "Comercios que todavía no están en Woref", icon: BookUser },
        { to: "/app/favoritos", titulo: "Tus favoritos", texto: "Locales y productos guardados", icon: Heart },
      ],
    },
    {
      titulo: "Vendé y ganá con Woref",
      subtitulo: "Para comercios y repartidores",
      items: [
        roles.storeId
          ? { to: "/app/comercio", titulo: "Panel de mi comercio", texto: "Pedidos, menú, estadísticas y finanzas", icon: Store }
          : { to: "/app/comercio/nuevo", titulo: "Sumar mi comercio", texto: "Creá tu local y empezá a vender", icon: Store },
        { to: roles.storeId ? "/app/comercio/tienda" : "/app/comercio/nuevo", titulo: "Tienda online propia", texto: "Tu tienda con diseño, variantes y enlace para compartir", icon: Globe },
        { to: "/app/repartidor", titulo: roles.isCourier ? "Panel de repartidor" : "Ser repartidor", texto: roles.isCourier ? "Pedidos, ganancias e incentivos" : "Hacé entregas y generá ingresos", icon: Bike },
      ],
    },
    {
      titulo: "Tu cuenta",
      subtitulo: "Pedidos, pagos y ayuda",
      items: [
        { to: "/app/pedidos", titulo: "Mis pedidos", texto: "Seguimiento e historial", icon: Receipt },
        { to: "/app/turnos", titulo: "Mis turnos", texto: "Tus reservas próximas y pasadas", icon: CalendarCheck },
        { to: "/app/perfil/billetera", titulo: "Billetera", texto: "Saldo a favor y movimientos", icon: Wallet },
        { to: "/app/perfil", titulo: "Perfil y direcciones", texto: "Tus datos y lugares de entrega", icon: UserCircle },
        { to: "/app/ayuda", titulo: "Ayuda", texto: "Preguntas y soporte", icon: CircleHelp },
      ],
    },
  ];
}

export default function Services() {
  const roles = useDeliveryRoles();
  const grupos = gruposDeServicios({ storeId: roles.storeId, isCourier: roles.isCourier });
  return (
    <div className="mx-auto max-w-5xl px-4 pb-16 pt-5 sm:px-6">
      <h1 className="text-2xl font-extrabold sm:text-3xl">Servicios</h1>
      <p className="mt-1 text-muted-foreground">Todo lo que podés hacer en Woref, en un solo lugar.</p>
      <div className="mt-6 space-y-8">
        {grupos.map((grupo) => (
          <section key={grupo.titulo} aria-labelledby={`grupo-${grupo.titulo}`}>
            <h2 id={`grupo-${grupo.titulo}`} className="flex items-center gap-2 text-lg font-extrabold"><span className="h-5 w-1 rounded-full bg-brand-orange" />{grupo.titulo}</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">{grupo.subtitulo}</p>
            <ul className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {grupo.items.map(({ to, titulo, texto, icon: Icon }) => (
                <li key={titulo}>
                  <Link to={to} className="group flex h-full items-center gap-3.5 rounded-2xl border bg-card p-3.5 transition-colors hover:border-foreground/40 hover:bg-muted/50">
                    <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[hsl(220_14%_16%)] text-brand-orange transition-transform group-hover:scale-105"><Icon className="h-6 w-6" /></span>
                    <span className="min-w-0 flex-1"><span className="block font-extrabold leading-tight">{titulo}</span><span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{texto}</span></span>
                    <ChevronRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
