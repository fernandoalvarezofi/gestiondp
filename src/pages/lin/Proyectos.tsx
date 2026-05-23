import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import {
  Plus, Rocket, TrendingUp, Sparkles, Users, Search, Star, Flame, Globe, Github, ExternalLink,
  Loader2, ArrowUpRight, CheckCircle2, Layers, ChevronUp, Triangle,
} from "lucide-react";
import { ESTADO_PROYECTO, initials } from "@/lib/worefHelpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Orden = "destacados" | "recientes" | "trending" | "upvotes" | "completados";

const FILTROS_ESTADO = [
  { key: "all", label: "Todos", icon: Layers },
  { key: "idea", label: "Ideas", icon: Sparkles },
  { key: "en_desarrollo", label: "En desarrollo", icon: Rocket },
  { key: "lanzado", label: "Lanzados", icon: TrendingUp },
  { key: "buscando_equipo", label: "Buscan equipo", icon: Users },
  { key: "buscando_inversion", label: "Buscan inversión", icon: Star },
  { key: "completado", label: "Completados", icon: CheckCircle2 },
];

export default function Proyectos() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [estado, setEstado] = useState<string>("all");
  const [orden, setOrden] = useState<Orden>("upvotes");
  const [q, setQ] = useState("");
  const [misVotos, setMisVotos] = useState<Set<string>>(new Set());

  const cargarVotos = async (uid: string) => {
    const { data } = await (supabase as any).from("proyecto_upvotes").select("proyecto_id").eq("perfil_id", uid);
    setMisVotos(new Set((data || []).map((v: any) => v.proyecto_id)));
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("proyectos")
        .select("*, perfil:perfiles!perfil_id(id,nombre,username,avatar_url,verificado)")
        .order("destacado", { ascending: false })
        .order("total_upvotes", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(120);
      setItems(data || []);
      setLoading(false);
    })();
    if (user) cargarVotos(user.id);
  }, [user]);

  const toggleUpvote = async (proyectoId: string) => {
    if (!user) { toast.error("Iniciá sesión para votar"); return; }
    const tieneVoto = misVotos.has(proyectoId);
    const nextSet = new Set(misVotos);
    if (tieneVoto) {
      nextSet.delete(proyectoId);
      setMisVotos(nextSet);
      setItems((prev) => prev.map((p) => p.id === proyectoId ? { ...p, total_upvotes: Math.max(0, (p.total_upvotes || 0) - 1) } : p));
      await (supabase as any).from("proyecto_upvotes").delete().eq("proyecto_id", proyectoId).eq("perfil_id", user.id);
    } else {
      nextSet.add(proyectoId);
      setMisVotos(nextSet);
      setItems((prev) => prev.map((p) => p.id === proyectoId ? { ...p, total_upvotes: (p.total_upvotes || 0) + 1 } : p));
      const { error } = await (supabase as any).from("proyecto_upvotes").insert({ proyecto_id: proyectoId, perfil_id: user.id });
      if (error) toast.error("No se pudo registrar el voto");
    }
  };

  const filtered = useMemo(() => {
    let list = [...items];
    if (estado !== "all") list = list.filter((p) => p.estado === estado);
    if (q.trim()) {
      const t = q.toLowerCase();
      list = list.filter((p) =>
        p.nombre?.toLowerCase().includes(t) ||
        p.descripcion?.toLowerCase().includes(t) ||
        p.categoria?.toLowerCase().includes(t) ||
        (p.tags || []).some((tag: string) => tag.toLowerCase().includes(t))
      );
    }
    if (orden === "recientes") list.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
    if (orden === "trending") list.sort((a, b) => (b.total_seguidores || 0) - (a.total_seguidores || 0));
    if (orden === "upvotes") list.sort((a, b) => (b.total_upvotes || 0) - (a.total_upvotes || 0));
    if (orden === "completados") list = list.filter((p) => p.estado === "completado" || p.estado === "lanzado");
    return list;
  }, [items, estado, q, orden]);

  const destacados = useMemo(
    () => [...items].sort((a, b) => (b.total_upvotes || 0) - (a.total_upvotes || 0)).slice(0, 3),
    [items]
  );
  const restantes = useMemo(() => filtered.filter((p) => !destacados.some((d) => d.id === p.id)), [filtered, destacados]);

  // Stats
  const stats = useMemo(() => ({
    total: items.length,
    lanzados: items.filter((p) => p.estado === "lanzado").length,
    buscando: items.filter((p) => p.estado === "buscando_equipo" || p.estado === "buscando_inversion").length,
  }), [items]);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-background to-surface-mint p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-16 -top-16 h-64 w-64 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-20 -left-10 h-56 w-56 rounded-full bg-teal-data/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
              <Rocket className="h-3 w-3" /> Proyectos en marcha
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Descubrí lo que se está<br />construyendo ahora mismo.
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Productos, startups, side-projects y obras en curso. Encontrá tu próximo cofounder, contratá talento, sumate a un equipo o seguí lo que más te inspira.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button asChild size="lg" className="rounded-full font-semibold">
                <Link to="/lin/proyectos/nuevo"><Plus className="h-4 w-4" />Publicar proyecto</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full font-semibold">
                <Link to="/lin/explorar"><Sparkles className="h-4 w-4" />Explorar la red</Link>
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3 sm:gap-4">
            <Stat label="Activos" value={stats.total} accent="text-primary" />
            <Stat label="Lanzados" value={stats.lanzados} accent="text-emerald-600" />
            <Stat label="Reclutando" value={stats.buscando} accent="text-fuchsia-600" />
          </div>
        </div>
      </section>

      {/* TOP DESTACADOS — estilo Product Hunt (ranking por upvotes) */}
      {destacados.length > 0 && destacados[0].total_upvotes > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold">
              <Flame className="h-5 w-5 text-orange-500" /> Top de la semana
            </h2>
            <span className="text-xs font-semibold text-muted-foreground">Votado por la comunidad</span>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {destacados.map((p, i) => (
              <FeaturedCard
                key={p.id}
                p={p}
                rank={i + 1}
                voted={misVotos.has(p.id)}
                onUpvote={() => toggleUpvote(p.id)}
              />
            ))}
          </div>
        </section>
      )}

      {/* CONTROLES */}
      <section className="space-y-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar por nombre, categoría, tag…"
              className="h-10 rounded-full border bg-background/60 pl-9 text-sm"
            />
          </div>
          <select
            value={orden}
            onChange={(e) => setOrden(e.target.value as Orden)}
            className="h-10 rounded-full border bg-background px-3 text-sm font-medium"
          >
            <option value="upvotes">Más votados</option>
            <option value="trending">Más seguidos</option>
            <option value="recientes">Recientes</option>
            <option value="completados">Lanzados</option>
          </select>
        </div>

        <ScrollArea className="w-full whitespace-nowrap">
          <div className="flex gap-1.5 pb-1">
            {FILTROS_ESTADO.map((f) => {
              const Icon = f.icon;
              const active = estado === f.key;
              return (
                <button
                  key={f.key}
                  onClick={() => setEstado(f.key)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
                    active
                      ? "border-primary bg-primary text-primary-foreground shadow-sm"
                      : "border-border bg-background hover:bg-secondary"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {f.label}
                </button>
              );
            })}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </section>

      {/* GRID PRINCIPAL */}
      {loading ? (
        <div className="flex justify-center py-20">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : restantes.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-background py-16 text-center">
          <Rocket className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">Aún no hay proyectos con esos filtros.</p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/lin/proyectos/nuevo"><Plus className="h-4 w-4" />Publicá el primero</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {restantes.map((p) => <ProyectoCard key={p.id} p={p} />)}
        </div>
      )}
    </div>
  );
}

