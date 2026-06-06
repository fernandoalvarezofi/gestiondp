import { useEffect, useMemo, useState } from "react";
import { Link, NavLink } from "react-router-dom";
import {
  Search, Sparkles, Users, Image as ImageIcon, BarChart3 as BarChart3Icon, Loader2, Flame,
  Home, UserCircle, Compass, MessageCircle, Bell, Rocket, ShoppingBag, Bookmark,
  FileText, CalendarDays, Users2, Settings, LogOut, UserPlus, BadgeCheck,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PostCard } from "@/components/lin/PostCard";
import { FeedRail } from "@/components/lin/FeedRail";
import { initials } from "@/lib/worefHelpers";
import { toast } from "sonner";

const FILTROS = [
  { key: "all", label: "Para vos" },
  { key: "update", label: "Updates" },
  { key: "proyecto", label: "Proyectos" },
  { key: "oportunidad", label: "Oportunidades" },
  { key: "hiring", label: "Hiring" },
  { key: "logro", label: "Logros" },
  { key: "lanzamiento", label: "Lanzamientos" },
  { key: "busco_socio", label: "Busco socio" },
  { key: "recurso", label: "Recursos" },
];

const SELECT = `id,tipo,formato,titulo,cuerpo,imagen_url,video_url,thumbnail_url,
  encuesta_opciones,rol_buscado,modalidad,pais,tags,
  vistas,total_likes,total_comentarios,total_repostes,destacada,estado,created_at,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url,tipo,verificado),
  media:media_publicacion(url,es_portada,orden)`;

const NAV_ITEMS = [
  { icon: Home, label: "Inicio", to: "/lin", end: true },
  { icon: UserCircle, label: "Perfil", to: "/lin/perfil" },
  { icon: Users2, label: "Mi red", to: "/lin/conectar" },
  { icon: Compass, label: "Explorar", to: "/lin/explorar" },
  { icon: MessageCircle, label: "Mensajes", to: "/lin/mensajes" },
  { icon: Bell, label: "Notificaciones", to: "/lin/notificaciones" },
  { icon: Rocket, label: "Proyectos", to: "/lin/proyectos" },
  { icon: Users, label: "Comunidad", to: "/lin/hub" },
  { icon: ShoppingBag, label: "Mercado", to: "/lin/mercado" },
  { icon: BarChart3Icon, label: "Mi panel", to: "/lin/panel" },
  { icon: Bookmark, label: "Guardados", to: "/lin/favoritos" },
];

