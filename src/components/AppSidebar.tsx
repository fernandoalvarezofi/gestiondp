import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Home,
  PlusSquare,
  Search as SearchIcon,
  UserCircle,
  MessageCircle,
  Bell,
  Bookmark,
  LineChart,
  Settings,
  LogOut,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavLink } from "react-router-dom";

const linNav = [
  { title: "Inicio", icon: Home, to: "/lin" },
  { title: "Publicar", icon: PlusSquare, to: "/lin/publicar" },
  { title: "Buscar", icon: SearchIcon, to: "/lin/buscar" },
  { title: "Mensajes", icon: MessageCircle, to: "/lin/mensajes" },
  { title: "Notificaciones", icon: Bell, to: "/lin/notificaciones" },
  { title: "Favoritos", icon: Bookmark, to: "/lin/favoritos" },
  { title: "Mi panel", icon: LineChart, to: "/lin/panel" },
  { title: "Mi perfil", icon: UserCircle, to: "/lin/perfil" },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();

  const { data: profile } = useQuery({
    queryKey: ["profile-sidebar", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("perfiles").select("avatar_url, nombre").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  return (
    <Sidebar>
      <SidebarHeader className="p-4">
        <NavLink to="/" className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-green-500" />
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">
            Linqueño
          </span>
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              {linNav.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.to}
                      end={item.to === "/lin"}
                      className={({ isActive }) =>
                        isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""
                      }
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="p-4 space-y-2">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton asChild>
              <NavLink to="/lin/perfil/editar">
                <Settings className="h-4 w-4" />
                <span>Configuración</span>
              </NavLink>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton onClick={signOut}>
              <LogOut className="h-4 w-4" />
              <span>Cerrar sesión</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
        {user && (
          <div className="flex items-center gap-2 px-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={profile?.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="text-[10px]">{(profile?.nombre || user.email || "U").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <p className="truncate text-xs text-sidebar-foreground/60">
              {profile?.nombre || user.email}
            </p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
