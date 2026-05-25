import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Plus, Rocket, Sparkles, Users, Search, Flame, Loader2, Triangle, Trophy,
  MessageCircle, Calendar, ArrowRight, Zap, Target, Award,
} from "lucide-react";
import { ESTADO_PROYECTO, initials, formatNumber } from "@/lib/worefHelpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Proyectos — estilo Product Hunt.
 * Leaderboard temporal (Hoy / Semana / Mes / Todo) con ranking #1, #2, #3…
 * Filtros por categoría, búsqueda y panel lateral con info útil.
 */

type Periodo = "hoy" | "semana" | "mes" | "all";

const PERIODOS: { key: Periodo; label: string; desde: () => Date | null }[] = [
  { key: "hoy",    label: "Hoy",         desde: () => { const d = new Date(); d.setHours(0,0,0,0); return d; } },
  { key: "semana", label: "Esta semana", desde: () => new Date(Date.now() - 7 * 86400_000) },
  { key: "mes",    label: "Este mes",    desde: () => new Date(Date.now() - 30 * 86400_000) },
  { key: "all",    label: "Todo",        desde: () => null },
];

const CATEGORIAS = ["Todas", "SaaS", "IA", "DevTools", "FinTech", "EdTech", "Health", "Marketplace", "Web3", "Hardware", "Otro"];

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
        .select("*, perfil:perfiles!perfil_id(id,nombre,username,avatar_url,verificado)")
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
    if (!user) return;
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

  const stats = useMemo(() => ({
    total: items.length,
    votos: items.reduce((s, p) => s + (p.total_upvotes || 0), 0),
    buscando: items.filter((p) => p.estado === "buscando_equipo" || p.estado === "buscando_inversion").length,
  }), [items]);

  const periodoLabel = PERIODOS.find((p) => p.key === periodo)?.label ?? "";

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
      <div className="min-w-0 space-y-5">
        {/* HERO — compacto y enfocado en leaderboard */}
        <header className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-surface-mint p-5 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="min-w-0">
              <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-primary">
                <Trophy className="h-3 w-3" /> Leaderboard
              </div>
              <h1 className="text-2xl font-extrabold leading-tight tracking-tight sm:text-3xl">
                Los mejores lanzamientos de {periodoLabel.toLowerCase()}
              </h1>
              <p className="mt-1 text-sm text-muted-foreground">
                Descubrí, votá y apoyá lo que la comunidad está construyendo.
              </p>
            </div>
            <Button asChild size="sm" className="shrink-0 rounded-full font-semibold">
              <Link to="/lin/proyectos/nuevo"><Plus className="h-4 w-4" />Lanzar</Link>
            </Button>
          </div>

          {/* Selector de período (Product Hunt style) */}
          <div className="mt-4 inline-flex rounded-xl border bg-background/70 p-1 backdrop-blur">
            {PERIODOS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPeriodo(p.key)}
                className={cn(
                  "rounded-lg px-3 py-1.5 text-xs font-bold transition-all",
                  periodo === p.key
                    ? "bg-foreground text-background shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </header>

        {/* Buscador + categorías */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar proyectos, categorías, tags…"
              className="h-10 rounded-full border bg-background pl-9 text-sm"
            />
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
                      ? "border-primary bg-primary text-primary-foreground"
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

        {/* LEADERBOARD — lista vertical estilo PH */}
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : filtered.length === 0 ? (
          <EmptyState />
        ) : (
          <div className="divide-y overflow-hidden rounded-2xl border bg-card">
            <div className="flex items-center justify-between px-4 py-3 sm:px-5">
              <h2 className="flex items-center gap-2 text-sm font-bold">
                <Flame className="h-4 w-4 text-primary" />
                Top {periodoLabel}
              </h2>
              <span className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                {filtered.length} {filtered.length === 1 ? "proyecto" : "proyectos"}
              </span>
            </div>
            <ul className="divide-y">
              {filtered.map((p, i) => (
                <li key={p.id}>
                  <LeaderRow
                    p={p}
                    rank={i + 1}
                    voted={misVotos.has(p.id)}
                    onUpvote={() => toggleUpvote(p.id)}
                  />
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* SIDEBAR derecho — centraliza descubrimiento */}
      <SideRail stats={stats} />
    </div>
  );
}

/* ---------------------------------- Row PH style ---------------------------------- */

function LeaderRow({ p, rank, voted, onUpvote }: { p: any; rank: number; voted: boolean; onUpvote: () => void }) {
  const est = ESTADO_PROYECTO[p.estado];
  const isTop3 = rank <= 3;

  return (
    <Link
      to={`/lin/proyectos/${p.slug || p.id}`}
      className="group flex items-center gap-3 px-3 py-3.5 transition-colors hover:bg-secondary/40 sm:gap-4 sm:px-5"
    >
      {/* Rank */}
      <div className={cn(
        "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-sm font-extrabold tabular-nums sm:h-10 sm:w-10 sm:text-base",
        isTop3 ? "bg-gradient-to-br from-primary to-orange-400 text-primary-foreground shadow-sm" : "bg-secondary text-muted-foreground"
      )}>
        {rank}
      </div>

      {/* Thumbnail */}
      <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-xl border bg-secondary sm:h-14 sm:w-14">
        {p.portada_url ? (
          <img src={p.portada_url} alt="" loading="lazy" className="h-full w-full object-cover" />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/20 to-surface-mint">
            <Rocket className="h-5 w-5 text-foreground/30" />
          </div>
        )}
      </div>

      {/* Info */}
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <h3 className="truncate text-sm font-bold leading-tight group-hover:text-primary sm:text-[15px]">
            {p.nombre}
          </h3>
          {est && (
            <span className={cn("hidden shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider sm:inline-block", est.color)}>
              {est.label}
            </span>
          )}
        </div>
        <p className="mt-0.5 line-clamp-1 text-[12px] leading-snug text-muted-foreground sm:text-xs">
          {p.descripcion || "Sin descripción."}
        </p>
        <div className="mt-1 flex items-center gap-2 text-[10px] font-medium text-muted-foreground sm:text-[11px]">
          <span className="inline-flex items-center gap-1 truncate">
            <Avatar className="h-3.5 w-3.5"><AvatarImage src={p.perfil?.avatar_url || ""} /><AvatarFallback className="text-[7px]">{initials(p.perfil?.nombre)}</AvatarFallback></Avatar>
            <span className="truncate">{p.perfil?.nombre}</span>
          </span>
          {p.categoria && <><span>·</span><span className="truncate">{p.categoria}</span></>}
          <span>·</span>
          <span className="inline-flex items-center gap-0.5"><Users className="h-2.5 w-2.5" />{formatNumber(p.total_seguidores)}</span>
        </div>
      </div>

      {/* Upvote — PH style */}
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); onUpvote(); }}
        aria-pressed={voted}
        className={cn(
          "flex h-12 w-12 shrink-0 flex-col items-center justify-center rounded-xl border-2 font-extrabold tabular-nums transition-all sm:h-14 sm:w-14",
          voted
            ? "border-primary bg-gradient-to-b from-primary to-orange-500 text-primary-foreground shadow-md shadow-primary/30"
            : "border-border bg-background text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary active:scale-95"
        )}
      >
        <Triangle className={cn("h-3 w-3 sm:h-3.5 sm:w-3.5", voted ? "fill-current" : "fill-none")} strokeWidth={2.8} />
        <span className="text-[11px] leading-none sm:text-[13px]">{p.total_upvotes || 0}</span>
      </button>
    </Link>
  );
}

/* ---------------------------------- Side rail ---------------------------------- */

function SideRail({ stats }: { stats: { total: number; votos: number; buscando: number } }) {
  return (
    <aside className="space-y-4 lg:sticky lg:top-4 lg:h-fit">
      {/* Stats card */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b bg-secondary/40 px-4 py-2.5">
          <h3 className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">En este período</h3>
        </div>
        <ul className="divide-y">
          <StatRow icon={Rocket} label="Proyectos" value={stats.total} accent="text-primary" />
          <StatRow icon={Triangle} label="Votos totales" value={stats.votos} accent="text-orange-500" />
          <StatRow icon={Target} label="Reclutando" value={stats.buscando} accent="text-fuchsia-600" />
        </ul>
      </section>

      {/* CTA Launch */}
      <section className="rounded-2xl border bg-gradient-to-br from-primary/15 via-card to-surface-mint p-4">
        <div className="mb-2 inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
          <Zap className="h-4 w-4" />
        </div>
        <p className="text-sm font-bold leading-tight">¿Listo para lanzar?</p>
        <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
          Subí tu proyecto, conseguí votos, feedback y los primeros usuarios.
        </p>
        <Button asChild size="sm" className="mt-3 w-full rounded-full font-semibold">
          <Link to="/lin/proyectos/nuevo">Lanzar proyecto <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </section>

      {/* Cómo funciona */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-2.5">
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <Award className="h-4 w-4 text-primary" /> Cómo funciona
          </h3>
        </div>
        <ol className="space-y-2 px-4 py-3 text-xs leading-relaxed">
          {[
            ["Subí tu proyecto", "Nombre, tagline, portada y link."],
            ["Compartilo", "Invitá a la comunidad a votarte."],
            ["Subí en el ranking", "Más votos = más visibilidad."],
            ["Conseguí tracción", "Seguidores, feedback y leads."],
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

      {/* Atajos cruzados — centraliza con el resto de la red */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="border-b px-4 py-2.5">
          <h3 className="text-sm font-bold">Explorá la red</h3>
        </div>
        <ul className="divide-y text-sm">
          <ShortcutRow to="/lin/hub" icon={Users} label="Comunidades & foro" />
          <ShortcutRow to="/lin/mercado" icon={Sparkles} label="Mercado" />
          <ShortcutRow to="/lin/explorar" icon={Flame} label="Tendencias" />
          <ShortcutRow to="/lin" icon={Calendar} label="Feed" />
        </ul>
      </section>
    </aside>
  );
}

function StatRow({ icon: Icon, label, value, accent }: { icon: any; label: string; value: number; accent: string }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <Icon className={cn("h-4 w-4", accent)} />
      <span className="flex-1 text-xs text-muted-foreground">{label}</span>
      <span className="text-sm font-extrabold tabular-nums">{formatNumber(value)}</span>
    </li>
  );
}

function ShortcutRow({ to, icon: Icon, label }: { to: string; icon: any; label: string }) {
  return (
    <li>
      <Link to={to} className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-secondary/40">
        <Icon className="h-4 w-4 text-muted-foreground" />
        <span className="flex-1 font-medium">{label}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground/50" />
      </Link>
    </li>
  );
}

function EmptyState() {
  return (
    <div className="rounded-2xl border border-dashed bg-card py-16 text-center">
      <Rocket className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
      <p className="text-sm font-medium">Aún no hay proyectos en este período.</p>
      <p className="mt-1 text-xs text-muted-foreground">Sé el primero en lanzar.</p>
      <Button asChild className="mt-4 rounded-full">
        <Link to="/lin/proyectos/nuevo"><Plus className="h-4 w-4" />Lanzar proyecto</Link>
      </Button>
    </div>
  );
}
