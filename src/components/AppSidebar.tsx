import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Home, PlusSquare, Search as SearchIcon, UserCircle, MessageCircle, Bell, Bookmark,
  LineChart, Settings, LogOut, Rocket, Users, MessagesSquare, Sparkles,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavLink } from "react-router-dom";

const nav = [
  { title: "Feed", icon: Home, to: "/lin", end: true },
  { title: "Publicar", icon: PlusSquare, to: "/lin/publicar" },
  { title: "Buscar", icon: SearchIcon, to: "/lin/buscar" },
  { title: "Match", icon: Sparkles, to: "/lin/match" },
  { title: "Proyectos", icon: Rocket, to: "/lin/proyectos" },
  { title: "Comunidades", icon: Users, to: "/lin/comunidades" },
  { title: "Foro", icon: MessagesSquare, to: "/lin/foro" },
  { title: "Mensajes", icon: MessageCircle, to: "/lin/mensajes" },
  { title: "Notificaciones", icon: Bell, to: "/lin/notificaciones" },
  { title: "Guardados", icon: Bookmark, to: "/lin/favoritos" },
  { title: "Mi panel", icon: LineChart, to: "/lin/panel" },
  { title: "Mi perfil", icon: UserCircle, to: "/lin/perfil" },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const { data: profile } = useQuery({
    queryKey: ["sidebar-perfil", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("perfiles").select("avatar_url, nombre, username").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  return (
    <Sidebar className="hidden md:flex">
      <SidebarHeader className="p-4">
        <NavLink to="/" className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-primary" />
          <span className="text-lg font-bold tracking-tight text-sidebar-foreground">Woref</span>
        </NavLink>
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup><SidebarGroupContent><SidebarMenu>
          {nav.map((item) => (
            <SidebarMenuItem key={item.title}>
              <SidebarMenuButton asChild>
                <NavLink to={item.to} end={item.end}
                  className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}>
                  <item.icon className="h-4 w-4" /><span>{item.title}</span>
                </NavLink>
              </SidebarMenuButton>
            </SidebarMenuItem>
          ))}
        </SidebarMenu></SidebarGroupContent></SidebarGroup>
      </SidebarContent>

      <SidebarFooter className="space-y-2 p-4">
        <SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton asChild><NavLink to="/lin/perfil/editar"><Settings className="h-4 w-4" /><span>Configuración</span></NavLink></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton onClick={signOut}><LogOut className="h-4 w-4" /><span>Cerrar sesión</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu>
        {user && (
          <div className="flex items-center gap-2 px-2">
            <Avatar className="h-6 w-6"><AvatarImage src={profile?.avatar_url || ""} className="object-cover" /><AvatarFallback className="text-[10px]">{(profile?.nombre || user.email || "U").slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
            <p className="truncate text-xs text-sidebar-foreground/60">{profile?.username ? `@${profile.username}` : user.email}</p>
          </div>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
