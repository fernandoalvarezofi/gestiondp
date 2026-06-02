import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Search, TrendingUp, Sparkles, Loader2, Play, Rocket, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";

const CHIPS = ["Todos", "Trending", "Para vos", "Proyectos", "Video", "Recursos", "Hiring", "Logros"];
const SELECT = `id,titulo,cuerpo,imagen_url,video_url,thumbnail_url,tipo,total_likes,total_comentarios,vistas,created_at,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url),
  media:media_publicacion(url,es_portada)`;

type ExploreItem = {
  id: string;
  kind: "publicacion" | "proyecto" | "comunidad";
  href: string;
  title?: string | null;
  text?: string | null;
  image?: string | null;
  video?: string | null;
  tipo?: string | null;
  author?: string | null;
  likes?: number;
  comments?: number;
  members?: number;
  created_at: string;
  score: number;
};

const recencyScore = (date: string) => Math.max(0, 14 - (Date.now() - new Date(date).getTime()) / 86_400_000);

export default function Explorar() {
  const navigate = useNavigate();
  const [items, setItems] = useState<ExploreItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [chip, setChip] = useState("Trending");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const [{ data: pubs }, { data: proys }, { data: coms }] = await Promise.all([
        (supabase as any).from("publicaciones").select(SELECT)
          .eq("estado", "activa")
          .order("created_at", { ascending: false })
          .limit(80),
        (supabase as any).from("proyectos")
          .select("id,slug,nombre,tagline,descripcion,portada_url,logo_url,categoria,tags,total_comentarios,total_seguidores,created_at,perfil:perfiles!perfil_id(nombre,username)")
          .order("created_at", { ascending: false })
          .limit(60),
        (supabase as any).from("comunidades")
          .select("id,slug,nombre,descripcion,avatar_url,portada_url,tematica,total_miembros,created_at")
          .eq("privada", false)
          .order("created_at", { ascending: false })
          .limit(40),
      ]);

      const mapped: ExploreItem[] = [
        ...((pubs || []).map((p: any) => {
          const portada = p.media?.find((m: any) => m.es_portada)?.url || p.media?.[0]?.url || p.imagen_url || p.thumbnail_url;
          return {
            id: p.id,
            kind: "publicacion" as const,
            href: `/lin/publicacion/${p.id}`,
            title: p.titulo,
            text: p.cuerpo,
            image: portada,
            video: p.video_url,
            tipo: p.tipo,
            author: p.perfil?.nombre,
            likes: p.total_likes || 0,
            comments: p.total_comentarios || 0,
            created_at: p.created_at,
            score: (p.total_likes || 0) * 2 + (p.total_comentarios || 0) * 3 + (p.vistas || 0) * 0.05 + recencyScore(p.created_at),
          };
        })),
        ...((proys || []).map((p: any) => ({
          id: p.id,
          kind: "proyecto" as const,
          href: `/lin/proyectos/${p.slug || p.id}`,
          title: p.nombre,
          text: p.tagline || p.descripcion,
          image: p.portada_url || p.logo_url,
          tipo: "proyecto",
          author: p.perfil?.nombre,
          comments: p.total_comentarios || 0,
          created_at: p.created_at,
          score: 10 + (p.total_seguidores || 0) * 2 + (p.total_comentarios || 0) * 3 + recencyScore(p.created_at),
        }))),
        ...((coms || []).map((c: any) => ({
          id: c.id,
          kind: "comunidad" as const,
          href: `/lin/comunidades/${c.slug}`,
          title: c.nombre,
          text: c.descripcion,
          image: c.portada_url || c.avatar_url,
          tipo: "comunidad",
          members: c.total_miembros || 0,
          created_at: c.created_at,
          score: 8 + (c.total_miembros || 0) * 2 + recencyScore(c.created_at),
        }))),
      ].sort((a, b) => b.score - a.score);

      setItems(mapped);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => items.filter((p) => {
    if (chip === "Video" && !p.video) return false;
    if (chip === "Proyectos" && p.kind !== "proyecto") return false;
    if (chip === "Recursos" && p.tipo !== "recurso") return false;
    if (chip === "Hiring" && p.tipo !== "hiring") return false;
    if (chip === "Logros" && p.tipo !== "logro") return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return p.title?.toLowerCase().includes(t) || p.text?.toLowerCase().includes(t) || p.author?.toLowerCase().includes(t) || p.tipo?.toLowerCase().includes(t);
  }), [items, chip, q]);

  return (
    <div className="mx-auto -mt-4 max-w-4xl md:-mt-6">
      <header className="sticky top-0 z-30 -mx-4 space-y-3 border-b bg-background/80 px-4 pb-3 pt-2 backdrop-blur md:-mx-6 md:px-6">
        <div className="flex items-center gap-2">
          <h1 className="flex items-center gap-2 text-lg font-bold"><Sparkles className="h-5 w-5 text-primary" /> Explorar</h1>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar publicaciones, gente, ideas…"
            className="h-10 rounded-full border-none bg-secondary/60 pl-9 text-sm focus-visible:ring-1" />
        </div>
        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-1.5 pb-1">
            {CHIPS.map((c) => (
              <button key={c} onClick={() => setChip(c)}
                className={`flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium ${chip === c ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}>
                {c === "Trending" && <TrendingUp className="h-3 w-3" />}{c}
              </button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </header>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <p className="px-6 py-16 text-center text-sm text-muted-foreground">Nada que mostrar con esos filtros.</p>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 pt-3 sm:gap-1">
          {filtered.map((p, i) => {
            const portada = p.media?.find((m: any) => m.es_portada)?.url || p.media?.[0]?.url || p.imagen_url || p.thumbnail_url;
            const esVideo = !!p.video_url;
            // Layout estilo IG con algunos items grandes
            const grande = i % 7 === 0;
            return (
              <button key={p.id} onClick={() => navigate(`/lin/publicacion/${p.id}`)}
                className={`group relative aspect-square overflow-hidden bg-secondary/50 ${grande ? "col-span-2 row-span-2 aspect-auto" : ""}`}>
                {portada ? (
                  <img src={portada} alt="" loading="lazy" className="h-full w-full object-cover transition-transform group-hover:scale-105" />
                ) : (
                  <div className="flex h-full w-full items-center justify-center p-3 text-center">
                    <p className="line-clamp-4 text-xs font-medium text-foreground/80">{p.titulo || p.cuerpo}</p>
                  </div>
                )}
                {esVideo && <Play className="absolute right-2 top-2 h-4 w-4 fill-white text-white drop-shadow" />}
                <div className="absolute inset-0 hidden items-center justify-center gap-3 bg-black/40 text-sm font-semibold text-white group-hover:flex">
                  <span>❤ {p.total_likes || 0}</span>
                  <span>💬 {p.total_comentarios || 0}</span>
                </div>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
