import { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { ArrowLeft, ChevronsUpDown, ExternalLink, Home, LogOut, type LucideIcon } from "lucide-react";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Separator } from "@/components/ui/separator";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent, SidebarGroupLabel, SidebarHeader, SidebarInset,
  SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem, SidebarProvider, SidebarRail, SidebarTrigger, useSidebar,
} from "@/components/ui/sidebar";
import { useAuth } from "@/contexts/AuthContext";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { isRootPath, useGoBack } from "@/lib/navigation";
import { cn } from "@/lib/utils";

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
                  {item.badge !== undefined && item.badge !== 0 && <SidebarMenuBadge className="top-2.5 bg-brand-orange text-white">{item.badge}</SidebarMenuBadge>}
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
  const items = groups.flatMap((group) => group.items).filter((item) => !item.hidden);
  // La sección activa es la que mejor coincide con la ruta (la más específica).
  const tabItems = (tabs ? tabs.map((to) => items.find((item) => item.to === to)).filter((item): item is PanelNavItem => Boolean(item)) : items).slice(0, 5);
  const current = [...items].sort((a, b) => b.to.length - a.to.length).find((item) => (item.end ? location.pathname === item.to : location.pathname === item.to || location.pathname.startsWith(`${item.to}/`)));

  return (
    <SidebarProvider>
      <Sidebar collapsible="icon" className="border-r">
        <SidebarHeader className="gap-3 p-3">
          <Link to="/app" aria-label="Volver a Woref" className="flex items-center group-data-[collapsible=icon]:hidden"><DeliveryBrand /></Link>
          <p className="text-[11px] font-extrabold uppercase tracking-wide text-muted-foreground group-data-[collapsible=icon]:hidden">{panel}</p>
          {identity}
        </SidebarHeader>
        <SidebarContent>
          <SidebarNav groups={groups} />
        </SidebarContent>
        <SidebarFooter className="p-2">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton asChild tooltip="Ir a Woref" className="h-10 font-semibold">
                <Link to="/app"><Home className="h-[18px] w-[18px]" /><span>Ir a Woref</span></Link>
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
                <DropdownMenuContent side="top" align="start" className="w-56">
                  <DropdownMenuLabel>Cambiar de panel</DropdownMenuLabel>
                  <DropdownMenuItem onClick={() => navigate("/app/comercio")}>{roles.storeId ? "Panel de mi comercio" : "Sumar mi comercio"}</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/app/repartidor")}>{roles.isCourier ? "Panel de repartidor" : "Quiero ser repartidor"}</DropdownMenuItem>
                  {roles.isAdmin && <DropdownMenuItem onClick={() => navigate("/app/admin")}>Administración</DropdownMenuItem>}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/app/perfil")}>Mi cuenta y direcciones</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => signOut()}><LogOut className="h-4 w-4" />Cerrar sesión</DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarFooter>
        <SidebarRail />
      </Sidebar>

      <SidebarInset className={cn("min-w-0", bottomTabs && "pb-16 md:pb-0")}>
        <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-t-[3px] border-t-brand-orange bg-card/95 px-3 backdrop-blur-xl sm:px-5">
          <SidebarTrigger className="-ml-1" aria-label="Abrir o cerrar el menú" />
          {!isRootPath(location.pathname) && <button type="button" onClick={goBack} aria-label="Volver" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted"><ArrowLeft className="h-5 w-5" /></button>}
          <Separator orientation="vertical" className="mr-1 h-5" />
          <div className="min-w-0 flex-1">
            <h1 className="truncate text-base font-extrabold leading-tight">{current?.label ?? panel}</h1>
            {quickLink && <Link to={quickLink.to} className="hidden items-center gap-1 text-xs font-bold text-primary sm:inline-flex">{quickLink.label}<ExternalLink className="h-3 w-3" /></Link>}
          </div>
          {actions}
        </header>
        <div className="mx-auto w-full max-w-7xl px-3 py-5 sm:px-6 lg:px-8">{children}</div>

        {bottomTabs && (
          <nav className="pb-safe fixed inset-x-0 bottom-0 z-40 grid border-t bg-card md:hidden" style={{ gridTemplateColumns: `repeat(${tabItems.length}, minmax(0, 1fr))` }} aria-label="Secciones">
            {tabItems.map((item) => (
              <NavLink key={item.to} to={item.to} end={item.end} className={({ isActive }) => cn("relative flex min-h-[58px] flex-col items-center justify-center gap-0.5 text-[11px] font-extrabold", isActive ? "text-primary" : "text-muted-foreground")}>
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
