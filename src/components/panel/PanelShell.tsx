import { ReactNode, useEffect } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronsUpDown, ExternalLink, Home, LogOut, UserCircle, type LucideIcon } from "lucide-react";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { NotificationBell } from "@/components/delivery/NotificationBell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { isRootPath, useGoBack } from "@/lib/navigation";
import { cn } from "@/lib/utils";
import { ContextMenuItems } from "@/navigation/ContextSwitcher";
import { contextById, contextFromPath, rememberContext } from "@/navigation/contexts";

export type PanelNavItem = { to: string; label: string; /** Nombre corto para la barra de abajo del celular. */ short?: string; icon: LucideIcon; end?: boolean; badge?: number | string; hidden?: boolean };
export type PanelNavGroup = { label?: string; items: PanelNavItem[] };

type Props = {
  /** Nombre del panel: "Panel del comercio", "Repartidores", "Administración". */
  panel: string;
  /** Bloque de identidad arriba de la barra (logo y nombre del comercio, estado del repartidor…). */
  identity?: ReactNode;
  groups: PanelNavGroup[];
  /** Acciones a la derecha de la barra superior (estado del local, conexión…). */
  actions?: ReactNode;
  /** Enlace "ver como cliente" u otro acceso rápido debajo del título. */
  quickLink?: { to: string; label: string };
  /** En el celular, muestra opciones como barra inferior (útil para el repartidor y el comercio). */
  bottomTabs?: boolean;
  /** Rutas que van en la barra inferior (por defecto, las primeras 5). */
  tabs?: string[];
  children: ReactNode;
};

function SidebarNav({ groups }: { groups: PanelNavGroup[] }) {
  const { setOpenMobile } = useSidebar();
  return (
    <>
      {groups.map((group, index) => (
        <SidebarGroup key={group.label ?? index}>
          {group.label && <SidebarGroupLabel>{group.label}</SidebarGroupLabel>}
          <SidebarGroupContent>
            <SidebarMenu>
              {group.items.filter((item) => !item.hidden).map((item) => (
                <SidebarMenuItem key={item.to}>
                  <NavLink to={item.to} end={item.end} onClick={() => setOpenMobile(false)} className="block">
                    {({ isActive }) => (
                      <SidebarMenuButton asChild isActive={isActive} tooltip={item.label} className="h-10 font-semibold">
                        <span><item.icon className="h-[18px] w-[18px]" /><span>{item.label}</span></span>
                      </SidebarMenuButton>
                    )}
                  </NavLink>
                  {item.badge !== undefined && item.badge !== 0 && <SidebarMenuBadge className="top-2.5 bg-brand-yellow text-brand-yellow-foreground">{item.badge}</SidebarMenuBadge>}
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      ))}
    </>
  );
}

/**
 * Estructura común de los paneles (comercio, repartidor, administración): barra lateral con secciones,
 * barra superior con el título de la sección y, en el celular, el menú se abre como cajón.
 */
export function PanelShell({ panel, identity, groups, actions, quickLink, bottomTabs, tabs, children }: Props) {
  const location = useLocation();
  const navigate = useNavigate();
  const { signOut } = useAuth();
  const roles = useDeliveryRoles();
  const goBack = useGoBack();
  // Contexto de trabajo actual; se recuerda para que la app instalada abra directo en él.
  const context = contextById(contextFromPath(location.pathname));
  useEffect(() => { rememberContext(context.id); }, [context.id]);
  const items = groups.flatMap((group) => group.items).filter((item) => !item.hidden);
  // La sección activa es la que mejor coincide con la ruta (la más específica).
  const tabItems = (tabs ? tabs.map((to) => items.find((item) => item.to === to)).filter((item): item is PanelNavItem => Boolean(item)) : items).slice(0, 5);
  const current = [...items].sort((a, b) => b.to.length - a.to.length).find((item) => (item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)));

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" variant="floating">
        <SidebarHeader className="gap-3 p-3">
          <Link to="/app" aria-label="Volver a Woref" className="flex items-center group-data-[collapsible=icon]:hidden"><DeliveryBrand /></Link>
          <p className="flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden"><context.icon className="h-3.5 w-3.5 text-primary" aria-hidden />{panel}</p>
          {identity}
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav groups={groups} />
        </SidebarContent>
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Comprar como cliente" className="h-10 font-semibold">
                <Link to="/app"><Home className="h-[18px] w-[18px]" /><span>Comprar como cliente</span></Link>
              </SidebarMenuButton>
            </SidebarMenuItem>
            <SidebarMenuItem>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <SidebarMenuButton size="lg" className="h-12" tooltip={roles.nombre || "Mi cuenta"}>
                    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/10 text-sm font-black uppercase text-primary">{(roles.nombre || "?").slice(0, 1)}</span>
                    <span className="min-w-0 flex-1 text-left leading-tight"><span className="block truncate text-sm font-bold">{roles.nombre || "Mi cuenta"}</span><span className="block text-[11px] text-muted-foreground">Mi cuenta</span></span>
                    <ChevronsUpDown className="h-4 w-4 shrink-0 text-muted-foreground" />
                  </SidebarMenuButton>
                </DropdownMenuTrigger>
                <DropdownMenuContent side="top" align="start" className="w-64">
                  <ContextMenuItems />
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/perfil")}><UserCircle className="h-4 w-4" />Mi cuenta y direcciones</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}><LogOut className="h-4 w-4" />Cerrar sesión</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className={cn("min-w-0 bg-transparent", bottomTabs && "pb-24 md:pb-0")}>
        <header className="glass glass-strong sticky top-2 z-30 mx-2 mt-2 flex h-14 items-center gap-2 rounded-2xl px-3 sm:px-4 md:mr-3">
          <SidebarTrigger className="-ml-1" aria-label="Abrir o cerrar el menú" />
          {!isRootPath(location.pathname) && <button type="button" onClick={goBack} aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>}
          <Separator orientation="vertical" className="mr-1 h-5" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-extrabold leading-tight">{current?.label ?? panel}</h1>
            {quickLink && <Link to={quickLink.to} className="hidden items-center gap-1 text-xs font-bold text-primary sm:inline-flex">{quickLink.label}<ExternalLink className="h-3 w-3" /></Link>}
          </div>
          {actions}
          <NotificationBell />
        </header>
        <div className="glass mx-2 mb-3 mt-3 min-h-[calc(100svh-6rem)] rounded-[1.75rem] md:mr-3"><div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 lg:px-8">{children}</div></div>

        {bottomTabs && (
          <nav className="glass glass-strong fixed inset-x-3 bottom-[max(0.75rem,env(safe-area-inset-bottom))] z-40 grid rounded-full p-1 md:hidden" style={{ gridTemplateColumns: `repeat(${tabItems.length}, minmax(0, 1fr))` }} aria-label="Secciones">
            {tabItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn("relative flex min-h-[54px] flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-extrabold transition-colors", isActive ? "bg-primary text-primary-foreground shadow-[0_8px_22px_-8px_hsl(163_56%_42%/0.8)]" : "text-muted-foreground")}>
                <item.icon className="h-5 w-5" />
                <span className="max-w-full truncate px-1 text-[10.5px] leading-tight">{item.short ?? item.label}</span>
                {item.badge !== undefined && item.badge !== 0 && <span className="absolute right-[22%] top-1.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-bold text-primary-foreground">{item.badge}</span>}
              </NavLink>
            ))}
          </nav>
        )}
      </SidebarInset>
    </SidebarProvider>
  );
}
