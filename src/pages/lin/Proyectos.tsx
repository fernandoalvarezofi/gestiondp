import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Rocket, Search, Triangle, MessageSquare,
  ArrowRight, Zap, Award, Flame, Globe, ExternalLink, Github,
} from "lucide-react";
import { initials, formatNumber } from "@/lib/worefHelpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Proyectos — leaderboard profesional inspirado en Product Hunt.
 * - Agrupación por día (Hoy / Ayer / fecha)
 * - Card amplia con thumbnail grande, tagline, makers, comentarios y upvote
 * - Filtro por período + categoría + búsqueda
 */

type Periodo = "hoy" | "semana" | "mes" | "all";

const PERIODOS: { key: Periodo; label: string; desde: () => Date | null }[] = [
  { key: "hoy",    label: "Hoy",         desde: () => { const d = new Date(); d.setHours(0,0,0,0); return d; } },
  { key: "semana", label: "Esta semana", desde: () => new Date(Date.now() - 7 * 86400_000) },
  { key: "mes",    label: "Este mes",    desde: () => new Date(Date.now() - 30 * 86400_000) },
  { key: "all",    label: "Todo",        desde: () => null },
];

const CATEGORIAS = ["Todas", "SaaS", "IA", "DevTools", "FinTech", "EdTech", "Health", "Marketplace", "Web3", "Hardware", "Otro"];

const SELECT_PROYECTO = `
  id, slug, nombre, descripcion, portada_url, categoria, tags, estado,
  total_upvotes, total_comentarios, total_seguidores, sitio_web, demo_url, repo_url, created_at,
  perfil:perfiles!perfil_id(id, nombre, username, avatar_url, verificado),
  miembros:proyecto_miembros(perfil:perfiles!perfil_id(id, nombre, username, avatar_url))
`;

