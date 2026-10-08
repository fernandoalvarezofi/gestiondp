import { Suspense, useEffect, useState } from "react";
import { NavLink, Outlet, To, useLocation, useNavigate } from "react-router-dom";
import { BookUser, CalendarCheck, CarTaxiFront, ChevronDown, Compass, Heart, Loader2, LogOut, MapPin, MessageCircle, Package, Receipt, Search, ShoppingBag, Ticket, Trophy, UserCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { BackBar } from "@/components/delivery/Common";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { NotificationBell } from "@/components/delivery/NotificationBell";
import { AppFooter } from "@/components/delivery/AppFooter";
import { AddressDialog, toCartAddress, useSavedAddresses } from "@/components/delivery/AddressDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { money } from "@/lib/delivery";
import { isRootPath } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ContextMenuItems } from "@/navigation/ContextSwitcher";
import { CLIENT_TABS, GUEST_TABS, type ClientTab } from "@/navigation/menus";

/** Atajos de Explorar en la cabecera de escritorio. */
const exploreLinks = [
  { to: "/app/explorar", label: "Todo para explorar", icon: Compass },
  { to: "/app/enviar", label: "Enviar un paquete", icon: Package },
  { to: "/app/remis", label: "Pedir un remís", icon: CarTaxiFront },
  { to: "/app/turnos/locales", label: "Reservar un turno", icon: CalendarCheck },
  { to: "/app/directorio", label: "Directorio de la ciudad", icon: BookUser },
];

/** Atajos de la cuenta del cliente (menú de la cabecera de escritorio). */
const accountLinks = [
  { to: "/app/perfil", label: "Perfil y direcciones", icon: UserCircle },
  { to: "/app/pedidos", label: "Mis pedidos", icon: Receipt },
  { to: "/app/mensajes", label: "Mensajes", icon: MessageCircle },
  { to: "/app/favoritos", label: "Favoritos", icon: Heart },
  { to: "/app/promociones", label: "Cupones y promociones", icon: Ticket },
  { to: "/app/club", label: "Woref Club", icon: Trophy },
];

/**
 * Layout del contexto Cliente: cabecera con dirección y búsqueda, barra inferior en el celular,
 * carrito flotante y pie. Los paneles (comercio, repartidor, conductor, administración) tienen el suyo.
 */
