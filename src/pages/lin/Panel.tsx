import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  Eye, Heart, MessageCircle, Users, Trash2, TrendingUp, TrendingDown,
  Image as ImageIcon, Film, FileText, BarChart3, ArrowUpRight, Sparkles,
  Bookmark, Repeat2, Trophy, Calendar, Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar, PieChart, Pie, Cell, Legend } from "recharts";
import { initials, formatTime } from "@/lib/worefHelpers";
import { useConfirm } from "@/components/lin/ConfirmDialog";


type Periodo = "7d" | "30d" | "90d";
const COLORES = ["hsl(var(--primary))", "#10b981", "#f59e0b", "#8b5cf6", "#ec4899"];

export default function Panel() {
  const { user } = useAuth();
  const confirm = useConfirm();

  const [p, setP] = useState<any>(null);
  const [pubs, setPubs] = useState<any[]>([]);
  const [seguidores, setSeguidores] = useState<any[]>([]);
  const [periodo, setPeriodo] = useState<Periodo>("30d");
  const [loading, setLoading] = useState(true);

  const dias = periodo === "7d" ? 7 : periodo === "30d" ? 30 : 90;
  const desde = useMemo(() => {
    const d = new Date(); d.setDate(d.getDate() - dias);
    return d.toISOString();
  }, [dias]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      const [perfRes, pubsRes, segRes] = await Promise.all([
        (supabase as any).from("perfiles").select("*").eq("id", user.id).single(),
        (supabase as any).from("publicaciones")
          .select("id,titulo,cuerpo,vistas,total_likes,total_comentarios,total_repostes,total_guardados,estado,formato,tipo,es_reel,imagen_url,thumbnail_url,created_at")
          .eq("perfil_id", user.id).neq("estado", "eliminada").order("created_at", { ascending: false }).limit(200),
        (supabase as any).from("seguidores")
          .select("created_at, seguidor:perfiles!seguidor_id(id,nombre,username,avatar_url,verificado)")
          .eq("seguido_id", user.id).order("created_at", { ascending: false }).limit(50),
      ]);
      setP(perfRes.data);
      setPubs(pubsRes.data || []);
      setSeguidores(segRes.data || []);
      setLoading(false);
    })();
  }, [user]);

  const pubsPeriodo = useMemo(
    () => pubs.filter((x) => x.created_at >= desde),
    [pubs, desde]
  );

  const totales = useMemo(() => {
    const acc = { vistas: 0, likes: 0, coms: 0, reposts: 0, guardados: 0 };
    pubsPeriodo.forEach((x) => {
      acc.vistas += x.vistas || 0;
      acc.likes += x.total_likes || 0;
      acc.coms += x.total_comentarios || 0;
      acc.reposts += x.total_repostes || 0;
      acc.guardados += x.total_guardados || 0;
    });
    return acc;
  }, [pubsPeriodo]);

  const engagement = totales.vistas > 0
    ? ((totales.likes + totales.coms + totales.reposts) / totales.vistas) * 100
    : 0;

  // Previous period for delta
  const totalesPrev = useMemo(() => {
    const start = new Date(desde); start.setDate(start.getDate() - dias);
    const end = new Date(desde);
    const acc = { vistas: 0, likes: 0, coms: 0 };
    pubs.forEach((x) => {
      const t = new Date(x.created_at);
      if (t >= start && t < end) {
        acc.vistas += x.vistas || 0;
        acc.likes += x.total_likes || 0;
        acc.coms += x.total_comentarios || 0;
      }
    });
    return acc;
  }, [pubs, desde, dias]);

  const delta = (curr: number, prev: number) =>
    prev === 0 ? (curr > 0 ? 100 : 0) : ((curr - prev) / prev) * 100;

  // Time series — agrupar por día
  const serieTiempo = useMemo(() => {
    const buckets: Record<string, { fecha: string; vistas: number; likes: number; coms: number }> = {};
    for (let i = dias - 1; i >= 0; i--) {
      const d = new Date(); d.setDate(d.getDate() - i);
      const key = d.toISOString().slice(0, 10);
      buckets[key] = { fecha: key, vistas: 0, likes: 0, coms: 0 };
    }
    pubsPeriodo.forEach((x) => {
      const key = x.created_at.slice(0, 10);
      if (buckets[key]) {
        buckets[key].vistas += x.vistas || 0;
        buckets[key].likes += x.total_likes || 0;
        buckets[key].coms += x.total_comentarios || 0;
      }
    });
    return Object.values(buckets).map((b) => ({
      ...b,
      label: new Date(b.fecha).toLocaleDateString("es-AR", { day: "2-digit", month: "short" }),
    }));
  }, [pubsPeriodo, dias]);

  // Distribución por formato
  const distribucion = useMemo(() => {
    const map: Record<string, number> = {};
    pubsPeriodo.forEach((x) => {
      const k = x.es_reel ? "reel" : (x.formato || "texto");
      map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [pubsPeriodo]);

  // Top posts
  const topPubs = useMemo(
    () => [...pubsPeriodo]
      .sort((a, b) => (b.vistas + b.total_likes * 3 + b.total_comentarios * 5) - (a.vistas + a.total_likes * 3 + a.total_comentarios * 5))
      .slice(0, 5),
    [pubsPeriodo]
  );

  // Seguidores en periodo
  const segPeriodo = seguidores.filter((s) => s.created_at >= desde);

  const eliminar = async (id: string) => {
    const ok = await confirm({ title: "¿Eliminar publicación?", description: "Esta acción no se puede deshacer.", confirmText: "Eliminar", destructive: true });
    if (!ok) return;
    await (supabase as any).from("publicaciones").update({ estado: "eliminada" }).eq("id", id).eq("perfil_id", user?.id);
    setPubs((prev) => prev.filter((x) => x.id !== id));
    toast.success("Publicación eliminada");
  };


  if (loading || !p) {
    return (
      <div className="flex justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      {/* HEADER */}
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-1.5">
          <div className="inline-flex items-center gap-1.5 rounded-full border bg-primary/5 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary">
            <BarChart3 className="h-3 w-3" /> Panel de control
          </div>
          <h1 className="font-display text-3xl font-bold tracking-tight sm:text-4xl">Hola, {p.nombre?.split(" ")[0]}</h1>
          <p className="text-sm text-muted-foreground">Tu desempeño en Woref — actualizado en vivo.</p>
        </div>
        <Tabs value={periodo} onValueChange={(v) => setPeriodo(v as Periodo)}>
          <TabsList className="rounded-full">
            <TabsTrigger value="7d" className="rounded-full text-xs">7 días</TabsTrigger>
            <TabsTrigger value="30d" className="rounded-full text-xs">30 días</TabsTrigger>
            <TabsTrigger value="90d" className="rounded-full text-xs">90 días</TabsTrigger>
          </TabsList>
        </Tabs>
      </header>

      {/* KPI CARDS */}
      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <KPI icon={Eye} label="Vistas" value={totales.vistas} delta={delta(totales.vistas, totalesPrev.vistas)} accent="text-blue-600" />
        <KPI icon={Heart} label="Me gusta" value={totales.likes} delta={delta(totales.likes, totalesPrev.likes)} accent="text-rose-600" />
        <KPI icon={MessageCircle} label="Comentarios" value={totales.coms} delta={delta(totales.coms, totalesPrev.coms)} accent="text-emerald-600" />
        <KPI icon={Sparkles} label="Engagement" value={engagement} suffix="%" decimals={2} accent="text-primary" />
      </section>

      {/* CHART + AUDIENCE */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="text-base">Actividad reciente</CardTitle>
              <p className="text-xs text-muted-foreground">Vistas, likes y comentarios por día</p>
            </div>
            <Badge variant="secondary" className="rounded-full">{dias} días</Badge>
          </CardHeader>
          <CardContent>
            <div className="h-[280px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={serieTiempo} margin={{ top: 8, right: 8, left: -20, bottom: 0 }}>
                  <defs>
                    <linearGradient id="gV" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} interval="preserveStartEnd" />
                  <YAxis tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }} />
                  <Tooltip
                    contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }}
                    labelStyle={{ fontWeight: 600 }}
                  />
                  <Area type="monotone" dataKey="vistas" stroke="hsl(var(--primary))" strokeWidth={2} fill="url(#gV)" />
                  <Area type="monotone" dataKey="likes" stroke="#f43f5e" strokeWidth={1.5} fill="transparent" />
                  <Area type="monotone" dataKey="coms" stroke="#10b981" strokeWidth={1.5} fill="transparent" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Audiencia</CardTitle>
            <p className="text-xs text-muted-foreground">Tu red en Woref</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-3 gap-2 text-center">
              <Stat n={p.total_seguidores} l="Seguidores" />
              <Stat n={p.total_siguiendo} l="Siguiendo" />
              <Stat n={p.score} l="Score" />
            </div>
            <div className="rounded-xl border bg-secondary/30 p-3">
              <div className="mb-2 flex items-center justify-between text-xs">
                <span className="font-semibold">Nuevos seguidores</span>
                <Badge variant="secondary" className="rounded-full">+{segPeriodo.length}</Badge>
              </div>
              <div className="space-y-1.5">
                {segPeriodo.slice(0, 4).map((s) => (
                  <Link key={s.seguidor?.id} to={`/lin/perfil/${s.seguidor?.username}`} className="flex items-center gap-2 rounded-md p-1 hover:bg-secondary">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={s.seguidor?.avatar_url || ""} />
                      <AvatarFallback className="text-[10px]">{initials(s.seguidor?.nombre || "??")}</AvatarFallback>
                    </Avatar>
                    <span className="min-w-0 flex-1 truncate text-xs font-medium">{s.seguidor?.nombre}</span>
                    <span className="text-[10px] text-muted-foreground">{formatTime(s.created_at)}</span>
                  </Link>
                ))}
                {segPeriodo.length === 0 && <p className="py-2 text-center text-[11px] text-muted-foreground">Sin nuevos seguidores</p>}
              </div>
            </div>
          </CardContent>
        </Card>
      </section>

      {/* DISTRIBUTION + TOP */}
      <section className="grid gap-4 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Contenido por formato</CardTitle>
            <p className="text-xs text-muted-foreground">Qué publicaste en este período</p>
          </CardHeader>
          <CardContent>
            {distribucion.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Sin publicaciones en el período.</p>
            ) : (
              <div className="h-[200px]">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={distribucion} dataKey="value" innerRadius={45} outerRadius={75} paddingAngle={2}>
                      {distribucion.map((_, i) => <Cell key={i} fill={COLORES[i % COLORES.length]} />)}
                    </Pie>
                    <Legend wrapperStyle={{ fontSize: 11 }} iconType="circle" />
                    <Tooltip contentStyle={{ background: "hsl(var(--popover))", border: "1px solid hsl(var(--border))", borderRadius: 10, fontSize: 12 }} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <div>
              <CardTitle className="flex items-center gap-1.5 text-base"><Trophy className="h-4 w-4 text-amber-500" />Top publicaciones</CardTitle>
              <p className="text-xs text-muted-foreground">Las que mejor performaron</p>
            </div>
          </CardHeader>
          <CardContent className="space-y-1.5">
            {topPubs.length === 0 ? (
              <p className="py-8 text-center text-xs text-muted-foreground">Aún no hay datos suficientes.</p>
            ) : topPubs.map((pub, i) => (
              <Link key={pub.id} to={`/lin/publicacion/${pub.id}`}
                className="flex items-center gap-3 rounded-xl border p-2.5 transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-sm">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-primary/20 to-primary/5 text-sm font-bold text-primary">
                  #{i + 1}
                </div>
                {(pub.imagen_url || pub.thumbnail_url) ? (
                  <img src={pub.thumbnail_url || pub.imagen_url} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-lg object-cover" />
                ) : (
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-secondary">
                    {pub.es_reel ? <Film className="h-4 w-4" /> : pub.formato === "imagen" ? <ImageIcon className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{pub.titulo || pub.cuerpo?.slice(0, 80) || "Sin título"}</p>
                  <div className="mt-0.5 flex items-center gap-3 text-[11px] text-muted-foreground">
                    <span className="flex items-center gap-0.5"><Eye className="h-3 w-3" />{pub.vistas}</span>
                    <span className="flex items-center gap-0.5"><Heart className="h-3 w-3" />{pub.total_likes}</span>
                    <span className="flex items-center gap-0.5"><MessageCircle className="h-3 w-3" />{pub.total_comentarios}</span>
                  </div>
                </div>
                <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            ))}
          </CardContent>
        </Card>
      </section>

      {/* ALL PUBS */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Mis publicaciones <span className="ml-1.5 text-xs font-normal text-muted-foreground">({pubs.length})</span></CardTitle>
          <Button asChild size="sm" variant="outline" className="rounded-full">
            <Link to="/lin/publicar">Nueva publicación</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {pubs.length === 0 ? (
            <div className="rounded-xl border border-dashed py-12 text-center">
              <p className="text-sm text-muted-foreground">Aún no publicaste nada.</p>
              <Button asChild size="sm" className="mt-3 rounded-full">
                <Link to="/lin/publicar">Crear tu primera publicación</Link>
              </Button>
            </div>
          ) : (
            <div className="space-y-1.5">
              {pubs.map((pub) => (
                <div key={pub.id} className="group flex items-center gap-2 rounded-lg border px-3 py-2 transition-colors hover:bg-secondary/40">
                  <Link to={`/lin/publicacion/${pub.id}`} className="flex min-w-0 flex-1 items-center gap-3">
                    {(pub.imagen_url || pub.thumbnail_url) ? (
                      <img src={pub.thumbnail_url || pub.imagen_url} alt="" loading="lazy" className="hidden h-10 w-10 shrink-0 rounded-md object-cover sm:block" />
                    ) : (
                      <div className="hidden h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary sm:flex">
                        {pub.es_reel ? <Film className="h-4 w-4" /> : <FileText className="h-4 w-4" />}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{pub.titulo || pub.cuerpo?.slice(0, 80) || "Sin título"}</p>
                      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        <span>{new Date(pub.created_at).toLocaleDateString("es-AR")}</span>
                        <Badge variant="outline" className="h-4 rounded-full px-1.5 text-[9px] font-normal">{pub.es_reel ? "reel" : pub.formato}</Badge>
                      </div>
                    </div>
                    <div className="hidden shrink-0 gap-3 text-xs text-muted-foreground sm:flex">
                      <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{pub.vistas}</span>
                      <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{pub.total_likes}</span>
                      <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{pub.total_comentarios}</span>
                      <span className="flex items-center gap-1"><Bookmark className="h-3 w-3" />{pub.total_guardados}</span>
                      <span className="flex items-center gap-1"><Repeat2 className="h-3 w-3" />{pub.total_repostes}</span>
                    </div>
                  </Link>
                  <button
                    onClick={() => eliminar(pub.id)}
                    className="rounded-md p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-destructive/10 hover:text-destructive group-hover:opacity-100"
                    aria-label="Eliminar"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ───── Subcomponents ───── */
function KPI({ icon: I, label, value, delta, accent, suffix = "", decimals = 0 }: any) {
  const positive = delta === undefined ? null : delta >= 0;
  return (
    <Card className="overflow-hidden">
      <CardContent className="space-y-2 p-4">
        <div className="flex items-center justify-between">
          <I className={cn("h-4 w-4", accent)} />
          {delta !== undefined && (
            <span className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-[10px] font-semibold tabular-nums",
              positive ? "bg-emerald-500/10 text-emerald-600" : "bg-rose-500/10 text-rose-600"
            )}>
              {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
              {Math.abs(delta).toFixed(0)}%
            </span>
          )}
        </div>
        <p className="font-display text-2xl font-bold tabular-nums leading-none">
          {value.toLocaleString("es-AR", { maximumFractionDigits: decimals })}{suffix}
        </p>
        <p className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}

function Stat({ n, l }: { n: number; l: string }) {
  return (
    <div className="rounded-lg border bg-background py-2">
      <p className="font-display text-lg font-bold tabular-nums leading-none">{n?.toLocaleString("es-AR") || 0}</p>
      <p className="mt-0.5 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{l}</p>
    </div>
  );
}