export default function Proyectos() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [categoria, setCategoria] = useState("Todas");
  const [q, setQ] = useState("");
  const [misVotos, setMisVotos] = useState<Set<string>>(new Set());

  useEffect(() => {
    (async () => {
      setLoading(true);
      const desde = PERIODOS.find((p) => p.key === periodo)?.desde() ?? null;
      let query = (supabase as any)
        .from("proyectos")
        .select(SELECT_PROYECTO)
        .order("total_upvotes", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(120);
      if (desde) query = query.gte("created_at", desde.toISOString());
      const { data } = await query;
      setItems(data || []);
      setLoading(false);
    })();
  }, [periodo]);

  useEffect(() => {
    if (!user) { setMisVotos(new Set()); return; }
    (async () => {
      const { data } = await (supabase as any).from("proyecto_upvotes").select("proyecto_id").eq("perfil_id", user.id);
      setMisVotos(new Set((data || []).map((v: any) => v.proyecto_id)));
    })();
  }, [user]);

  const toggleUpvote = async (proyectoId: string) => {
    if (!user) { toast.error("Iniciá sesión para votar"); return; }
    const tiene = misVotos.has(proyectoId);
    const next = new Set(misVotos);
    if (tiene) {
      next.delete(proyectoId);
      setItems((prev) => prev.map((p) => p.id === proyectoId ? { ...p, total_upvotes: Math.max(0, (p.total_upvotes || 0) - 1) } : p));
      await (supabase as any).from("proyecto_upvotes").delete().eq("proyecto_id", proyectoId).eq("perfil_id", user.id);
    } else {
      next.add(proyectoId);
      setItems((prev) => prev.map((p) => p.id === proyectoId ? { ...p, total_upvotes: (p.total_upvotes || 0) + 1 } : p));
      const { error } = await (supabase as any).from("proyecto_upvotes").insert({ proyecto_id: proyectoId, perfil_id: user.id });
      if (error) { toast.error("No se pudo registrar el voto"); return; }
    }
    setMisVotos(next);
  };

  const filtered = useMemo(() => {
    let list = [...items];
    if (categoria !== "Todas") list = list.filter((p) => (p.categoria || "").toLowerCase() === categoria.toLowerCase());
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((p) =>
        p.nombre?.toLowerCase().includes(t) ||
        p.descripcion?.toLowerCase().includes(t) ||
        (p.tags || []).some((tag: string) => tag.toLowerCase().includes(t))
      );
    }
    return list.sort((a, b) => (b.total_upvotes || 0) - (a.total_upvotes || 0));
  }, [items, categoria, q]);

  // Agrupar por día (Hoy / Ayer / dd MMM)
  const grupos = useMemo(() => groupByDay(filtered), [filtered]);

  const stats = useMemo(() => ({
    total: items.length,
    votos: items.reduce((s, p) => s + (p.total_upvotes || 0), 0),
    comments: items.reduce((s, p) => s + (p.total_comentarios || 0), 0),
  }), [items]);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-3 sm:px-4 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        {/* HERO compacto — tipografía PH */}
        <header className="space-y-2 border-b pb-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Lanzamientos</p>
              <h1 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight sm:text-4xl">
                Los mejores productos de la comunidad.
              </h1>
              <p className="mt-1.5 text-sm text-muted-foreground">
                Descubrí, votá y comentá lo que se está construyendo en Woref.
              </p>
            </div>
            <Button asChild className="rounded-full font-semibold">
              <Link to="/lin/proyectos/nuevo"><Plus className="h-4 w-4" />Lanzar producto</Link>
            </Button>
          </div>
        </header>

        {/* Controles: período + búsqueda + categorías */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border bg-card p-1">
              {PERIODOS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodo(p.key)}
                  className={cn(
                    "rounded-full px-3.5 py-1.5 text-xs font-semibold transition-all",
                    periodo === p.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {p.label}
                </button>
              ))}
            </div>
            <div className="relative min-w-[180px] flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Buscar productos, tags…"
                className="h-9 rounded-full border bg-background pl-9 text-sm"
              />
            </div>
          </div>
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-1.5 pb-1">
              {CATEGORIAS.map((c) => (
                <button
                  key={c}
                  onClick={() => setCategoria(c)}
                  className={cn(
                    "rounded-full border px-3 py-1 text-xs font-semibold transition-colors",
                    categoria === c
                      ? "border-foreground bg-foreground text-background"
                      : "border-border bg-background hover:bg-secondary"
                  )}
                >
                  {c}
                </button>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>

        {/* LEADERBOARD */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="space-y-6">
            {grupos.map(({ label, items: rows }) => (
              <section key={label}>
                <div className="mb-2 flex items-end justify-between border-b pb-2">
                  <h2 className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight">
                    {label}
                  </h2>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {rows.length} {rows.length === 1 ? "producto" : "productos"}
                  </span>
                </div>
                <ul className="divide-y rounded-2xl border bg-card">
                  {rows.map((p, i) => (
                    <li key={p.id}>
                      <LaunchRow
                        p={p}
                        rank={i + 1}
                        voted={misVotos.has(p.id)}
                        onUpvote={() => toggleUpvote(p.id)}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            ))}
          </div>
        )}
      </div>

      {/* SIDEBAR */}
      <SideRail stats={stats} />
    </div>
  );
}

/* ---------------------- Row ---------------------- */

function LaunchRow({ p, rank, voted, onUpvote }: { p: any; rank: number; voted: boolean; onUpvote: () => void }) {
  const detalleHref = `/lin/proyectos/${p.slug || p.id}`;
  const makers: any[] = [p.perfil, ...((p.miembros || []).map((m: any) => m.perfil).filter(Boolean))]
    .filter(Boolean)
    .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
    .slice(0, 4);

  return (
    <div className="flex items-center gap-3 px-3 py-4 transition-colors hover:bg-secondary/30 sm:gap-4 sm:px-5">
      {/* Thumbnail grande */}
      <Link to={detalleHref} className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl border bg-secondary sm:h-16 sm:w-16">
        {p.portada_url ? (
          <img src={p.portada_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-surface-mint">
            <Rocket className="h-6 w-6 text-foreground/40" />
          </div>
        )}
      </Link>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <Link to={detalleHref} className="group block">
          <div className="flex items-center gap-1.5">
            <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">#{rank}</span>
            <h3 className="truncate text-[15px] font-extrabold leading-tight tracking-tight group-hover:text-primary sm:text-base">
              {p.nombre}
            </h3>
            {p.categoria && (
              <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-block">
                {p.categoria}
              </span>
            )}
          </div>
          <p className="mt-0.5 line-clamp-1 text-[13px] leading-snug text-muted-foreground">
            {p.descripcion || "Sin descripción."}
          </p>
        </Link>

        {/* Makers + meta + acciones */}
        <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
          {makers.length > 0 && (
            <div className="flex -space-x-1.5">
              {makers.map((m: any) => (
                <Avatar key={m.id} className="h-5 w-5 border-2 border-card">
                  <AvatarImage src={m.avatar_url || ""} />
                  <AvatarFallback className="text-[8px]">{initials(m.nombre)}</AvatarFallback>
                </Avatar>
              ))}
            </div>
          )}
          <Link to={detalleHref} className="inline-flex items-center gap-1 font-medium hover:text-foreground">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="tabular-nums">{p.total_comentarios || 0}</span>
          </Link>
          {p.sitio_web && (
            <a
              href={p.sitio_web} target="_blank" rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="hidden items-center gap-1 font-medium hover:text-foreground sm:inline-flex"
            >
              <Globe className="h-3.5 w-3.5" /> Sitio
            </a>
          )}
          {p.demo_url && (
            <a
              href={p.demo_url} target="_blank" rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="hidden items-center gap-1 font-medium hover:text-foreground sm:inline-flex"
            >
              <ExternalLink className="h-3.5 w-3.5" /> Demo
            </a>
          )}
          {p.repo_url && (
            <a
              href={p.repo_url} target="_blank" rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="hidden items-center gap-1 font-medium hover:text-foreground sm:inline-flex"
            >
              <Github className="h-3.5 w-3.5" /> Repo
            </a>
          )}
        </div>
      </div>

      {/* Upvote */}
      <button
        onClick={onUpvote}
        aria-pressed={voted}
        className={cn(
          "flex h-14 w-14 shrink-0 flex-col items-center justify-center rounded-xl border-2 font-extrabold tabular-nums transition-all sm:h-16 sm:w-16",
          voted
            ? "border-primary bg-gradient-to-b from-primary to-orange-500 text-primary-foreground shadow-md shadow-primary/30"
            : "border-border bg-background text-foreground hover:border-primary hover:text-primary active:scale-95"
        )}
      >
        <Triangle className={cn("h-3.5 w-3.5", voted ? "fill-current" : "fill-none")} strokeWidth={2.8} />
        <span className="mt-0.5 text-sm leading-none">{p.total_upvotes || 0}</span>
      </button>
    </div>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-center gap-4 rounded-2xl border bg-card p-4">
      <Skeleton className="h-16 w-16 rounded-xl" />
      <div className="flex-1 space-y-2">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
      <Skeleton className="h-16 w-16 rounded-xl" />
    </div>
  );
}

/* ---------------------- Side rail ---------------------- */

function SideRail({ stats }: { stats: { total: number; votos: number; comments: number } }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:h-fit">
      <section className="rounded-2xl border bg-gradient-to-br from-primary/15 via-card to-surface-mint p-4">
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" />
        </div>
        <p className="text-sm font-bold leading-tight">¿Listo para lanzar?</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Subí tu producto, conseguí votos, feedback y los primeros usuarios.
        </p>
        <Button asChild size="sm" className="mt-3 w-full rounded-full font-semibold">
          <Link to="/lin/proyectos/nuevo">Lanzar producto <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b bg-secondary/40 px-4 py-2.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">En este período</h3>
        </div>
        <ul className="divide-y">
          <StatRow icon={Rocket} label="Productos" value={stats.total} />
          <StatRow icon={Triangle} label="Votos" value={stats.votos} />
          <StatRow icon={MessageSquare} label="Comentarios" value={stats.comments} />
        </ul>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-2.5">
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <Award className="h-4 w-4 text-primary" /> Cómo funciona
          </h3>
        </div>
        <ol className="space-y-2.5 px-4 py-3 text-xs leading-relaxed">
          {[
            ["Lanzá tu producto", "Nombre, tagline, portada y links."],
            ["Compartilo", "Invitá a la comunidad a votarte."],
            ["Subí en el ranking", "Más votos = más visibilidad."],
            ["Conversá", "Respondé feedback en los comentarios."],
          ].map(([t, d], i) => (
            <li key={t} className="flex gap-2">
              <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">{i + 1}</span>
              <div className="min-w-0">
                <p className="font-semibold text-foreground">{t}</p>
                <p className="text-muted-foreground">{d}</p>
              </div>
            </li>
          ))}
        </ol>
      </section>
    </aside>
  );
}

function StatRow({ icon: Icon, label, value }: { icon: any; label: string; value: number }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Icon className="h-4 w-4 text-muted-foreground" />
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-extrabold tabular-nums">{formatNumber(value)}</span>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed bg-card py-16 text-center">
      <Flame className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-sm font-medium">Aún no hay productos en este período.</p>
      <p className="mt-1 text-xs text-muted-foreground">Sé el primero en lanzar.</p>
      <Button asChild className="mt-4 rounded-full">
        <Link to="/lin/proyectos/nuevo"><Plus className="h-4 w-4" />Lanzar producto</Link>
      </Button>
    </div>
  );
}

/* ---------------------- Helpers ---------------------- */

function groupByDay(items: any[]): { label: string; items: any[] }[] {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const yesterday = new Date(today.getTime() - 86400_000);
  const map = new Map<string, { label: string; ts: number; items: any[] }>();
  for (const p of items) {
    const d = new Date(p.created_at); d.setHours(0, 0, 0, 0);
    const key = d.toISOString();
    let label: string;
    if (d.getTime() === today.getTime()) label = "Hoy";
    else if (d.getTime() === yesterday.getTime()) label = "Ayer";
    else label = d.toLocaleDateString("es", { weekday: "long", day: "numeric", month: "long" });
    if (!map.has(key)) map.set(key, { label, ts: d.getTime(), items: [] });
    map.get(key)!.items.push(p);
  }
  return Array.from(map.values()).sort((a, b) => b.ts - a.ts);
}
