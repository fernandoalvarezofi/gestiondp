import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Plus, MessageSquare, Heart, Pin, CheckCircle2, Search, Hash, TrendingUp, Sparkles, MoreHorizontal, Trash2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/components/lin/ConfirmDialog";
import { toast } from "sonner";
import { formatTime, initials } from "@/lib/worefHelpers";
import { cn } from "@/lib/utils";

export default function Foro() {
  const [cats, setCats] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [sort, setSort] = useState<"recientes" | "trending">("recientes");

  const load = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      (supabase as any).from("foro_categorias").select("*").order("orden"),
      (supabase as any).from("foro_posts")
        .select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url,verificado), categoria:foro_categorias!categoria_id(nombre,slug,color)")
        .order("fijado", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(80),
    ]);
    setCats(c || []);
    setPosts(p || []);
  };
  useEffect(() => { load(); }, []);

  useEffect(() => {
    const ch = (supabase as any).channel("foro_posts_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "foro_posts" }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  let filtered = posts.filter((p) => {
    if (cat !== "all" && p.categoria?.slug !== cat) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return p.titulo?.toLowerCase().includes(t) || p.contenido?.toLowerCase().includes(t);
  });
  if (sort === "trending") {
    filtered = [...filtered].sort((a, b) => (b.total_likes + b.total_respuestas * 2) - (a.total_likes + a.total_respuestas * 2));
  }

  const countFor = (slug: string) => posts.filter((p) => p.categoria?.slug === slug).length;

  return (
    <div className="mx-auto grid h-[calc(100vh-7rem)] max-w-6xl grid-cols-1 gap-4 md:grid-cols-[220px_1fr]">
      {/* Sidebar categorías estilo Discord */}
      <aside className="hidden flex-col gap-1 overflow-y-auto rounded-2xl bg-secondary/60 p-3 md:flex">
        <div className="px-2 pb-2">
          <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Categorías</p>
        </div>
        <ChannelBtn icon={Sparkles} active={cat === "all"} onClick={() => setCat("all")} label="Todo" count={posts.length} />
        {cats.map((c) => (
          <ChannelBtn key={c.id} icon={Hash} active={cat === c.slug} onClick={() => setCat(c.slug)} label={c.nombre} count={countFor(c.slug)} color={c.color} />
        ))}
      </aside>

      <div className="flex min-h-0 flex-col">
        {/* Header */}
        <div className="flex flex-col gap-3 border-b bg-background pb-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <Hash className="h-5 w-5 text-muted-foreground" />
              <h1 className="text-lg font-bold tracking-tight">
                {cat === "all" ? "todo" : cats.find((c) => c.slug === cat)?.nombre || "foro"}
              </h1>
              <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-muted-foreground">{filtered.length}</span>
            </div>
            <Button asChild size="sm" className="rounded-full"><Link to="/lin/foro/nuevo"><Plus className="h-4 w-4" />Nuevo</Link></Button>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el foro…" className="rounded-full bg-secondary/60 pl-9 border-0" />
            </div>
            <div className="flex gap-1 rounded-full bg-secondary p-1">
              <SortBtn active={sort === "recientes"} onClick={() => setSort("recientes")}>Recientes</SortBtn>
              <SortBtn active={sort === "trending"} onClick={() => setSort("trending")}><TrendingUp className="h-3 w-3" />Trending</SortBtn>
            </div>
          </div>
          {/* Chips móvil */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
            <MobileChip active={cat === "all"} onClick={() => setCat("all")}>Todo</MobileChip>
            {cats.map((c) => <MobileChip key={c.id} active={cat === c.slug} onClick={() => setCat(c.slug)} color={c.color}>{c.nombre}</MobileChip>)}
          </div>
        </div>

        {/* Lista */}
        <div className="flex-1 divide-y overflow-y-auto">
          {filtered.length === 0 ? (
            <div className="py-16 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
              No hay posts con esos filtros.
            </div>
          ) : filtered.map((p) => (
            <Link key={p.id} to={`/lin/foro/post/${p.id}`} className="block px-3 py-3 transition-colors hover:bg-secondary/40">
              <div className="flex gap-3">
                <Avatar className="h-9 w-9 shrink-0">
                  <AvatarImage src={p.perfil?.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{initials(p.perfil?.nombre || "??")}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                    <span className="font-semibold text-foreground">{p.perfil?.nombre}</span>
                    <span>·</span>
                    <span>{formatTime(p.created_at)}</span>
                    {p.categoria && (
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-medium" style={{ backgroundColor: `${p.categoria.color}20`, color: p.categoria.color }}>
                        #{p.categoria.slug}
                      </span>
                    )}
                    {p.fijado && <Pin className="h-3 w-3 text-primary" />}
                    {p.resuelto && <CheckCircle2 className="h-3 w-3 text-emerald-500" />}
                  </div>
                  <p className="mt-0.5 line-clamp-2 font-semibold leading-snug">{p.titulo}</p>
                  {p.contenido && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{p.contenido}</p>}
                  <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{p.total_respuestas}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3.5 w-3.5" />{p.total_likes}</span>
                  </div>
                </div>
                {p.imagen_url && <img src={p.imagen_url} alt="" loading="lazy" className="hidden h-16 w-16 shrink-0 rounded-lg object-cover sm:block" />}
              </div>
            </Link>
          ))}
        </div>
      </div>
    </div>
  );
}

function ChannelBtn({ icon: Icon, active, onClick, label, count, color }: any) {
  return (
    <button onClick={onClick}
      className={cn(
        "group flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-primary/15 text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      )}>
      <Icon className="h-4 w-4 shrink-0" style={color && !active ? { color } : undefined} />
      <span className="flex-1 truncate text-left">{label}</span>
      <span className={cn("rounded-full px-1.5 text-[10px] font-semibold", active ? "bg-primary/20" : "bg-secondary group-hover:bg-background")}>{count}</span>
    </button>
  );
}

function SortBtn({ active, onClick, children }: any) {
  return (
    <button onClick={onClick} className={cn("flex items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors", active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
      {children}
    </button>
  );
}

function MobileChip({ active, onClick, color, children }: any) {
  return (
    <button onClick={onClick}
      className={cn("shrink-0 rounded-full border px-3 py-1 text-xs font-medium transition-colors", active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary")}
      style={!active && color ? { color } : undefined}>
      {children}
    </button>
  );
}
