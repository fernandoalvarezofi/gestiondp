import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Plus, Users, Search, Hash, Sparkles, Flame, Crown, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Comunidades() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tema, setTema] = useState("all");

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any).from("comunidades")
        .select("*").eq("privada", false)
        .order("total_miembros", { ascending: false });
      setItems(data || []);
      setLoading(false);
    })();
  }, []);

  const tematicas = useMemo(() => {
    const set = new Set<string>();
    items.forEach((c) => c.tematica && set.add(c.tematica));
    return Array.from(set).slice(0, 12);
  }, [items]);

  const filtered = items.filter((c) => {
    if (tema !== "all" && c.tematica !== tema) return false;
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return c.nombre?.toLowerCase().includes(t) || c.descripcion?.toLowerCase().includes(t) || c.tematica?.toLowerCase().includes(t);
  });

  const top3 = items.slice(0, 3);

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* HERO */}
      <section className="relative overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/15 via-background to-surface-mint p-6 sm:p-10">
        <div className="pointer-events-none absolute -right-10 -top-10 h-56 w-56 rounded-full bg-primary/20 blur-3xl" />
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="max-w-xl space-y-3">
            <div className="inline-flex items-center gap-1.5 rounded-full border bg-background/70 px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-primary backdrop-blur">
              <Users className="h-3 w-3" /> Comunidades
            </div>
            <h1 className="text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl md:text-5xl">
              Encontrá tu tribu.<br />Construí la tuya.
            </h1>
            <p className="text-sm text-muted-foreground sm:text-base">
              Servidores temáticos con canales, roles, hilos y reacciones. Conectá con quienes comparten tu rubro, intereses o ambición — al estilo Discord, con el ADN de Woref.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <Button asChild size="lg" className="rounded-full font-semibold">
                <Link to="/lin/comunidades/nueva"><Plus className="h-4 w-4" />Crear comunidad</Link>
              </Button>
              <Button asChild size="lg" variant="outline" className="rounded-full font-semibold">
                <Link to="/lin/explorar"><Sparkles className="h-4 w-4" />Explorar</Link>
              </Button>
            </div>
          </div>
          <div className="flex gap-3">
            <Mini label="Espacios" value={items.length} accent="text-primary" />
            <Mini label="Miembros" value={items.reduce((a, c) => a + (c.total_miembros || 0), 0)} accent="text-fuchsia-600" />
          </div>
        </div>
      </section>

      {/* TOP 3 */}
      {top3.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between">
            <h2 className="flex items-center gap-2 text-lg font-bold"><Flame className="h-5 w-5 text-orange-500" />Las más activas</h2>
          </div>
          <div className="grid gap-4 md:grid-cols-3">
            {top3.map((c, i) => <TopCard key={c.id} c={c} rank={i + 1} />)}
          </div>
        </section>
      )}

      {/* CONTROLES */}
      <section className="space-y-3">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comunidades…" className="h-10 rounded-full border bg-background/60 pl-9 text-sm" />
        </div>
        {tematicas.length > 0 && (
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-1.5 pb-1">
              <Chip active={tema === "all"} onClick={() => setTema("all")}>Todas</Chip>
              {tematicas.map((t) => (
                <Chip key={t} active={tema === t} onClick={() => setTema(t)}>{t}</Chip>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        )}
      </section>

      {/* GRID */}
      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed bg-background py-16 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-muted-foreground" />
          <p className="text-sm font-medium">{items.length === 0 ? "Aún no hay comunidades públicas." : "Sin resultados."}</p>
          <Button asChild className="mt-4 rounded-full">
            <Link to="/lin/comunidades/nueva"><Plus className="h-4 w-4" />Crear la primera</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => <ComunidadCard key={c.id} c={c} />)}
        </div>
      )}
    </div>
  );
}

/* ----- subcomponents ----- */

function Mini({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="rounded-2xl border bg-background/80 px-4 py-3 text-center shadow-sm backdrop-blur">
      <p className={cn("text-2xl font-extrabold leading-none tabular-nums", accent)}>{value}</p>
      <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">{label}</p>
    </div>
  );
}

function Chip({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "shrink-0 rounded-full border px-3.5 py-1.5 text-xs font-semibold transition-colors",
        active ? "border-primary bg-primary text-primary-foreground shadow-sm" : "border-border bg-background hover:bg-secondary"
      )}
    >
      {children}
    </button>
  );
}

function TopCard({ c, rank }: { c: any; rank: number }) {
  return (
    <Link to={`/lin/comunidades/${c.slug}`} className="group relative block overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:shadow-xl hover:shadow-primary/10">
      <div
        className="h-28 bg-gradient-to-br from-primary/20 to-teal-data/20"
        style={c.portada_url ? { backgroundImage: `url(${c.portada_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />
      <div className="relative -mt-7 flex items-end gap-3 px-4">
        {c.avatar_url
          ? <img src={c.avatar_url} className="h-14 w-14 rounded-2xl border-4 border-card object-cover shadow-lg" alt="" />
          : <div className="flex h-14 w-14 items-center justify-center rounded-2xl border-4 border-card bg-secondary text-xl font-bold shadow-lg">{c.nombre?.[0] || "C"}</div>}
        <span className="mb-1 inline-flex items-center gap-1 rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-primary">
          <Crown className="h-3 w-3" />Top #{rank}
        </span>
      </div>
      <div className="space-y-1.5 p-4 pt-3">
        <h3 className="line-clamp-1 font-bold group-hover:text-primary">{c.nombre}</h3>
        <p className="line-clamp-2 text-xs text-muted-foreground">{c.descripcion || "Sin descripción."}</p>
        <div className="flex items-center gap-3 pt-1 text-[11px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.total_miembros || 0}</span>
          {c.tematica && <span className="flex items-center gap-1 truncate"><Hash className="h-3 w-3" />{c.tematica}</span>}
        </div>
      </div>
    </Link>
  );
}

function ComunidadCard({ c }: { c: any }) {
  return (
    <Link to={`/lin/comunidades/${c.slug}`} className="group flex h-full flex-col overflow-hidden rounded-2xl border bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5">
      <div
        className="h-20 bg-gradient-to-br from-primary/15 to-secondary"
        style={c.portada_url ? { backgroundImage: `url(${c.portada_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
      />
      <div className="-mt-6 px-4">
        {c.avatar_url
          ? <img src={c.avatar_url} className="h-12 w-12 rounded-xl border-4 border-card object-cover shadow-md" alt="" />
          : <div className="flex h-12 w-12 items-center justify-center rounded-xl border-4 border-card bg-secondary text-base font-bold shadow-md">{c.nombre?.[0] || "C"}</div>}
      </div>
      <div className="flex flex-1 flex-col gap-1.5 p-4 pt-2">
        <h3 className="line-clamp-1 text-[15px] font-bold leading-tight group-hover:text-primary">{c.nombre}</h3>
        {c.descripcion && <p className="line-clamp-2 text-xs text-muted-foreground">{c.descripcion}</p>}
        <div className="mt-auto flex items-center justify-between pt-2 text-[11px] font-semibold text-muted-foreground">
          <span className="flex items-center gap-1"><Users className="h-3 w-3" />{c.total_miembros || 0} miembros</span>
          {c.tematica && <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium text-foreground">{c.tematica}</span>}
        </div>
      </div>
    </Link>
  );
}
