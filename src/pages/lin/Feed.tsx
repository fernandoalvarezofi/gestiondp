import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Sparkles, Users, Image as ImageIcon, BarChart3, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PostCard } from "@/components/lin/PostCard";
import { HistoriasBar } from "@/components/lin/HistoriasBar";
import { initials } from "@/lib/worefHelpers";

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

export default function Feed() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<"para-vos" | "siguiendo">("para-vos");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [seguidos, setSeguidos] = useState<string[]>([]);
  const [miPerfil, setMiPerfil] = useState<any>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from("publicaciones").select(SELECT)
        .eq("estado", "activa")
        .order("destacada", { ascending: false })
        .order("created_at", { ascending: false }).limit(60);
      setItems(data || []);
      setLoading(false);
    })();
    if (user) {
      (async () => {
        const [{ data: s }, { data: p }] = await Promise.all([
          (supabase as any).from("seguidos").select("seguido_id").eq("seguidor_id", user.id),
          (supabase as any).from("perfiles").select("nombre,avatar_url").eq("id", user.id).maybeSingle(),
        ]);
        setSeguidos((s || []).map((d: any) => d.seguido_id));
        setMiPerfil(p);
      })();
    }
  }, [user]);

  const filtered = useMemo(() => items.filter((p) => {
    if (tab === "siguiendo" && !seguidos.includes(p.perfil?.id)) return false;
    if (filtroTipo !== "all" && p.tipo !== filtroTipo) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return p.titulo?.toLowerCase().includes(t) || p.cuerpo?.toLowerCase().includes(t) || p.perfil?.nombre?.toLowerCase().includes(t);
  }), [items, tab, seguidos, filtroTipo, q]);

  return (
    <div className="mx-auto -mt-4 max-w-2xl md:-mt-6">
      {/* Sticky header */}
      <header className="sticky top-0 z-30 -mx-4 border-b border-border/60 bg-background/80 backdrop-blur-md md:-mx-6">
        <div className="flex">
          <TabBtn active={tab === "para-vos"} onClick={() => setTab("para-vos")} icon={Sparkles}>Para vos</TabBtn>
          <TabBtn active={tab === "siguiendo"} onClick={() => setTab("siguiendo")} icon={Users}>Siguiendo</TabBtn>
        </div>
      </header>

      {/* Historias */}
      <HistoriasBar />

      {/* Compose inline */}
      {user && (
        <div className="border-b px-4 py-3 sm:px-5">
          <Link to="/lin/publicar" className="flex items-center gap-3 group">
            <Avatar className="h-11 w-11 shrink-0">
              <AvatarImage src={miPerfil?.avatar_url || ""} className="object-cover" />
              <AvatarFallback>{initials(miPerfil?.nombre)}</AvatarFallback>
            </Avatar>
            <div className="flex-1 rounded-full bg-secondary/60 px-4 py-2.5 text-sm text-muted-foreground transition-colors group-hover:bg-secondary">
              ¿Qué estás construyendo, {miPerfil?.nombre?.split(" ")[0] || "vos"}?
            </div>
          </Link>
          <div className="mt-2 flex items-center justify-between pl-14">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Link to="/lin/publicar" className="rounded-full p-1.5 hover:bg-primary/10 hover:text-primary"><ImageIcon className="h-4 w-4" /></Link>
              <Link to="/lin/publicar" className="rounded-full p-1.5 hover:bg-primary/10 hover:text-primary"><BarChart3 className="h-4 w-4" /></Link>
            </div>
            <Button asChild size="sm" className="h-8 rounded-full px-4 text-xs font-semibold">
              <Link to="/lin/publicar">Publicar</Link>
            </Button>
          </div>
        </div>
      )}

      {/* Search + filtros */}
      <div className="space-y-2 border-b px-4 py-3 sm:px-5">
        <div className="relative">
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
              <Chip key={f.key} active={filtroTipo === f.key} onClick={() => setFiltroTipo(f.key)}>{f.label}</Chip>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* Lista */}
      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="px-6 py-16 text-center">
          <p className="text-sm text-muted-foreground">
            {tab === "siguiendo" ? "Todavía no seguís a nadie. Explorá la red y empezá a seguir gente." : "No hay publicaciones con esos filtros."}
          </p>
          <Button asChild className="mt-4 rounded-full"><Link to="/lin/publicar">Publicar la primera</Link></Button>
        </div>
      ) : (
        <div>{filtered.map((p) => <PostCard key={p.id} pub={p} />)}</div>
      )}
    </div>
  );
}

function TabBtn({ active, onClick, icon: Icon, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`relative flex flex-1 items-center justify-center gap-1.5 px-4 py-3.5 text-sm font-medium transition-colors hover:bg-secondary/40 ${active ? "text-foreground" : "text-muted-foreground"}`}
    >
      <Icon className="h-4 w-4" />
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
