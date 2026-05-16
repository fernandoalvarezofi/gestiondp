import { useState } from "react";
import { Navigate, Outlet, NavLink } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useOnboardingStatus } from "@/hooks/useOnboardingStatus";
import { OnboardingWizard } from "@/components/onboarding/OnboardingWizard";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { ThemeToggle } from "./ThemeToggle";
import { Loader2, Home, Search, Plus, MessageCircle, UserCircle } from "lucide-react";

export function AppLayout() {
  const { session, loading } = useAuth();
  const { data: onboardingStatus, isLoading: onboardingLoading } = useOnboardingStatus();
  const [onboardingDismissed, setOnboardingDismissed] = useState(false);

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
    isActive
      ? "flex flex-col items-center gap-0.5 text-primary"
      : "flex flex-col items-center gap-0.5 text-muted-foreground";

  return (
    <SidebarProvider>
      <div className="flex min-h-screen w-full">
        <AppSidebar />
        <main className="flex-1 overflow-auto pb-20 md:pb-0">
          <div className="hidden items-center gap-2 px-4 py-3 md:flex">
            <SidebarTrigger />
            <div className="ml-auto flex items-center gap-2">
              <ThemeToggle />
            </div>
          </div>
          <div className="p-4 md:p-6">
            <Outlet />
          </div>
        </main>

        <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t bg-background/95 backdrop-blur px-2 py-2 md:hidden">
          <NavLink to="/lin" end className={linkCls}>
            <Home className="h-6 w-6" />
            <span className="text-[10px]">Inicio</span>
          </NavLink>
          <NavLink to="/lin/buscar" className={linkCls}>
            <Search className="h-6 w-6" />
            <span className="text-[10px]">Buscar</span>
          </NavLink>
          <NavLink to="/lin/publicar" className="flex flex-col items-center gap-0.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg">
              <Plus className="h-5 w-5" />
            </div>
          </NavLink>
          <NavLink to="/lin/mensajes" className={linkCls}>
            <MessageCircle className="h-6 w-6" />
            <span className="text-[10px]">Mensajes</span>
          </NavLink>
          <NavLink to="/lin/perfil" className={linkCls}>
            <UserCircle className="h-6 w-6" />
            <span className="text-[10px]">Perfil</span>
          </NavLink>
        </nav>
      </div>
    </SidebarProvider>
  );
}
