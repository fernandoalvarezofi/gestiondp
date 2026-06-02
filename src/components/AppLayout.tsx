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
  Loader2, Home, Compass, Plus, MessageCircle, UserCircle,
  Menu, Rocket, Users, Bookmark, BarChart3, Settings, Film, Store, ShoppingBag, Bell,
} from "lucide-react";
import { usePresenciaHeartbeat } from "@/hooks/usePresencia";
import { InstallAppCTA } from "@/components/InstallAppCTA";
import ChatDock from "@/components/lin/ChatDock";
import { WorefLogo } from "@/components/lin/WorefLogo";

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
    `min-h-[44px] flex flex-col items-center justify-center gap-0.5 px-3 py-1 rounded-lg transition-all ${isActive ? "text-foreground" : "text-muted-foreground"}`;

  const sheetGroups: { label: string; items: { to: string; icon: any; label: string }[] }[] = [
    {
      label: "Construir",

      items: [
        { to: "/lin/proyectos", icon: Rocket, label: "Proyectos" },
        { to: "/lin/mercado", icon: Store, label: "Mercado" },
        { to: "/lin/hub", icon: Users, label: "Comunidad" },
      ],
    },
    {
      label: "Mi cuenta",
      items: [
        { to: "/lin/notificaciones", icon: Bell, label: "Notificaciones" },
        { to: "/lin/proyectos?tab=mios", icon: Rocket, label: "Mis proyectos" },
        { to: "/lin/favoritos", icon: Bookmark, label: "Guardados" },
        { to: "/lin/mis-compras", icon: ShoppingBag, label: "Mis compras" },
        { to: "/lin/panel", icon: BarChart3, label: "Mi panel" },
        { to: "/lin/perfil/editar", icon: Settings, label: "Editar perfil" },
      ],
    },
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
              <SheetContent side="left" className="w-72 overflow-y-auto bg-sidebar text-sidebar-foreground border-sidebar-border">
                <div className="mb-6 flex items-center gap-2.5">
                  <WorefLogo variant="full" size={22} />
                </div>
                <nav>
                  {sheetGroups.map((group, gi) => (
                    <div key={group.label}>
                      <p className="px-3 mt-4 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                        {group.label}
                      </p>
                      <div className="space-y-0.5">
                        {group.items.map(({ to, icon: Icon, label }) => (
                          <NavLink
                            key={to}
                            to={to}
                            onClick={() => setMenuOpen(false)}
                            className={({ isActive }) =>
                              `flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-[44px] text-sm transition-colors ${isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"}`
                            }
                          >
                            <Icon className="h-5 w-5" />
                            {label}
                          </NavLink>
                        ))}
                      </div>
                      {gi < sheetGroups.length - 1 && <div className="mx-3 mt-3 h-px bg-border" />}
                    </div>
                  ))}
                  <div className="mt-6 px-1 py-1" onClick={() => setMenuOpen(false)}>
                    <InstallAppCTA variant="card" className="!p-4" />
                  </div>
                </nav>
              </SheetContent>
            </Sheet>
            <NavLink to="/lin" className="flex items-center gap-2 md:hidden">
              <WorefLogo variant="full" size={20} />
            </NavLink>
            <div className="ml-auto flex items-center gap-1">
              <InstallAppCTA variant="icon" />
              <ThemeToggle />
            </div>
          </div>
          <div className="px-0 pt-0 pb-0 md:p-6">
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
              <Compass className={`h-6 w-6 ${isActive ? "stroke-primary" : ""}`} />
              <span className={`text-[10px] ${isActive ? "font-semibold text-primary" : ""}`}>Explorar</span>
            </>)}
          </NavLink>
          <NavLink to="/lin/publicar" className="min-h-[44px] flex flex-col items-center justify-center" aria-label="Publicar">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-ember ring-2 ring-background">
              <Plus className="h-5 w-5" strokeWidth={2.5} />
            </div>
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

        <ChatDock />
      </div>
    </SidebarProvider>
  );
}
