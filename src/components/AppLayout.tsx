import { Suspense, useEffect, useState } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bike, ChevronDown, Heart, Home, Loader2, LogOut, MapPin, Receipt, Search, ShieldCheck, ShoppingBag, Store, UserCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { AppFooter } from "@/components/delivery/AppFooter";
import { AddressDialog, toCartAddress, useSavedAddresses } from "@/components/delivery/AddressDialog";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const bottomNav = [
  { to: "/app", label: "Inicio", icon: Home, end: true },
  { to: "/app/buscar", label: "Buscar", icon: Search },
  { to: "/app/pedidos", label: "Pedidos", icon: Receipt },
  { to: "/app/favoritos", label: "Favoritos", icon: Heart },
  { to: "/app/perfil", label: "Cuenta", icon: UserCircle },
];

export function AppLayout() {
  const { session, loading, signOut } = useAuth();
  const { itemCount, subtotal, store, address, setAddress } = useCart();
  const { addresses, loading: addressesLoading } = useSavedAddresses();
  const [gateOpen, setGateOpen] = useState(false);
  const [gateAsked, setGateAsked] = useState(false);

  // Si todavía no eligió dirección, usamos la guardada (preferimos una con ubicación en el mapa).
  useEffect(() => {
    if (address || !addresses.length) return;
    const located = addresses.filter((item) => item.latitud != null);
    const preferred = located.find((item) => item.predeterminada) || located[0] || addresses[0];
    setAddress(toCartAddress(preferred));
  }, [address, addresses, setAddress]);
  // Primera vez sin ninguna dirección: pedimos la ubicación apenas entra (una sola vez por sesión).
  useEffect(() => {
    if (!session || addressesLoading || address || addresses.length || gateAsked) return;
    setGateAsked(true);
    setGateOpen(true);
  }, [session, addressesLoading, address, addresses.length, gateAsked]);
  const roles = useDeliveryRoles();
  const location = useLocation();
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace state={{ from: location.pathname }} />;

  const inPanel = /^\/app\/(comercio|repartidor|admin)/.test(location.pathname);
  const showCartBar = itemCount > 0 && !inPanel && !location.pathname.startsWith("/app/carrito") && !location.pathname.startsWith("/app/pedidos/");

  return (
    <div className={cn("min-h-screen bg-background", !inPanel && "pb-24 md:pb-0")}>
      {inPanel && (
        <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-xl">
          <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:px-8">
            <NavLink to="/app" className="shrink-0" aria-label="Volver a Woref"><DeliveryBrand /></NavLink>
            <span className="hidden rounded-full bg-muted px-3 py-1 text-xs font-extrabold uppercase tracking-wide text-muted-foreground sm:inline">
              {location.pathname.startsWith("/app/comercio") ? "Panel del comercio" : location.pathname.startsWith("/app/repartidor") ? "Panel de repartidor" : "Administración"}
            </span>
            <div className="ml-auto flex items-center gap-1">
              <Button asChild variant="ghost" size="sm" className="rounded-full font-bold"><NavLink to="/app"><Home className="h-4 w-4" /><span className="hidden sm:inline">Ir a Woref</span></NavLink></Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="sm" className="rounded-full font-bold"><UserCircle className="h-5 w-5" /><span className="max-w-[110px] truncate">{roles.nombre.split(" ")[0] || "Mi cuenta"}</span><ChevronDown className="h-4 w-4" /></Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-56">
                  <DropdownMenuLabel>Cambiar de panel</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate("/app/comercio")}><Store className="h-4 w-4" />{roles.storeId ? "Panel de mi comercio" : "Sumar mi comercio"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/repartidor")}><Bike className="h-4 w-4" />{roles.isCourier ? "Panel de repartidor" : "Quiero ser repartidor"}</DropdownMenuItem>
                  {roles.isAdmin && <DropdownMenuItem onClick={() => navigate("/app/admin")}><ShieldCheck className="h-4 w-4" />Administración</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/perfil")}><UserCircle className="h-4 w-4" />Mi cuenta</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}><LogOut className="h-4 w-4" />Cerrar sesión</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          </div>
        </header>
      )}
      {!inPanel && (
      <header className="sticky top-0 z-40 border-b bg-card/95 shadow-[0_1px_0_rgba(0,0,0,0.02)] backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
          <NavLink to="/app" className="hidden shrink-0 md:block" aria-label="Inicio"><DeliveryBrand /></NavLink>

          <AddressDialog
            trigger={
              <button type="button" className="-ml-2 flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1.5 text-left hover:bg-muted md:ml-0">
                <MapPin className="h-5 w-5 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-[11px] font-bold leading-none text-muted-foreground">Entregar en</span>
                  <span className="block max-w-[200px] truncate text-[15px] font-extrabold sm:max-w-[240px]">{address?.direccion || "Elegí tu dirección"}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-primary" />
              </button>
            }
          />

          <NavLink to="/app/buscar" className="hidden h-11 flex-1 items-center gap-2 rounded-full border bg-background px-4 text-sm font-semibold text-muted-foreground transition-colors hover:border-primary/40 md:flex lg:max-w-md">
            <Search className="h-4 w-4 text-foreground" />Buscar locales, platos y productos
          </NavLink>

          <nav className="ml-auto hidden items-center gap-1 md:flex">
            <Button asChild variant="ghost" className="rounded-full font-bold"><NavLink to="/app/pedidos"><Receipt className="h-4 w-4" />Pedidos</NavLink></Button>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="rounded-full font-bold"><UserCircle className="h-5 w-5" /><span className="max-w-[120px] truncate">{roles.nombre.split(" ")[0] || "Mi cuenta"}</span><ChevronDown className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>Mi cuenta</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate("/app/perfil")}><UserCircle className="h-4 w-4" />Perfil y direcciones</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/app/favoritos")}><Heart className="h-4 w-4" />Favoritos</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/app/promociones")}><ShoppingBag className="h-4 w-4" />Cupones y promociones</DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuLabel>Paneles</DropdownMenuLabel>
                <DropdownMenuItem onClick={() => navigate("/app/comercio")}><Store className="h-4 w-4" />{roles.storeId ? "Panel de mi comercio" : "Sumar mi comercio"}</DropdownMenuItem>
                <DropdownMenuItem onClick={() => navigate("/app/repartidor")}><Bike className="h-4 w-4" />{roles.isCourier ? "Panel de repartidor" : "Quiero ser repartidor"}</DropdownMenuItem>
                {roles.isAdmin && <DropdownMenuItem onClick={() => navigate("/app/admin")}><ShieldCheck className="h-4 w-4" />Administración</DropdownMenuItem>}
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={() => signOut()}><LogOut className="h-4 w-4" />Cerrar sesión</DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            <Button asChild className="rounded-full font-bold">
              <NavLink to="/app/carrito"><ShoppingBag className="h-4 w-4" />{itemCount ? `${itemCount} · ${money(subtotal)}` : "Carrito"}</NavLink>
            </Button>
          </nav>

          <NavLink to="/app/carrito" aria-label="Carrito" className="relative ml-auto flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary md:hidden">
            <ShoppingBag className="h-5 w-5" />
            {itemCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 animate-pop-in items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{itemCount}</span>}
          </NavLink>
        </div>
      </header>
      )}

      <AddressDialog open={gateOpen} onOpenChange={setGateOpen} title="¿Dónde estás?" />

      <main className={inPanel ? "min-h-[calc(100vh-3.5rem)]" : "min-h-[calc(100vh-4rem)]"}><Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}><Outlet /></Suspense></main>
      {!inPanel && <AppFooter />}

      {showCartBar && (
        <div className="fixed inset-x-0 bottom-[72px] z-40 px-4 md:hidden">
          <NavLink to="/app/carrito" className="flex h-14 items-center justify-between gap-3 rounded-2xl bg-primary px-4 text-primary-foreground shadow-pop">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-full bg-white px-2 text-sm font-black text-primary">{itemCount}</span>
            <span className="min-w-0 flex-1 truncate text-center text-[15px] font-extrabold">Ver mi pedido{store ? ` · ${store.nombre}` : ""}</span>
            <span className="font-black">{money(subtotal)}</span>
          </NavLink>
        </div>
      )}

      {!inPanel && <nav className="pb-safe fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-card/95 backdrop-blur-xl md:hidden">
        {bottomNav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("group flex min-h-[62px] flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold", isActive ? "text-primary" : "text-muted-foreground")}>
            {({ isActive }) => (<>
              <span className={cn("flex h-8 w-14 items-center justify-center rounded-full transition-colors", isActive && "bg-primary/10")}><Icon className="h-[22px] w-[22px]" strokeWidth={isActive ? 2.5 : 2} /></span>
              {label}
            </>)}
          </NavLink>
        ))}
      </nav>}
    </div>
  );
}
