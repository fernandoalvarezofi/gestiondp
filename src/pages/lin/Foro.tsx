import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Plus, MessageSquare, Pin, CheckCircle2, Search, Hash, TrendingUp, Sparkles,
  MoreHorizontal, Trash2, ChevronUp, ChevronDown, HelpCircle, Award, Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAuth } from "@/contexts/AuthContext";
import { useConfirm } from "@/components/lin/ConfirmDialog";
import { toast } from "sonner";
import { formatTime, initials } from "@/lib/worefHelpers";
import { cn } from "@/lib/utils";

type Orden = "recientes" | "top" | "sin_responder" | "resueltos";

export default function Foro() {
  const { user } = useAuth();
  const confirm = useConfirm();
  const [cats, setCats] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  const [misVotos, setMisVotos] = useState<Record<string, number>>({});
  const [cat, setCat] = useState<string>("all");
  const [q, setQ] = useState("");
  const [orden, setOrden] = useState<Orden>("recientes");

  const load = async () => {
    const [{ data: c }, { data: p }] = await Promise.all([
      (supabase as any).from("foro_categorias").select("*").order("orden"),
      (supabase as any).from("foro_posts")
        .select("*, perfil:perfiles!perfil_id(id,nombre,username,avatar_url,verificado), categoria:foro_categorias!categoria_id(nombre,slug,color)")
        .order("fijado", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
    ]);
    setCats(c || []);
    setPosts(p || []);
  };

  const loadVotos = async () => {
    if (!user) return;
    const { data } = await (supabase as any).from("foro_votos")
      .select("post_id,valor").eq("perfil_id", user.id).not("post_id", "is", null);
    const map: Record<string, number> = {};
    (data || []).forEach((v: any) => { map[v.post_id] = v.valor; });
    setMisVotos(map);
  };

  useEffect(() => { load(); }, []);
  useEffect(() => { loadVotos(); }, [user?.id]);

  useEffect(() => {
    const ch = (supabase as any).channel("foro_posts_rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "foro_posts" }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  const votar = async (postId: string, valor: 1 | -1) => {
    if (!user) { toast.error("Iniciá sesión para votar"); return; }
    const actual = misVotos[postId] || 0;
    const nuevo = actual === valor ? 0 : valor;
    setMisVotos((m) => ({ ...m, [postId]: nuevo }));
    setPosts((arr) => arr.map((p) => p.id === postId ? { ...p, total_votos: (p.total_votos || 0) - actual + nuevo } : p));
    if (nuevo === 0) {
      await (supabase as any).from("foro_votos").delete().eq("perfil_id", user.id).eq("post_id", postId);
    } else if (actual === 0) {
      await (supabase as any).from("foro_votos").insert({ perfil_id: user.id, post_id: postId, valor: nuevo });
    } else {
      await (supabase as any).from("foro_votos").update({ valor: nuevo }).eq("perfil_id", user.id).eq("post_id", postId);
    }
  };

  const eliminarPost = async (id: string) => {
    const ok = await confirm({ title: "¿Eliminar post?", description: "Esta acción no se puede deshacer.", confirmText: "Eliminar", destructive: true });
    if (!ok) return;
    const { error } = await (supabase as any).from("foro_posts").delete().eq("id", id).eq("perfil_id", user?.id);
    if (error) { toast.error("No se pudo eliminar el post"); return; }
    toast.success("Post eliminado");
    setPosts((arr) => arr.filter((p) => p.id !== id));
  };

  const filtered = useMemo(() => {
    let list = posts.filter((p) => {
      if (cat !== "all" && p.categoria?.slug !== cat) return false;
      if (orden === "sin_responder" && (p.total_respuestas || 0) > 0) return false;
      if (orden === "resueltos" && !p.resuelto) return false;
      if (!q.trim()) return true;
      const t = q.toLowerCase();
      return p.titulo?.toLowerCase().includes(t) || p.contenido?.toLowerCase().includes(t)
        || (p.tags || []).some((x: string) => x.toLowerCase().includes(t));
    });
    if (orden === "top") {
      list = [...list].sort((a, b) =>
        ((b.total_votos || 0) + (b.total_respuestas || 0) * 2) - ((a.total_votos || 0) + (a.total_respuestas || 0) * 2));
    }
    return list;
  }, [posts, cat, q, orden]);

  const countFor = (slug: string) => posts.filter((p) => p.categoria?.slug === slug).length;

  const topAutores = useMemo(() => {
    const map = new Map<string, { perfil: any; puntos: number }>();
    posts.forEach((p) => {
      if (!p.perfil) return;
      const prev = map.get(p.perfil_id) || { perfil: p.perfil, puntos: 0 };
      prev.puntos += 1 + (p.total_votos || 0) + (p.total_respuestas || 0);
      map.set(p.perfil_id, prev);
    });
    return Array.from(map.values()).sort((a, b) => b.puntos - a.puntos).slice(0, 5);
  }, [posts]);

  const sinResponder = posts.filter((p) => !p.total_respuestas).length;

  return (
    <div className="mx-auto max-w-6xl">
      {/* Header propio del Foro */}
      <header className="mb-4 flex flex-col gap-3 border-b pb-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-primary">Foro</p>
          <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">Preguntá. Respondé. Resolvé.</h1>
          <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
            {posts.length} discusiones · {sinResponder} sin responder
          </p>
        </div>
        <Button asChild className="rounded-full shrink-0">
          <Link to="/lin/foro/nuevo"><Plus className="h-4 w-4" />Nueva discusión</Link>
        </Button>
      </header>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-[200px_minmax(0,1fr)] lg:grid-cols-[200px_minmax(0,1fr)_240px]">
        {/* Categorías */}
        <aside className="hidden flex-col gap-1 self-start rounded-2xl bg-secondary/60 p-3 md:flex">
          <p className="px-2 pb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Categorías</p>
          <ChannelBtn icon={Sparkles} active={cat === "all"} onClick={() => setCat("all")} label="Todo" count={posts.length} />
          {cats.map((c) => (
            <ChannelBtn key={c.id} icon={Hash} active={cat === c.slug} onClick={() => setCat(c.slug)} label={c.nombre} count={countFor(c.slug)} color={c.color} />
          ))}
        </aside>

        <div className="flex min-w-0 flex-col">
          {/* Controles */}
          <div className="flex flex-col gap-2 pb-3">
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar en el foro…" className="rounded-full border-0 bg-secondary/60 pl-9" />
            </div>
            <div className="flex gap-1 overflow-x-auto rounded-full bg-secondary p-1">
              <SortBtn active={orden === "recientes"} onClick={() => setOrden("recientes")}>Recientes</SortBtn>
              <SortBtn active={orden === "top"} onClick={() => setOrden("top")}><TrendingUp className="h-3 w-3" />Top</SortBtn>
              <SortBtn active={orden === "sin_responder"} onClick={() => setOrden("sin_responder")}><HelpCircle className="h-3 w-3" />Sin responder</SortBtn>
              <SortBtn active={orden === "resueltos"} onClick={() => setOrden("resueltos")}><CheckCircle2 className="h-3 w-3" />Resueltos</SortBtn>
            </div>
            {/* Chips móvil */}
            <div className="flex gap-1.5 overflow-x-auto pb-1 md:hidden">
              <MobileChip active={cat === "all"} onClick={() => setCat("all")}>Todo</MobileChip>
              {cats.map((c) => <MobileChip key={c.id} active={cat === c.slug} onClick={() => setCat(c.slug)} color={c.color}>{c.nombre}</MobileChip>)}
            </div>
          </div>

          {/* Lista */}
          <div className="divide-y rounded-2xl border">
            {filtered.length === 0 ? (
              <div className="py-16 text-center text-sm text-muted-foreground">
                <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
                No hay discusiones con esos filtros.
              </div>
            ) : filtered.map((p) => (
              <article key={p.id} className="group relative flex gap-2 px-2 py-3 transition-colors hover:bg-secondary/40 sm:px-3">
                {/* Votos */}
                <div className="flex w-9 shrink-0 flex-col items-center pt-1">
                  <button onClick={() => votar(p.id, 1)} aria-label="Votar a favor"
                    className={cn("rounded-md p-0.5 transition-colors hover:bg-secondary", misVotos[p.id] === 1 ? "text-primary" : "text-muted-foreground")}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-bold tabular-nums">{p.total_votos || 0}</span>
                  <button onClick={() => votar(p.id, -1)} aria-label="Votar en contra"
                    className={cn("rounded-md p-0.5 transition-colors hover:bg-secondary", misVotos[p.id] === -1 ? "text-destructive" : "text-muted-foreground")}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>

                <Link to={`/lin/foro/post/${p.id}`} className="min-w-0 flex-1">
                  <div className="flex gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
                        <Avatar className="h-5 w-5">
                          <AvatarImage src={p.perfil?.avatar_url || ""} />
                          <AvatarFallback className="text-[9px]">{initials(p.perfil?.nombre || "??")}</AvatarFallback>
                        </Avatar>
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
                      <h2 className="mt-1 line-clamp-2 font-semibold leading-snug">{p.titulo}</h2>
                      {p.contenido && <p className="mt-0.5 line-clamp-1 text-sm text-muted-foreground">{p.contenido}</p>}
                      {!!(p.tags || []).length && (
                        <div className="mt-1.5 flex flex-wrap gap-1">
                          {(p.tags || []).slice(0, 4).map((t: string) => (
                            <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">#{t}</span>
                          ))}
                        </div>
                      )}
                      <div className="mt-1.5 flex items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1"><MessageSquare className="h-3.5 w-3.5" />{p.total_respuestas || 0}</span>
                        <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{p.total_vistas || 0}</span>
                        {!p.total_respuestas && <span className="rounded-full bg-amber-500/15 px-2 py-0.5 text-[10px] font-semibold text-amber-600">Sin responder</span>}
                      </div>
                    </div>
                    {p.imagen_url && <img src={p.imagen_url} alt="" loading="lazy" className="hidden h-16 w-16 shrink-0 rounded-lg object-cover sm:block" />}
                  </div>
                </Link>

                {user?.id === p.perfil_id && (
                  <div className="absolute right-2 top-2 opacity-100 transition-opacity md:opacity-0 md:group-hover:opacity-100">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <button className="rounded-full bg-background/80 p-1.5 hover:bg-secondary" aria-label="Opciones del post">
                          <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
                        </button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => eliminarPost(p.id)}>
                          <Trash2 className="mr-2 h-4 w-4" />Eliminar post
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </div>
                )}
              </article>
            ))}
          </div>
        </div>

        {/* Rail derecho */}
        <aside className="hidden flex-col gap-4 self-start lg:flex">
          <div className="rounded-2xl border p-4">
            <h3 className="mb-3 flex items-center gap-1.5 text-sm font-bold"><Award className="h-4 w-4 text-primary" />Top de la semana</h3>
            <div className="space-y-2.5">
              {topAutores.length === 0 && <p className="text-xs text-muted-foreground">Todavía no hay actividad.</p>}
              {topAutores.map((a, i) => (
                <Link key={a.perfil.username} to={`/lin/perfil/${a.perfil.username}`} className="flex items-center gap-2 text-sm hover:opacity-80">
                  <span className="w-4 text-xs font-bold text-muted-foreground">{i + 1}</span>
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={a.perfil.avatar_url || ""} />
                    <AvatarFallback className="text-[10px]">{initials(a.perfil.nombre || "??")}</AvatarFallback>
                  </Avatar>
                  <span className="min-w-0 flex-1 truncate font-medium">{a.perfil.nombre}</span>
                  <span className="text-xs font-semibold text-primary">{a.puntos}</span>
                </Link>
              ))}
            </div>
          </div>
          <div className="rounded-2xl border bg-secondary/50 p-4">
            <h3 className="text-sm font-bold">¿Sabés la respuesta?</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Hay {sinResponder} preguntas esperando. Ayudá y sumá reputación.
            </p>
            <Button variant="outline" size="sm" className="mt-3 w-full rounded-full" onClick={() => setOrden("sin_responder")}>
              Ver sin responder
            </Button>
          </div>
        </aside>
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
    <button onClick={onClick} className={cn("flex shrink-0 items-center gap-1 rounded-full px-3 py-1 text-xs font-medium transition-colors", active ? "bg-background shadow-sm" : "text-muted-foreground hover:text-foreground")}>
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