/* ---------------------------------- Cards ---------------------------------- */

function Stat({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="min-w-[80px] rounded-2xl border bg-background/80 px-4 py-3 text-center shadow-sm backdrop-blur">
      <p className={cn("text-2xl font-extrabold leading-none tabular-nums", accent)}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function FeaturedCard({ p, rank }: { p: any; rank: number }) {
  const est = ESTADO_PROYECTO[p.estado];
  return (
    <Link to={`/lin/proyectos/${p.slug || p.id}`} className="group relative block overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10">
      <div className="relative h-36 overflow-hidden bg-gradient-to-br from-primary/20 via-secondary to-teal-data/15">
        {p.portada_url ? (
          <img src={p.portada_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center"><Rocket className="h-10 w-10 text-foreground/20" /></div>
        )}
        <span className="absolute left-3 top-3 flex h-7 w-7 items-center justify-center rounded-full bg-background/95 text-[11px] font-extrabold shadow-md ring-1 ring-border">
          #{rank}
        </span>
        {est && (
          <span className={cn("absolute right-3 top-3 rounded-full px-2 py-0.5 text-[10px] font-semibold backdrop-blur", est.color)}>
            {est.label}
          </span>
        )}
      </div>
      <div className="space-y-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-base font-bold group-hover:text-primary">{p.nombre}</h3>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>
        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.descripcion || "Sin descripción."}</p>
        {typeof p.progreso === "number" && p.progreso > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
              <span>Progreso</span><span className="text-foreground">{p.progreso}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400" style={{ width: `${p.progreso}%` }} />
            </div>
          </div>
        )}
        <div className="flex items-center justify-between border-t pt-2.5">
          <div className="flex items-center gap-1.5">
            <Avatar className="h-5 w-5"><AvatarImage src={p.perfil?.avatar_url || ""} /><AvatarFallback className="text-[9px]">{initials(p.perfil?.nombre)}</AvatarFallback></Avatar>
            <span className="truncate text-[11px] font-medium text-muted-foreground">{p.perfil?.nombre}</span>
          </div>
          <div className="flex items-center gap-1 text-[11px] font-semibold text-muted-foreground">
            <Users className="h-3 w-3" /> {p.total_seguidores || 0}
          </div>
        </div>
      </div>
    </Link>
  );
}

function ProyectoCard({ p }: { p: any }) {
  const est = ESTADO_PROYECTO[p.estado];
  const buscando = (p.buscando || []) as string[];
  const tags = (p.tags || []) as string[];

  return (
    <Link
      to={`/lin/proyectos/${p.slug || p.id}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5"
    >
      <div className="relative aspect-[16/9] overflow-hidden bg-gradient-to-br from-secondary via-background to-surface-mint">
        {p.portada_url ? (
          <img src={p.portada_url} alt="" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <Rocket className="h-9 w-9 text-foreground/15" />
          </div>
        )}
        {est && (
          <Badge className={cn("absolute left-2.5 top-2.5 rounded-full border-0 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider shadow-sm", est.color)}>
            {est.label}
          </Badge>
        )}
        {p.categoria && (
          <span className="absolute right-2.5 top-2.5 rounded-full bg-background/90 px-2 py-0.5 text-[10px] font-semibold text-foreground backdrop-blur">
            {p.categoria}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2.5 p-4">
        <div className="flex items-start justify-between gap-2">
          <h3 className="line-clamp-1 text-[15px] font-bold leading-tight group-hover:text-primary">{p.nombre}</h3>
          <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground/60 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
        </div>

        <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">{p.descripcion || "Sin descripción."}</p>

        {/* Buscando + tags */}
        {(buscando.length > 0 || tags.length > 0) && (
          <div className="flex flex-wrap gap-1">
            {buscando.slice(0, 2).map((b) => (
              <span key={b} className="inline-flex items-center gap-1 rounded-full bg-fuchsia-500/10 px-2 py-0.5 text-[10px] font-semibold text-fuchsia-700 dark:text-fuchsia-300">
                <Sparkles className="h-2.5 w-2.5" />Busca {b}
              </span>
            ))}
            {tags.slice(0, 3).map((t) => (
              <span key={t} className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-muted-foreground">#{t}</span>
            ))}
          </div>
        )}

        {typeof p.progreso === "number" && p.progreso > 0 && (
          <div className="mt-auto space-y-1 pt-1">
            <div className="flex items-center justify-between text-[10px] font-semibold text-muted-foreground">
              <span>Progreso</span><span className="text-foreground">{p.progreso}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-secondary">
              <div className="h-full rounded-full bg-gradient-to-r from-primary to-orange-400 transition-all" style={{ width: `${p.progreso}%` }} />
            </div>
          </div>
        )}

        <div className="mt-auto flex items-center justify-between border-t pt-2.5">
          <div className="flex min-w-0 items-center gap-1.5">
            <Avatar className="h-5 w-5"><AvatarImage src={p.perfil?.avatar_url || ""} /><AvatarFallback className="text-[9px]">{initials(p.perfil?.nombre)}</AvatarFallback></Avatar>
            <span className="truncate text-[11px] font-medium text-muted-foreground">{p.perfil?.nombre}</span>
          </div>
          <div className="flex items-center gap-2.5 text-[11px] font-semibold text-muted-foreground">
            {p.sitio_web && <Globe className="h-3 w-3" />}
            {p.repo_url && <Github className="h-3 w-3" />}
            {p.demo_url && <ExternalLink className="h-3 w-3" />}
            <span className="flex items-center gap-0.5"><Users className="h-3 w-3" />{p.total_seguidores || 0}</span>
          </div>
        </div>
      </div>
    </Link>
  );
}