export default function Feed() {
  const { user, signOut } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<"para-vos" | "siguiendo" | "tendencias">("para-vos");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [seguidos, setSeguidos] = useState<string[]>([]);
  const [miPerfil, setMiPerfil] = useState<any>(null);
  const [sugeridos, setSugeridos] = useState<any[]>([]);
  const [solicitudesEnviadas, setSolicitudesEnviadas] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      let data: any[] = [];
      if (tab === "para-vos" && user) {
        const { data: ranked } = await (supabase as any).rpc("obtener_feed_ranked", { p_perfil_id: user.id, p_limit: 60 });
        const ids = (ranked || []).map((r: any) => r.id);
        if (ids.length) {
          const { data: rows } = await (supabase as any).from("publicaciones").select(SELECT).in("id", ids);
          const order: Record<string, number> = Object.fromEntries(ids.map((id: string, i: number) => [id, i]));
          data = (rows || []).sort((a: any, b: any) => order[a.id] - order[b.id]);
        }
      } else if (tab === "tendencias") {
        const desde = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
        const r = await (supabase as any).from("publicaciones").select(SELECT)
          .eq("estado", "activa").gte("created_at", desde).limit(120);
        data = (r.data || []).map((p: any) => ({
          ...p,
          _score: (p.total_likes || 0) * 1 + (p.total_comentarios || 0) * 2 + (p.total_repostes || 0) * 3 + (p.vistas || 0) * 0.05,
        })).sort((a: any, b: any) => b._score - a._score).slice(0, 60);
      }
      if (!data.length) {
        const r = await (supabase as any).from("publicaciones").select(SELECT)
          .eq("estado", "activa")
          .order("destacada", { ascending: false })
          .order("created_at", { ascending: false }).limit(60);
        data = r.data || [];
      }
      setItems(data);
      setLoading(false);
    })();
    if (user) {
      (async () => {
        const [{ data: s }, { data: p }] = await Promise.all([
          (supabase as any).from("seguidos").select("seguido_id").eq("seguidor_id", user.id),
          (supabase as any).from("perfiles").select("id,nombre,username,avatar_url,bio,actualmente,tipo,portada_url,total_seguidores,total_publicaciones").eq("id", user.id).maybeSingle(),
        ]);
        const seguidosIds = (s || []).map((d: any) => d.seguido_id);
        setSeguidos(seguidosIds);
        setMiPerfil(p);

        const { data: sug } = await (supabase as any)
          .from("perfiles")
          .select("id,nombre,username,avatar_url,tipo,verificado,actualmente,total_seguidores")
          .neq("id", user.id)
          .order("verificado", { ascending: false })
          .order("total_seguidores", { ascending: false })
          .limit(10);
        const filtrados = (sug || []).filter((pp: any) => !seguidosIds.includes(pp.id)).slice(0, 6);
        setSugeridos(filtrados);
        const ids = filtrados.map((pp: any) => pp.id);
        if (ids.length) {
          const { data: sols } = await (supabase as any)
            .from("match_acciones")
            .select("objetivo_id")
            .eq("perfil_id", user.id)
            .eq("accion", "solicitud_enviada")
            .in("objetivo_id", ids);
          setSolicitudesEnviadas(new Set((sols || []).map((x: any) => x.objetivo_id)));
        }
      })();
    }
  }, [user, tab]);

  const [nuevasIds, setNuevasIds] = useState<string[]>([]);

  useEffect(() => {
    const ch = (supabase as any).channel("feed_pub_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "publicaciones" }, async (payload: any) => {
        if (payload.new?.estado !== "activa") return;
        const { data: row } = await (supabase as any).from("publicaciones").select(SELECT).eq("id", payload.new.id).maybeSingle();
        if (!row) return;
        setItems((arr) => arr.some((p) => p.id === row.id) ? arr : [row, ...arr]);
        setNuevasIds((ids) => [row.id, ...ids].slice(0, 50));
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "publicaciones" }, (payload: any) => {
        setItems((arr) => {
          if (payload.new?.estado && payload.new.estado !== "activa") return arr.filter((p) => p.id !== payload.new.id);
          return arr.map((p) => p.id === payload.new.id ? { ...p, ...payload.new } : p);
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "publicaciones" }, (payload: any) => {
        setItems((arr) => arr.filter((p) => p.id !== payload.old?.id));
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  const conectarDesde = async (otroId: string) => {
    if (!user) return;
    const { error } = await (supabase as any)
      .from("match_acciones")
      .insert({ perfil_id: user.id, objetivo_id: otroId, accion: "solicitud_enviada" });
    if (!error) {
      setSolicitudesEnviadas((prev) => new Set([...prev, otroId]));
      toast.success("Solicitud enviada");
    } else {
      toast.error("No se pudo enviar");
    }
  };

  const filtered = useMemo(() => items.filter((p) => {
    if (tab === "siguiendo" && !seguidos.includes(p.perfil?.id)) return false;
    if (filtroTipo !== "all" && p.tipo !== filtroTipo) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return p.titulo?.toLowerCase().includes(t) || p.cuerpo?.toLowerCase().includes(t) || p.perfil?.nombre?.toLowerCase().includes(t);
  }), [items, tab, seguidos, filtroTipo, q]);

  return (
    <div className="mx-auto -mt-4 grid max-w-7xl gap-6 md:-mt-6 lg:grid-cols-[minmax(0,1fr)_320px]">
      {/* COLUMNA CENTRAL */}
      <div className="min-w-0 max-w-2xl lg:mx-0 lg:max-w-none">
        <header className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/80 backdrop-blur-md md:-mx-6 lg:mx-0">
          <div className="flex">
            <TabBtn active={tab === "para-vos"} onClick={() => setTab("para-vos")}>Para ti</TabBtn>
            <TabBtn active={tab === "siguiendo"} onClick={() => setTab("siguiendo")}>Siguiendo</TabBtn>
            <TabBtn active={tab === "tendencias"} onClick={() => setTab("tendencias")} icon={Flame}>Tendencias</TabBtn>
          </div>
        </header>

        {/* Compose */}
        {user && (
          <div className="border-b px-4 py-3 sm:px-5">
            <Link to="/lin/publicar" className="flex items-center gap-3 group">
              <Avatar className="h-11 w-11 shrink-0">
                <AvatarImage src={miPerfil?.avatar_url || ""} className="object-cover" />
                <AvatarFallback>{initials(miPerfil?.nombre)}</AvatarFallback>
              </Avatar>
              <div className="flex-1 rounded-full bg-secondary/60 px-4 py-2.5 text-sm text-muted-foreground transition-colors group-hover:bg-secondary">
                ¿Qué estás pensando{miPerfil?.nombre ? `, ${miPerfil.nombre.split(" ")[0]}` : ""}?
              </div>
            </Link>
            <div className="mt-3 grid grid-cols-4 gap-1 pl-14">
              {[
                { icon: ImageIcon, label: "Foto/Video", color: "text-blue-600" },
                { icon: FileText, label: "Artículo", color: "text-green-700" },
                { icon: CalendarDays, label: "Evento", color: "text-amber-600" },
                { icon: BarChart3Icon, label: "Encuesta", color: "text-violet-600" },
              ].map((item) => (
                <Link
                  key={item.label}
                  to="/lin/publicar"
                  className="flex items-center justify-center gap-1.5 rounded-lg py-1.5 text-[11px] font-medium text-muted-foreground transition-colors hover:bg-secondary/60"
                >
                  <item.icon className={`h-4 w-4 ${item.color}`} />
                  <span className="hidden sm:inline">{item.label}</span>
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Sugeridos — solo mobile */}
        {sugeridos.length > 0 && user && (
          <div className="border-b px-4 py-3 sm:px-5 lg:hidden">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-bold">Personas destacadas para conectar</h3>
              <Link to="/lin/conectar" className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
                Ver todas
              </Link>
            </div>
            <ScrollArea className="w-full whitespace-nowrap">
              <div className="flex gap-3 pb-2">
                {sugeridos.map((persona) => (
                  <div
                    key={persona.id}
                    className="w-40 shrink-0 rounded-xl border bg-card p-3 text-center"
                  >
                    <Link to={`/lin/perfil/${persona.username}`} className="inline-block">
                      <Avatar className="mx-auto h-14 w-14">
                        <AvatarImage src={persona.avatar_url || ""} className="object-cover" />
                        <AvatarFallback>{initials(persona.nombre)}</AvatarFallback>
                      </Avatar>
                    </Link>
                    <p className="mt-2 truncate text-xs font-bold">{persona.nombre}</p>
                    <p className="line-clamp-1 text-[10px] text-muted-foreground">
                      {persona.actualmente || persona.tipo || ""}
                    </p>
                    <button
                      onClick={() => !solicitudesEnviadas.has(persona.id) && conectarDesde(persona.id)}
                      className={`mt-3 flex w-full items-center justify-center gap-1.5 rounded-full border py-1.5 text-xs font-semibold transition-all ${
                        solicitudesEnviadas.has(persona.id)
                          ? "cursor-default border-border text-muted-foreground"
                          : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                      }`}
                    >
                      <UserPlus className="h-3 w-3" />
                      {solicitudesEnviadas.has(persona.id) ? "Enviada" : "Conectar"}
                    </button>
                  </div>
                ))}
              </div>
              <ScrollBar orientation="horizontal" />
            </ScrollArea>
          </div>
        )}

        {/* Filtros */}
        <div className="border-b px-4 py-2.5 sm:px-5">
          <div className="relative mb-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar en el feed…"
              className="h-9 rounded-full border-none bg-secondary/60 pl-9 text-sm focus-visible:ring-1"
            />
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-1.5 pb-1">
              {FILTROS.map((f) => (
                <Chip key={f.key} active={filtroTipo === f.key} onClick={() => setFiltroTipo(f.key)}>
                  {f.label}
                </Chip>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {nuevasIds.length > 0 && (
          <button
            onClick={() => { window.scrollTo({ top: 0, behavior: "smooth" }); setNuevasIds([]); }}
            className="sticky top-[104px] z-20 mx-auto -mb-2 mt-3 block rounded-full bg-foreground px-4 py-1.5 text-xs font-semibold text-background shadow-lg transition hover:scale-105"
          >
            ↑ {nuevasIds.length} {nuevasIds.length === 1 ? "nueva publicación" : "nuevas publicaciones"}
          </button>
        )}

        {loading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <p className="text-sm text-muted-foreground">
              {tab === "siguiendo"
                ? "Todavía no seguís a nadie. Explorá la red."
                : "No hay publicaciones con esos filtros."}
            </p>
            <Button asChild className="mt-4 rounded-full">
              <Link to={tab === "siguiendo" ? "/lin/explorar" : "/lin/publicar"}>
                {tab === "siguiendo" ? "Explorar perfiles" : "Publicar la primera"}
              </Link>
            </Button>
          </div>
        ) : (
          <div>{filtered.map((p) => <PostCard key={p.id} pub={p} />)}</div>
        )}

        <div className="h-20" />
      </div>

      {/* COLUMNA DERECHA */}
      <FeedRail />
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 items-center justify-center gap-1.5 px-4 py-3.5 text-sm font-semibold transition-colors hover:bg-secondary/40 ${active ? "text-foreground" : "text-muted-foreground"}`}
    >
      {Icon && <Icon className="h-4 w-4" />}
      {children}
      {active && <span className="absolute bottom-0 left-1/2 h-1 w-12 -translate-x-1/2 rounded-full bg-primary" />}
    </button>
  );
}

function Chip({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}
    >
      {children}
    </button>
  );
}
