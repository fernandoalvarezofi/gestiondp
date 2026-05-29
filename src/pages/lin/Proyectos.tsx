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
  Plus, Rocket, Search, MessageSquare, ArrowRight, Zap, Award,
  Globe, ExternalLink, Github, Users, FolderOpen,
} from "lucide-react";
import { initials, formatNumber } from "@/lib/worefHelpers";
import { cn } from "@/lib/utils";

/**
 * Proyectos — listado tipo Product Hunt, sin upvotes.
 * Orden cronológico, agrupado por día. Card horizontal con portada izquierda.
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
  id, slug, nombre, descripcion, tagline, portada_url, categoria, tags,
  total_comentarios, sitio_web, demo_url, repo_url, created_at, perfil_id,
  perfil:perfiles!perfil_id(id, nombre, username, avatar_url, verificado),
  miembros:proyecto_miembros(perfil:perfiles!perfil_id(id, nombre, username, avatar_url))
`;

export default function Proyectos() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [mios, setMios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [periodo, setPeriodo] = useState<Periodo>("semana");
  const [categoria, setCategoria] = useState("Todas");
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"todos" | "mios">("todos");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const desde = PERIODOS.find((p) => p.key === periodo)?.desde() ?? null;
      let query = (supabase as any)
        .from("proyectos")
        .select(SELECT_PROYECTO)
        .order("created_at", { ascending: false })
        .limit(120);
      if (desde) query = query.gte("created_at", desde.toISOString());
      const { data } = await query;
      setItems(data || []);
      setLoading(false);
    })();
  }, [periodo]);

  useEffect(() => {
    if (!user) { setMios([]); return; }
    (async () => {
      const { data } = await (supabase as any)
        .from("proyectos")
        .select(SELECT_PROYECTO)
        .eq("perfil_id", user.id)
        .order("created_at", { ascending: false });
      setMios(data || []);
    })();
  }, [user]);

  const filtered = useMemo(() => {
    const source = tab === "mios" ? mios : items;
    let list = [...source];
    if (categoria !== "Todas") list = list.filter((p) => (p.categoria || "").toLowerCase() === categoria.toLowerCase());
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((p) =>
        p.nombre?.toLowerCase().includes(t) ||
        p.descripcion?.toLowerCase().includes(t) ||
        p.tagline?.toLowerCase().includes(t) ||
        (p.tags || []).some((tag: string) => tag.toLowerCase().includes(t))
      );
    }
    return list;
  }, [items, mios, tab, categoria, q]);

  const grupos = useMemo(() => groupByDay(filtered), [filtered]);

  const stats = useMemo(() => {
    const makersSet = new Set<string>();
    for (const p of items) {
      if (p.perfil?.id) makersSet.add(p.perfil.id);
      for (const m of p.miembros || []) if (m.perfil?.id) makersSet.add(m.perfil.id);
    }
    return {
      total: items.length,
      comments: items.reduce((s, p) => s + (p.total_comentarios || 0), 0),
      makers: makersSet.size,
    };
  }, [items]);

  return (
    <div className="mx-auto grid max-w-6xl gap-6 px-3 sm:px-4 md:grid-cols-[minmax(0,1fr)_280px]">
      <div className="min-w-0 space-y-5">
        {/* HEADER */}
        <header className="space-y-2 border-b pb-5">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <p className="text-[11px] font-bold uppercase tracking-[0.2em] text-primary">Lanzamientos</p>
              <h1 className="font-display text-3xl font-extrabold leading-[1.05] tracking-tight">
                Los mejores productos de la comunidad.
              </h1>
            </div>
            <Button asChild className="rounded-full bg-primary font-semibold text-primary-foreground">
              <Link to="/lin/proyectos/nuevo"><Plus className="h-4 w-4" />Lanzar producto</Link>
            </Button>
          </div>
        </header>

        {/* TABS Todos / Míos */}
        {user && (
          <div className="flex gap-1 border-b">
            {([
              { k: "todos", l: "Todos los proyectos" },
              { k: "mios", l: `Mis proyectos${mios.length ? ` (${mios.length})` : ""}` },
            ] as const).map((t) => (
              <button
                key={t.k}
                onClick={() => setTab(t.k)}
                className={cn(
                  "relative px-4 py-2 text-sm font-semibold transition-colors",
                  tab === t.k ? "text-foreground" : "text-muted-foreground hover:text-foreground"
                )}
              >
                {t.l}
                {tab === t.k && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-primary" />}
              </button>
            ))}
          </div>
        )}

        {/* FILTROS */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex rounded-full border bg-card p-1">
              {PERIODOS.map((p) => (
                <button
                  key={p.key}
                  onClick={() => setPeriodo(p.key)}
                  className={cn(
                    "rounded-full px-4 py-1.5 text-sm font-semibold transition-all",
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
                placeholder="Buscar proyectos, tags…"
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
                      ? "border-transparent bg-foreground text-background"
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

        {/* LISTADO */}
        {loading ? (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => <RowSkeleton key={i} />)}
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState mios={tab === "mios"} />
        ) : (
          <div className="space-y-6">
            {grupos.map(({ label, items: rows }) => (
              <section key={label}>
                <div className="mb-2 flex items-end justify-between">
                  <h2 className="font-display text-lg font-extrabold tracking-tight">{label}</h2>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {rows.length} {rows.length === 1 ? "producto" : "productos"}
                  </span>
                </div>
                <div className="mb-3 h-px bg-border" />
                <div>
                  {rows.map((p, i) => <ProjectRow key={p.id} p={p} rank={i + 1} />)}
                </div>
              </section>
            ))}
          </div>
        )}
      </div>

      <SideRail stats={stats} />
    </div>
  );
}

/* ---------------------- Row ---------------------- */

function ProjectRow({ p, rank }: { p: any; rank: number }) {
  const detalleHref = `/lin/proyectos/${p.slug || p.id}`;
  const makers: any[] = [p.perfil, ...((p.miembros || []).map((m: any) => m.perfil).filter(Boolean))]
    .filter(Boolean)
    .filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i)
    .slice(0, 4);
  const tag = p.tagline || p.descripcion;

  return (
    <Link
      to={detalleHref}
      className="mb-3 flex cursor-pointer items-stretch overflow-hidden rounded-2xl border border-border/60 bg-card transition-shadow hover:shadow-md"
    >
      {/* PORTADA */}
      <div className="relative w-[120px] flex-shrink-0 overflow-hidden bg-secondary sm:w-[160px]">
        {p.portada_url ? (
          <img src={p.portada_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-secondary">
            <Rocket className="h-8 w-8 text-foreground/30" />
          </div>
        )}
      </div>

      {/* BODY */}
      <div className="flex flex-1 flex-col justify-between gap-2 p-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="shrink-0 text-xs font-bold text-muted-foreground tabular-nums">#{rank}</span>
            <h3 className="truncate text-[15px] font-extrabold tracking-tight hover:text-primary">{p.nombre}</h3>
            {p.categoria && (
              <span className="hidden shrink-0 rounded-full bg-secondary px-2 py-0.5 text-[10px] font-semibold text-muted-foreground sm:inline-block">
                {p.categoria}
              </span>
            )}
          </div>
          {tag && (
            <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-muted-foreground">{tag}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
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
          <span className="inline-flex items-center gap-1">
            <MessageSquare className="h-3.5 w-3.5" />
            <span className="tabular-nums">{p.total_comentarios || 0}</span>
          </span>
          {p.sitio_web && (
            <a href={p.sitio_web} target="_blank" rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="hidden items-center gap-1 hover:text-foreground sm:inline-flex"
            ><Globe className="h-3.5 w-3.5" />Sitio</a>
          )}
          {p.demo_url && (
            <a href={p.demo_url} target="_blank" rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="hidden items-center gap-1 hover:text-foreground sm:inline-flex"
            ><ExternalLink className="h-3.5 w-3.5" />Demo</a>
          )}
          {p.repo_url && (
            <a href={p.repo_url} target="_blank" rel="noreferrer noopener"
              onClick={(e) => e.stopPropagation()}
              className="hidden items-center gap-1 hover:text-foreground sm:inline-flex"
            ><Github className="h-3.5 w-3.5" />Repo</a>
          )}
        </div>
      </div>
    </Link>
  );
}

function RowSkeleton() {
  return (
    <div className="flex items-stretch overflow-hidden rounded-2xl border bg-card">
      <Skeleton className="h-[120px] w-[160px] rounded-none" />
      <div className="flex-1 space-y-2 p-4">
        <Skeleton className="h-4 w-1/2" />
        <Skeleton className="h-3 w-3/4" />
        <Skeleton className="h-3 w-1/3" />
      </div>
    </div>
  );
}

/* ---------------------- Sidebar ---------------------- */

function SideRail({ stats }: { stats: { total: number; comments: number; makers: number } }) {
  return (
    <aside className="hidden space-y-4 md:block md:sticky md:top-4 md:h-fit">
      <section className="rounded-2xl border bg-secondary/40 p-4">
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" />
        </div>
        <p className="text-sm font-bold leading-tight">¿Listo para lanzar?</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground mb-3">
          Subí tu proyecto y mostralo a la comunidad.
        </p>
        <Button asChild size="sm" className="w-full rounded-full bg-primary font-semibold text-primary-foreground">
          <Link to="/lin/proyectos/nuevo">Lanzar producto <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </section>

      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b bg-secondary/40 px-4 py-2.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">En este período</h3>
        </div>
        <ul className="divide-y">
          <StatRow icon={Rocket} label="Proyectos" value={stats.total} />
          <StatRow icon={MessageSquare} label="Comentarios" value={stats.comments} />
          <StatRow icon={Users} label="Makers" value={stats.makers} />
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
            ["Lanzá tu proyecto", "Nombre, tagline y portada."],
            ["Compartilo", "Invitá a tu red a verlo."],
            ["Conseguí feedback", "Leé los comentarios."],
            ["Encontrá equipo", "Conectá con los interesados."],
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

function EmptyState({ mios }: { mios?: boolean }) {
  return (
    <div className="rounded-2xl border border-dashed bg-card py-16 text-center">
      {mios ? <FolderOpen className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
            : <Rocket className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />}
      <p className="text-sm font-medium">
        {mios ? "Todavía no lanzaste ningún proyecto." : "Aún no hay proyectos."}
      </p>
      <Button asChild className="mt-4 rounded-full bg-primary text-primary-foreground">
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
