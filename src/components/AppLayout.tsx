import { Suspense } from "react";
import { Navigate, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { Bike, ChevronDown, Heart, Home, Loader2, LogOut, MapPin, Receipt, Search, ShieldCheck, ShoppingBag, Store, UserCircle } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { AddressDialog } from "@/components/delivery/AddressDialog";
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
  { to: "/app/perfil", label: "Perfil", icon: UserCircle },
];

export function AppLayout() {
  const { session, loading, signOut } = useAuth();
  const { itemCount, subtotal, store, address } = useCart();
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
    <div className="min-h-screen bg-background pb-24 md:pb-0">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-3 px-4 sm:px-6 lg:gap-6 lg:px-8">
          <NavLink to="/app" className="shrink-0"><DeliveryBrand compact className="sm:hidden" /><DeliveryBrand className="hidden sm:flex" /></NavLink>

          <AddressDialog
            trigger={
              <button type="button" className="flex min-w-0 items-center gap-1.5 rounded-full px-2 py-1 text-left hover:bg-muted">
                <MapPin className="h-4 w-4 shrink-0 text-primary" />
                <span className="min-w-0">
                  <span className="block text-[10px] font-bold uppercase leading-none text-muted-foreground">Entregar en</span>
                  <span className="block max-w-[150px] truncate text-sm font-bold sm:max-w-[220px]">{address?.direccion || "Elegí tu dirección"}</span>
                </span>
                <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
              </button>
            }
          />

          <NavLink to="/app/buscar" className="hidden h-11 flex-1 items-center gap-2 rounded-full bg-muted px-4 text-sm text-muted-foreground transition-colors hover:bg-muted/70 md:flex lg:max-w-md">
            <Search className="h-4 w-4" />Buscar comercios, platos o productos
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

      <main><Suspense fallback={<div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>}><Outlet /></Suspense></main>

      {showCartBar && (
        <div className="fixed inset-x-0 bottom-[72px] z-40 px-4 md:hidden">
          <NavLink to="/app/carrito" className="flex h-14 items-center justify-between rounded-2xl bg-primary px-4 text-primary-foreground shadow-pop">
            <span className="flex h-8 min-w-8 items-center justify-center rounded-lg bg-white/20 px-2 text-sm font-bold">{itemCount}</span>
            <span className="font-bold">Ver carrito{store ? ` · ${store.nombre}` : ""}</span>
            <span className="font-display font-extrabold">{money(subtotal)}</span>
          </NavLink>
        </div>
      )}

      <nav className="pb-safe fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-card/95 backdrop-blur-xl md:hidden">
        {bottomNav.map(({ to, label, icon: Icon, end }) => (
          <NavLink key={to} to={to} end={end} className={({ isActive }) => cn("flex min-h-[64px] flex-col items-center justify-center gap-1 text-[11px] font-bold", isActive ? "text-primary" : "text-muted-foreground")}>
            <Icon className="h-[22px] w-[22px]" />{label}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}
