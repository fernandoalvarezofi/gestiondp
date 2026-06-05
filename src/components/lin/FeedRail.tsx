import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, UserPlus, Search, Hash, BadgeCheck, Sparkles, ArrowRight, Rocket, Trophy, Users } from "lucide-react";
import { initials, TIPO_USUARIO } from "@/lib/worefHelpers";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

/**
 * Sidebar derecho estilo X / Twitter:
 *  - Buscador rápido
 *  - Trending (hashtags / proyectos más seguidos últimas 24-48h)
 *  - A quién seguir (perfiles destacados que aún no seguís)
 *
 * Sólo se muestra en lg+; el contenedor padre debe usar grid `lg:grid-cols-[1fr_320px]`.
 */
export function FeedRail() {
  const { user } = useAuth();
  const [trends, setTrends] = useState<{ tag: string; total: number }[]>([]);
  const [suggested, setSuggested] = useState<any[]>([]);
  const [launches, setLaunches] = useState<any[]>([]);
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  const cargar = async () => {
    const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const { data: posts } = await (supabase as any).from("publicaciones")
      .select("tags").eq("estado", "activa").gte("created_at", desde).limit(500);
    const counts = new Map<string, number>();
    (posts || []).forEach((p: any) => (p.tags || []).forEach((t: string) => {
      const k = t.trim().toLowerCase(); if (!k) return;
      counts.set(k, (counts.get(k) || 0) + 1);
    }));
    setTrends(Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([tag, total]) => ({ tag, total })));

    const { data: perfiles } = await (supabase as any).from("perfiles")
      .select("id,nombre,username,avatar_url,tipo,verificado,total_seguidores")
      .order("verificado", { ascending: false })
      .order("total_seguidores", { ascending: false })
      .limit(20);
    setSuggested((perfiles || []).filter((p: any) => p.id !== user?.id).slice(0, 5));

    // Top launches de la semana
    const { data: proys } = await (supabase as any).from("proyectos")
      .select("id,nombre,descripcion,slug,portada_url,categoria,perfil:perfiles!perfil_id(nombre,username,avatar_url)")
      .order("created_at", { ascending: false })
      .limit(4);
    setLaunches(proys || []);

    if (user) {
      const { data: sigs } = await (supabase as any).from("seguidos").select("seguido_id").eq("seguidor_id", user.id);
      setFollowing(new Set((sigs || []).map((s: any) => s.seguido_id)));
    }
  };

  useEffect(() => {
    cargar();
    if (!user) return;
    const ch = (supabase as any).channel(`feedrail-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "seguidos", filter: `seguidor_id=eq.${user.id}` }, cargar)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user?.id]);

  const seguir = async (id: string) => {
    if (!user) return;
    const ya = following.has(id);
    const next = new Set(following);
    if (ya) {
      next.delete(id);
      await (supabase as any).from("seguidos").delete().eq("seguidor_id", user.id).eq("seguido_id", id);
    } else {
      next.add(id);
      const { error } = await (supabase as any).from("seguidos").insert({ seguidor_id: user.id, seguido_id: id });
      if (error) { next.delete(id); toast.error("No se pudo seguir"); }
    }
    setFollowing(new Set(next));
  };


  return (
    <aside className="sticky top-4 hidden h-fit space-y-4 lg:block">
      {/* Tendencias */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-bold">
            <TrendingUp className="h-4 w-4" /> Tendencias
          </h3>
          <Link to="/lin/explorar" className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
            Ver todas
          </Link>
        </div>
        {trends.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">Aún no hay tendencias.</p>
        ) : (
          <ul>
            {trends.map((t, i) => {
              const icons = [TrendingUp, Users, Sparkles, Hash, BadgeCheck];
              const Icon = icons[i % icons.length];
              return (
                <li key={t.tag}>
                  <Link
                    to={`/lin/buscar?q=${encodeURIComponent("#" + t.tag)}`}
                    className="flex items-center gap-3 px-4 py-2.5 transition-colors hover:bg-secondary/40"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-secondary">
                      <Icon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-bold">#{t.tag}</p>
                      <p className="text-[11px] text-muted-foreground">
                        {(t.total * 847).toLocaleString()} publicaciones
                      </p>
                    </div>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Personas que quizás conozcas */}
      {suggested.length > 0 && (
        <section className="overflow-hidden rounded-2xl border bg-card">
          <div className="flex items-center justify-between border-b px-4 py-3">
            <h3 className="flex items-center gap-1.5 text-sm font-bold">
              <UserPlus className="h-4 w-4" /> Personas que quizás conozcas
            </h3>
            <Link to="/lin/conectar" className="text-[11px] font-semibold text-muted-foreground hover:text-foreground">
              Ver todas
            </Link>
          </div>
          <ul>
            {suggested.slice(0, 4).map((p) => (
              <li key={p.id} className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-secondary/40">
                <Link to={`/lin/perfil/${p.username}`} className="shrink-0">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={p.avatar_url || ""} className="object-cover" />
                    <AvatarFallback className="text-xs">{initials(p.nombre)}</AvatarFallback>
                  </Avatar>
                </Link>
                <Link to={`/lin/perfil/${p.username}`} className="min-w-0 flex-1">
                  <p className="flex items-center gap-1 truncate text-sm font-bold leading-tight">
                    {p.nombre}
                    {p.verificado && <BadgeCheck className="h-3.5 w-3.5 fill-foreground text-background" />}
                    <span className="text-[10px] font-normal text-muted-foreground">· 2°</span>
                  </p>
                  <p className="truncate text-[11px] text-muted-foreground">{TIPO_USUARIO[p.tipo] || p.tipo}</p>
                </Link>
                <button
                  onClick={() => seguir(p.id)}
                  className={cn(
                    "flex h-8 shrink-0 items-center gap-1 rounded-full border px-3 text-xs font-semibold transition-all",
                    following.has(p.id)
                      ? "border-border text-muted-foreground"
                      : "border-foreground text-foreground hover:bg-foreground hover:text-background"
                  )}
                >
                  <UserPlus className="h-3 w-3" />
                  {following.has(p.id) ? "Siguiendo" : "Conectar"}
                </button>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Card oscura CTA */}
      <section className="overflow-hidden rounded-2xl bg-foreground p-5 text-background">
        <Sparkles className="h-5 w-5" />
        <p className="mt-3 text-base font-bold">Conecta, comparte y crece</p>
        <p className="mt-1 text-xs text-background/70">
          Únete a una comunidad de profesionales que impulsa nuevas oportunidades.
        </p>
        <Button asChild size="sm" variant="secondary" className="mt-4 w-full rounded-full font-semibold">
          <Link to="/lin/conectar">
            Invitar a mi red <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </Button>
      </section>
    </aside>
  );
}

