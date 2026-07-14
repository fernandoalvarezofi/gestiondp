import { useAuth } from "@/contexts/AuthContext";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useEffect, useState } from "react";
import {
  Home, Compass, Play, Rocket, Store, Users, MessageCircle, Bell, UserCircle,
  Settings, LogOut, Plus, Film, BarChart3, Bookmark, FolderOpen, UserPlus, Scissors,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarHeader, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@/components/ui/sidebar";
import { NavLink, useLocation } from "react-router-dom";


type NavItem = {
  title: string;
  icon: any;
  to: string;
  end?: boolean;
  badgeKey?: "msg" | "notif";
};

const GROUPS: { label: string; items: NavItem[] }[] = [
  {
    label: "Descubrir",
    items: [
      { title: "Feed", icon: Home, to: "/lin", end: true },
      { title: "Explorar", icon: Compass, to: "/lin/explorar" },
      { title: "Conectar", icon: UserPlus, to: "/lin/conectar" },
    ],

  },
  {
    label: "Construir",
    items: [
      { title: "Proyectos", icon: Rocket, to: "/lin/proyectos" },
      { title: "Editor video", icon: Scissors, to: "/lin/editor" },
      { title: "Mercado", icon: Store, to: "/lin/mercado" },
      { title: "Comunidad", icon: Users, to: "/lin/hub" },
    ],
  },
  {
    label: "Yo",
    items: [
      { title: "Mensajes", icon: MessageCircle, to: "/lin/mensajes", badgeKey: "msg" },
      { title: "Notificaciones", icon: Bell, to: "/lin/notificaciones", badgeKey: "notif" },
      { title: "Mi perfil", icon: UserCircle, to: "/lin/perfil" },
      { title: "Mis proyectos", icon: FolderOpen, to: "/lin/proyectos?tab=mios" },
      { title: "Mi panel", icon: BarChart3, to: "/lin/panel" },
      { title: "Guardados", icon: Bookmark, to: "/lin/favoritos" },
    ],
  },
];

export function AppSidebar() {
  const { signOut, user } = useAuth();
  const location = useLocation();
  const isHome = location.pathname === "/lin";
  const { data: profile } = useQuery({
    queryKey: ["sidebar-perfil", user?.id],
    queryFn: async () => {
      const { data } = await (supabase as any).from("perfiles").select("avatar_url, nombre, username, bio, actualmente, tipo, portada_url, total_seguidores, total_publicaciones").eq("id", user!.id).single();
      return data;
    },
    enabled: !!user,
  });

  const [unreadNotif, setUnreadNotif] = useState(0);
  const [unreadMsg, setUnreadMsg] = useState(0);

  useEffect(() => {
    if (!user) return;
    const cargar = async () => {
      const [{ count: n }, { data: conv }] = await Promise.all([
        (supabase as any).from("notificaciones").select("id", { count: "exact", head: true }).eq("perfil_id", user.id).eq("leida", false),
        (supabase as any).from("conversaciones").select("perfil_a_id,perfil_b_id,no_leidos_a,no_leidos_b").or(`perfil_a_id.eq.${user.id},perfil_b_id.eq.${user.id}`),
      ]);
      setUnreadNotif(n || 0);
      const total = (conv || []).reduce((sum: number, c: any) => sum + (c.perfil_a_id === user.id ? c.no_leidos_a : c.no_leidos_b), 0);
      setUnreadMsg(total);
    };
    cargar();
    const ch = (supabase as any).channel("sidebar-badges")
      .on("postgres_changes", { event: "*", schema: "public", table: "notificaciones", filter: `perfil_id=eq.${user.id}` }, cargar)
      .on("postgres_changes", { event: "*", schema: "public", table: "conversaciones" }, cargar)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user]);

  const badge = (key?: "msg" | "notif") => {
    const v = key === "msg" ? unreadMsg : key === "notif" ? unreadNotif : 0;
    if (!v) return null;
    return (
      <span className="ml-auto inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1.5 text-[10px] font-bold text-primary-foreground">
        {v > 99 ? "99+" : v}
      </span>
    );
  };

  return (
    <Sidebar className="hidden border-r-0 md:flex">
      <SidebarHeader className="px-3 pb-2 pt-3">
        {profile && (
          <NavLink
            to="/lin/perfil"
            className="mb-2 flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-sidebar-accent/40"
          >
            <Avatar className="h-9 w-9 ring-1 ring-sidebar-border">
              <AvatarImage src={profile.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="text-[11px]">
                {(profile.nombre || user?.email || "U").slice(0, 2).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-semibold leading-tight">{profile.nombre}</p>
              <p className="truncate text-[11px] text-sidebar-foreground/60">
                {profile.actualmente || profile.tipo || `@${profile.username || ""}`}
              </p>
            </div>
          </NavLink>
        )}
        <NavLink
          to="/lin/publicar"
          className="inline-flex w-full items-center justify-center gap-1.5 rounded-xl bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground shadow-ember transition-transform hover:scale-[1.02]"
        >
          <Plus className="h-4 w-4" /> Publicar
        </NavLink>
      </SidebarHeader>


      <SidebarContent>
        {GROUPS.map((group, gi) => (
          <SidebarGroup key={group.label}>
            <p className="px-3 mt-4 mb-1 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {group.label}
            </p>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => (
                  <SidebarMenuItem key={item.title}>
                    <SidebarMenuButton asChild>
                      <NavLink to={item.to} end={item.end}
                        className={({ isActive }) => isActive ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium" : ""}>
                        <item.icon className="h-4 w-4" /><span>{item.title}</span>
                        {badge(item.badgeKey)}
                      </NavLink>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
            {gi < GROUPS.length - 1 && <div className="mx-3 mt-3 h-px bg-border" />}
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="space-y-2 p-3">
        <SidebarMenu>
          <SidebarMenuItem><SidebarMenuButton asChild><NavLink to="/lin/configuracion"><Settings className="h-4 w-4" /><span>Configuración</span></NavLink></SidebarMenuButton></SidebarMenuItem>
          <SidebarMenuItem><SidebarMenuButton onClick={signOut}><LogOut className="h-4 w-4" /><span>Cerrar sesión</span></SidebarMenuButton></SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
