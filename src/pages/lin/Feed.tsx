import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Search, Plus, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PostCard } from "@/components/lin/PostCard";

const FILTROS = [
  { key: "all", label: "Todo" },
  { key: "update", label: "Updates" },
  { key: "proyecto", label: "Proyectos" },
  { key: "oportunidad", label: "Oportunidades" },
  { key: "logro", label: "Logros" },
  { key: "lanzamiento", label: "Lanzamientos" },
  { key: "busco_socio", label: "Busco socio" },
  { key: "recurso", label: "Recursos" },
];

const SELECT = `id,tipo,formato,titulo,cuerpo,imagen_url,video_url,thumbnail_url,
  encuesta_opciones,rol_buscado,modalidad,pais,tags,
  vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url,tipo,verificado),
  media:media_publicacion(url,es_portada,orden)`;

export default function Feed() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState("todo");
  const [filtroTipo, setFiltroTipo] = useState("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [seguidos, setSeguidos] = useState<string[]>([]);

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
        const { data } = await (supabase as any).from("seguidos").select("seguido_id").eq("seguidor_id", user.id);
        setSeguidos((data || []).map((d: any) => d.seguido_id));
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
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl bg-secondary p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Feed</h1>
            <p className="text-xs text-muted-foreground">{items.length} publicaciones de la red Woref</p>
          </div>
          <Button asChild size="sm"><Link to="/lin/publicar"><Plus className="h-4 w-4" />Publicar</Link></Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar publicaciones, gente, temas…" className="bg-background pl-9" />
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="todo" className="gap-1.5"><Sparkles className="h-4 w-4" />Todo</TabsTrigger>
          <TabsTrigger value="siguiendo" className="gap-1.5"><Users className="h-4 w-4" />Siguiendo</TabsTrigger>
        </TabsList>
      </Tabs>

      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-1.5 pb-2">
          <Chip active={filtroTipo === "all"} onClick={() => setFiltroTipo("all")}>Todo</Chip>
          {Object.entries(TIPO_PUBLICACION).map(([k, v]) => (
            <Chip key={k} active={filtroTipo === k} onClick={() => setFiltroTipo(k)}><span>{v.emoji}</span> {v.label}</Chip>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {loading ? <p className="text-center text-sm text-muted-foreground">Cargando…</p>
        : filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center">
            <p className="text-muted-foreground">{tab === "siguiendo" ? "Aún no seguís a nadie." : "No hay publicaciones con esos filtros."}</p>
            <Button asChild className="mt-4"><Link to="/lin/publicar">Publicar la primera</Link></Button>
          </CardContent></Card>
        ) : <div className="space-y-4">{filtered.map((p) => <PostCard key={p.id} pub={p} />)}</div>}
    </div>
  );
}

function Chip({ active, onClick, children }: any) {
  return (
    <button onClick={onClick} className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}>{children}</button>
  );
}