export function ClientLayout() {
  const { session, loading, signOut } = useAuth();
  const { itemCount, totalGeneral: subtotal, groups, address, setAddress } = useCart();
  const { addresses, loading: addressesLoading } = useSavedAddresses();
  const [gateOpen, setGateOpen] = useState(false);
  const [gateAsked, setGateAsked] = useState(false);
  const roles = useDeliveryRoles();
  const location = useLocation();
  const navigate = useNavigate();

  // Si todavía no eligió dirección, usamos la guardada (preferimos una con ubicación en el mapa).
  useEffect(() => {
    if (address || !addresses.length) return;
    const located = addresses.filter((item) => item.latitud != null);
    const preferred = located.find((item) => item.predeterminada) || located[0] || addresses[0];
    setAddress(toCartAddress(preferred));
  }, [address, addresses, setAddress]);
  // Primera vez sin ninguna dirección: pedimos la ubicación apenas entra (una sola vez por sesión).
  useEffect(() => {
    if (loading || addressesLoading || address || addresses.length || gateAsked) return;
    setGateAsked(true);
    setGateOpen(true);
  }, [loading, addressesLoading, address, addresses.length, gateAsked]);

  const guest = !session;
  const loginTarget: To = { pathname: "/auth", search: `?next=${encodeURIComponent(location.pathname)}` };
  const tabs: (ClientTab | { to: To; label: string; icon: ClientTab["icon"]; end?: boolean })[] = guest ? [...GUEST_TABS, { to: loginTarget, label: "Ingresar", icon: UserCircle }] : CLIENT_TABS;

  const isHome = location.pathname === "/app";
  // En el carrito la barra de abajo la ocupa el botón de confirmar (como en las apps de delivery).
  const hideNav = location.pathname.startsWith("/app/carrito");
  // El seguimiento de un pedido es una pantalla completa con su propio botón de volver.
  const immersive = location.pathname.startsWith("/app/pedidos/");
  // Las pantallas internas llevan el mismo botón de volver (el local y el pedido traen el suyo sobre la foto o el mapa).
  const showBackBar = !isRootPath(location.pathname) && !/^\/app\/(tienda|pedidos)\/[^/]+$/.test(location.pathname);
  const showCartBar = itemCount > 0 && !hideNav && !immersive;

  return (
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <header className={cn("sticky top-0 z-40 border-b border-t-[3px] border-t-brand-orange bg-card shadow-[0_1px_0_rgba(0,0,0,0.02)]", isHome && "max-md:border-transparent max-md:bg-primary max-md:shadow-none max-md:backdrop-blur-none", immersive && "max-md:hidden")}>
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
          <NavLink to="/app" className="hidden shrink-0 md:block" aria-label="Inicio"><DeliveryBrand /></NavLink>

          <AddressDialog
            trigger={
              <button type="button" className={cn("-ml-2 flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-left hover:bg-muted md:ml-0", isHome && "max-md:hover:bg-white/10")}>
                <MapPin className={cn("h-5 w-5 shrink-0 text-primary", isHome && "max-md:text-white")} />
                <span className="min-w-0">
                  <span className={cn("block text-[11px] font-bold leading-none text-muted-foreground", isHome && "max-md:text-white/80")}>Entregar en</span>
                  <span className={cn("block max-w-[200px] truncate text-[15px] font-extrabold sm:max-w-[240px]", isHome && "max-md:text-white")}>{address?.direccion || "Elegí tu dirección"}</span>
                </span>
                <ChevronDown className={cn("h-4 w-4 shrink-0 text-primary", isHome && "max-md:text-white")} />
              </button>
            }
          />

          <NavLink to="/app/buscar" className="hidden h-11 flex-1 items-center gap-2 rounded-full border bg-background px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 md:flex lg:max-w-md">
            <Search className="h-4 w-4 text-foreground" />Buscar locales, platos y productos
          </NavLink>

          <nav className="ml-auto hidden items-center gap-1 md:flex" aria-label="Principal">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full font-bold"><Compass className="h-4 w-4" />Explorar<ChevronDown className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-60">
                {exploreLinks.map(({ to, label, icon: Icon }, index) => (
                  <div key={to}>
                    {index === 1 && <DropdownMenuSeparator />}
                    <DropdownMenuItem onClick={() => navigate(to)}><Icon className="h-4 w-4" />{label}</DropdownMenuItem>
                  </div>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
            {guest ? (
              <>
                <Button asChild variant="ghost" className="rounded-full font-bold"><NavLink to={loginTarget}>Ingresar</NavLink></Button>
                <Button asChild variant="outline" className="rounded-full font-bold"><NavLink to={{ pathname: "/auth", search: `?registro=1&next=${encodeURIComponent(location.pathname)}` }}>Crear cuenta</NavLink></Button>
              </>
            ) : (
              <>
                <Button asChild variant="ghost" className="rounded-full font-bold"><NavLink to="/app/pedidos"><Receipt className="h-4 w-4" />Pedidos</NavLink></Button>
                <Button asChild variant="ghost" size="icon" className="rounded-full" aria-label="Mensajes"><NavLink to="/app/mensajes"><MessageCircle className="h-5 w-5" /></NavLink></Button>
                <NotificationBell />
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" className="rounded-full font-bold"><UserCircle className="h-5 w-5" /><span className="max-w-[120px] truncate">{roles.nombre.split(" ")[0] || "Mi cuenta"}</span><ChevronDown className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-64">
                    <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
                    {accountLinks.map(({ to, label, icon: Icon }) => <DropdownMenuItem key={to} onClick={() => navigate(to)}><Icon className="h-4 w-4" />{label}</DropdownMenuItem>)}
                    <DropdownMenuSeparator />
                    <ContextMenuItems />
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()}><LogOut className="h-4 w-4" />Cerrar sesión</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
            <Button asChild className="rounded-full font-bold">
              <NavLink to="/app/carrito"><ShoppingBag className="h-4 w-4" />{itemCount ? `${itemCount} · ${money(subtotal)}` : "Carrito"}</NavLink>
            </Button>
          </nav>

          {!guest && <NotificationBell className={cn("ml-auto md:hidden", isHome && "max-md:text-white max-md:hover:bg-white/10")} />}
          <NavLink to="/app/carrito" aria-label={itemCount ? `Carrito, ${itemCount} productos` : "Carrito"} className={cn(guest && "ml-auto", "relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary md:hidden", isHome && "max-md:bg-white/20 max-md:text-white")}>
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 animate-pop-in items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{itemCount}</span>}
          </NavLink>
        </div>
      </header>

      {showBackBar && <BackBar className="sticky top-16 z-30" />}

      <AddressDialog open={gateOpen} onOpenChange={setGateOpen} title="¿Dónde estás?" />

      <main className="min-h-[calc(100vh-4rem)]"><Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}><Outlet /></Suspense></main>
      <AppFooter />

      {showCartBar && (
        <div className="fixed inset-x-0 bottom-[72px] z-40 px-4 md:hidden">
          <NavLink to="/app/carrito" className="flex h-14 items-center justify-between gap-3 rounded-2xl bg-primary px-4 text-primary-foreground shadow-pop">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2 text-sm font-black text-primary">{itemCount}</span>
            <span className="min-w-0 flex-1 truncate text-center text-[15px] font-extrabold">Ver mi pedido{groups.length > 1 ? ` · ${groups.length} comercios` : groups[0] ? ` · ${groups[0].store.nombre}` : ""}</span>
            <span className="font-black">{money(subtotal)}</span>
          </NavLink>
        </div>
      )}

      {!hideNav && (
        <nav className="pb-safe fixed inset-x-0 bottom-0 z-50 grid border-t bg-card/95 backdrop-blur-xl md:hidden" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} aria-label="Secciones">
          {tabs.map(({ to, label, icon: Icon, end }) => (
            <NavLink key={label} to={to} end={end} className={({ isActive }) => cn("group flex min-h-[62px] flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold", isActive ? "text-primary" : "text-muted-foreground")}>
              {({ isActive }) => (<>
                <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", isActive && "bg-primary/10")}><Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.5 : 2} /></span>
                {label}
              </>)}
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
