import { Navigate, Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { Home, Loader2, MapPin, Search, ShoppingBag, Store, UserCircle } from "lucide-react";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";

export function AppLayout() {
  const { session, loading } = useAuth();
  const { itemCount } = useCart();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  return (
    <div className="min-h-screen bg-background pb-20 md:pb-0">
      <header className="sticky top-0 z-40 border-b bg-card/95 backdrop-blur-xl">
        <div className="mx-auto flex h-16 max-w-7xl items-center gap-4 px-4 sm:px-6 lg:px-8">
          <NavLink to="/lin"><DeliveryBrand /></NavLink>
          <button className="hidden items-center gap-2 text-left text-sm font-bold sm:flex"><MapPin className="h-4 w-4 text-primary" /><span><span className="block text-[10px] uppercase text-muted-foreground">Entregar en</span>Av. Corrientes 1234</span></button>
          <NavLink to="/lin/buscar" className="ml-auto hidden h-10 max-w-sm flex-1 items-center gap-2 rounded-md bg-muted px-3 text-sm text-muted-foreground md:flex"><Search className="h-4 w-4" />Buscar restaurantes y productos</NavLink>
          <nav className="ml-auto hidden items-center gap-1 md:flex"><Button asChild variant="ghost"><NavLink to="/lin/pedidos">Pedidos</NavLink></Button><Button asChild variant="ghost"><NavLink to="/lin/comercio">Mi comercio</NavLink></Button><Button asChild variant="ghost" size="icon"><NavLink to="/lin/perfil"><UserCircle className="h-5 w-5" /></NavLink></Button><Button asChild><NavLink to="/lin/carrito"><ShoppingBag className="h-4 w-4" />{itemCount ? `${itemCount} productos` : "Carrito"}</NavLink></Button></nav>
          <Button asChild size="icon" className="ml-auto md:hidden"><NavLink to="/lin/carrito" aria-label="Carrito"><ShoppingBag className="h-5 w-5" />{itemCount > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-deep px-1 text-[10px] text-primary-foreground">{itemCount}</span>}</NavLink></Button>
        </div>
      </header>
      <main><Outlet /></main>
      <nav className="fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 border-t bg-card/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-xl md:hidden">
        {[{to:"/lin",label:"Inicio",icon:Home,end:true},{to:"/lin/buscar",label:"Buscar",icon:Search},{to:"/lin/pedidos",label:"Pedidos",icon:ShoppingBag},{to:"/lin/comercio",label:"Comercio",icon:Store},{to:"/lin/perfil",label:"Perfil",icon:UserCircle}].map(({to,label,icon:Icon,end}) => <NavLink key={to} to={to} end={end} className={({isActive}) => `flex min-h-[62px] flex-col items-center justify-center gap-1 text-[10px] font-bold ${isActive ? "text-primary" : "text-muted-foreground"}`}><Icon className="h-5 w-5" />{label}</NavLink>)}
      </nav>
    </div>
  );
}
