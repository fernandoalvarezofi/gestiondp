import { useEffect, useState } from "react";
import { Navigate, Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "./ThemeToggle";
import { supabase } from "@/integrations/supabase/client";
import {
  Loader2, Home, Search, Plus, MessageCircle, UserCircle,
  Menu, Rocket, Users, MessageSquare, Bookmark, BarChart3, Settings, Compass, Film, Store, ShoppingBag, Download,
} from "lucide-react";
import { usePresenciaHeartbeat } from "@/hooks/usePresencia";
import { InstallAppCTA } from "@/components/InstallAppCTA";

export function AppLayout() {
  const { session, user, loading } = useAuth();
  const { data: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);
  const [noLeidos, setNoLeidos] = useState(0);
  const [notifSinLeer, setNotifSinLeer] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  usePresenciaHeartbeat();

  const recalcNoLeidos = async () => {
    if (!user) return;
    const { data } = await (supabase as any).rpc("get_mis_conversaciones", { user_id: user.id });
    const total = (data || []).reduce((acc: number, c: any) =>
      acc + (c.perfil_a_id === user.id ? (c.no_leidos_a || 0) : (c.no_leidos_b || 0)), 0);
    setNoLeidos(total);
  };
  const recalcNotif = async () => {
    if (!user) return;
    const { count } = await (supabase as any).from("notificaciones")
      .select("id", { count: "exact", head: true }).eq("perfil_id", user.id).eq("leida", false);
    setNotifSinLeer(count || 0);
  };

  useEffect(() => {
    if (!user) return;
    recalcNoLeidos();
    recalcNotif();
    const ch = (supabase as any).channel("layout-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, recalcNoLeidos)
      .on("postgres_changes", { event: "*", schema: "public", table: "notificaciones", filter: `perfil_id=eq.${user.id}` }, recalcNotif)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user]);

  if (loading || onboardingLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!session) return <Navigate to="/auth" replace />;

  if (onboardingStatus?.needsOnboarding && !onboardingDismissed) {
    return <OnboardingWizard onComplete={() => setOnboardingDismissed(true)} />;
  }

  const linkCls = ({ isActive }: { isActive: boolean }) =>
    `flex flex-col items-center gap-0.5 px-3 py-1 rounded-lg transition-all ${isActive ? "text-foreground" : "text-muted-foreground"}`;

  const secondary = [
    { to: "/lin/mercado", icon: Store, label: "Mercado" },
    { to: "/lin/mis-compras", icon: ShoppingBag, label: "Mis compras" },
    { to: "/lin/explorar", icon: Compass, label: "Explorar" },
    { to: "/lin/reels", icon: Film, label: "Reels" },
    { to: "/lin/proyectos", icon: Rocket, label: "Proyectos" },
    { to: "/lin/comunidades", icon: Users, label: "Comunidades" },
    { to: "/lin/foro", icon: MessageSquare, label: "Foro" },
    { to: "/lin/favoritos", icon: Bookmark, label: "Guardados" },
    { to: "/lin/panel", icon: BarChart3, label: "Mi panel" },
    { to: "/lin/perfil/editar", icon: Settings, label: "Editar perfil" },
  ];

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <div className="sticky top-0 z-30 flex items-center gap-2 border-b border-border/60 bg-background/85 px-4 py-3 backdrop-blur-xl supports-[backdrop-filter]:bg-background/70">
            <div className="hidden md:flex"><SidebarTrigger /></div>
            <Sheet open={menuOpen} onOpenChange={setMenuOpen}>
              <SheetTrigger asChild>
                <button className="rounded-md p-2 hover:bg-secondary md:hidden" aria-label="Menú">
                  <Menu className="h-5 w-5" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-sidebar text-sidebar-foreground border-sidebar-border">
                <div className="mb-6 flex items-center gap-2.5">
                  <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-gradient-ember shadow-ember">
                    <span className="h-1.5 w-1.5 rounded-full bg-white" />
                  </span>
                  <span className="font-display text-xl font-bold tracking-tight">
                    Woref<span className="text-primary">.</span>
                  </span>
                </div>
                <nav className="space-y-1">
                  {secondary.map(({ to, icon: Icon, label }) => (
                    <NavLink
                      key={to}
                      to={to}
                      onClick={() => setMenuOpen(false)}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`
                      }
                    >
                      <Icon className="h-5 w-5" />
                      {label}
                    </NavLink>
                  ))}
                  <div className="my-3 border-t border-sidebar-border" />
                  <div className="px-1 py-1" onClick={() => setMenuOpen(false)}>
                    <InstallAppCTA variant="card" className="!p-4" />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
            <NavLink to="/lin" className="flex items-center gap-2 md:hidden">
              <span className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-ember shadow-ember">
                <span className="h-1 w-1 rounded-full bg-white" />
              </span>
              <span className="font-display text-lg font-bold tracking-tight">
                Woref<span className="text-primary">.</span>
              </span>
            </NavLink>
            <div className="ml-auto flex items-center gap-1">
              <InstallAppCTA variant="icon" />
              <ThemeToggle />
            </div>
          </div>
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-border/60 bg-background/90 backdrop-blur-xl px-2 py-2 pb-[max(env(safe-area-inset-bottom),0.5rem)] shadow-pop md:hidden">
          <NavLink to="/lin" end className={linkCls}>
            {({ isActive }) => (<>
              <Home className={`h-6 w-6 ${isActive ? "fill-primary/10 stroke-primary" : ""}`} />
              <span className={`text-[10px] ${isActive ? "font-semibold text-primary" : ""}`}>Inicio</span>
            </>)}
          </NavLink>
          <NavLink to="/lin/explorar" className={linkCls}>
            {({ isActive }) => (<>
              <Search className={`h-6 w-6 ${isActive ? "stroke-primary" : ""}`} />
              <span className={`text-[10px] ${isActive ? "font-semibold text-primary" : ""}`}>Explorar</span>
            </>)}
          </NavLink>
          <NavLink to="/lin/publicar" className="flex flex-col items-center gap-0.5">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-ember text-primary-foreground shadow-ember ring-2 ring-background">
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </div>
          </NavLink>
          <NavLink to="/lin/mercado" className={linkCls}>
            {({ isActive }) => (<>
              <Store className={`h-6 w-6 ${isActive ? "stroke-primary" : ""}`} />
              <span className={`text-[10px] ${isActive ? "font-semibold text-primary" : ""}`}>Mercado</span>
            </>)}
          </NavLink>
          <NavLink to="/lin/mensajes" className={linkCls}>
            {({ isActive }) => (<>
              <div className="relative">
                <MessageCircle className={`h-6 w-6 ${isActive ? "stroke-primary" : ""}`} />
                {noLeidos > 0 && (
                  <span className="absolute -right-1.5 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-gradient-ember px-1 text-[9px] font-bold text-primary-foreground ring-2 ring-background">
                    {noLeidos > 9 ? "9+" : noLeidos}
                  </span>
                )}
              </div>
              <span className={`text-[10px] ${isActive ? "font-semibold text-primary" : ""}`}>Mensajes</span>
            </>)}
          </NavLink>
          <NavLink to="/lin/perfil" className={linkCls}>
            {({ isActive }) => (<>
              <UserCircle className={`h-6 w-6 ${isActive ? "stroke-primary" : ""}`} />
              <span className={`text-[10px] ${isActive ? "font-semibold text-primary" : ""}`}>Perfil</span>
            </>)}
          </NavLink>
        </nav>
      </div>
    </SidebarProvider>
  );
}
