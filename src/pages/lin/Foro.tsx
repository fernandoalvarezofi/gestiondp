import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Plus, MessageSquare, Heart, Pin, CheckCircle2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatTime, initials } from "@/lib/worefHelpers";

export default function Foro() {
  const [cats, setCats] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        (supabase as any).from("foro_categorias").select("*").order("orden"),
        (supabase as any).from("foro_posts")
          .select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url), categoria:foro_categorias!categoria_id(nombre,slug,color)")
          .order("fijado", { ascending: false })
          .order("created_at", { ascending: false })
          .limit(60),
      ]);
      setCats(c || []);
      setPosts(p || []);
    })();
  }, []);

  const filtered = posts.filter((p) => {
    if (cat !== "all" && p.categoria?.slug !== cat) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return p.titulo?.toLowerCase().includes(t) || p.contenido?.toLowerCase().includes(t);
  });

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl bg-secondary p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Foro</h1>
            <p className="text-xs text-muted-foreground">{posts.length} posts · preguntas, debates y recursos</p>
          </div>
          <Button asChild size="sm"><Link to="/lin/foro/nuevo"><Plus className="h-4 w-4" />Nuevo post</Link></Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el foro…" className="bg-background pl-9" />
        </div>
      </div>

      <div className="flex flex-wrap gap-1.5">
        <Chip active={cat === "all"} onClick={() => setCat("all")}>Todo</Chip>
        {cats.map((c) => (
          <Chip key={c.id} active={cat === c.slug} onClick={() => setCat(c.slug)} color={c.color}>{c.nombre}</Chip>
        ))}
      </div>

      <div className="space-y-2">
        {filtered.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">No hay posts con esos filtros.</CardContent></Card>
        ) : filtered.map((p) => (
          <Link key={p.id} to={`/lin/foro/post/${p.id}`} className="block">
            <Card className="transition-colors hover:border-primary/50">
              <CardContent className="flex gap-3 p-4">
                {p.imagen_url && <img src={p.imagen_url} alt="" className="hidden h-20 w-20 shrink-0 rounded-lg object-cover sm:block" />}
                <div className="min-w-0 flex-1 space-y-1.5">
                  <div className="flex flex-wrap items-center gap-1.5">
                    {p.fijado && <Pin className="h-3.5 w-3.5 text-primary" />}
                    {p.resuelto && <CheckCircle2 className="h-3.5 w-3.5 text-emerald-500" />}
                    {p.categoria && <Badge variant="outline" className="text-[10px]" style={{ borderColor: p.categoria.color, color: p.categoria.color }}>{p.categoria.nombre}</Badge>}
                  </div>
                  <p className="line-clamp-2 font-semibold leading-snug">{p.titulo}</p>
                  {p.contenido && <p className="line-clamp-2 text-sm text-muted-foreground">{p.contenido}</p>}
                  <div className="flex items-center justify-between gap-2 pt-1 text-xs text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5"><AvatarImage src={p.perfil?.avatar_url || ""} /><AvatarFallback className="text-[9px]">{initials(p.perfil?.nombre || "??")}</AvatarFallback></Avatar>
                      <span>{p.perfil?.nombre}</span>
                      <span>·</span>
                      <span>{formatTime(p.created_at)}</span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{p.total_respuestas}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{p.total_likes}</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Chip({ active, onClick, color, children }: any) {
  return (
    <button onClick={onClick}
      className={`rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"}`}
      style={!active && color ? { color } : undefined}>
      {children}
    </button>
  );
}
