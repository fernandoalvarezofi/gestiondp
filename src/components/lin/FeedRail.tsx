import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { TrendingUp, UserPlus, Search, Hash, BadgeCheck, Sparkles, ArrowRight } from "lucide-react";
import { initials, TIPO_USUARIO } from "@/lib/worefHelpers";
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
  const [following, setFollowing] = useState<Set<string>>(new Set());
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      // Trending tags: últimos 7 días, agregamos por tag
      const desde = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { data: posts } = await (supabase as any).from("publicaciones")
        .select("tags").eq("estado", "activa").gte("created_at", desde).limit(500);
      const counts = new Map<string, number>();
      (posts || []).forEach((p: any) => (p.tags || []).forEach((t: string) => {
        const k = t.trim().toLowerCase(); if (!k) return;
        counts.set(k, (counts.get(k) || 0) + 1);
      }));
      const sortedTags = Array.from(counts.entries())
        .sort((a, b) => b[1] - a[1]).slice(0, 6)
        .map(([tag, total]) => ({ tag, total }));
      setTrends(sortedTags);

      // Sugerencias: perfiles verificados / con muchos seguidores, excluyendo al user
      const { data: perfiles } = await (supabase as any).from("perfiles")
        .select("id,nombre,username,avatar_url,tipo,verificado,total_seguidores")
        .order("verificado", { ascending: false })
        .order("total_seguidores", { ascending: false })
        .limit(20);
      const lista = (perfiles || []).filter((p: any) => p.id !== user?.id).slice(0, 5);
      setSuggested(lista);

      if (user) {
        const { data: sigs } = await (supabase as any).from("seguidos")
          .select("seguido_id").eq("seguidor_id", user.id);
        setFollowing(new Set((sigs || []).map((s: any) => s.seguido_id)));
      }
    })();
  }, [user]);

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
      {/* Buscador */}
      <form
        onSubmit={(e) => { e.preventDefault(); if (q.trim()) window.location.href = `/lin/buscar?q=${encodeURIComponent(q)}`; }}
        className="relative"
      >
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar en Woref"
          className="h-10 rounded-full border-none bg-secondary/70 pl-9 text-sm focus-visible:ring-1"
        />
      </form>

      {/* Trending */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-bold"><TrendingUp className="h-4 w-4 text-primary" />Tendencias</h3>
          <Link to="/lin/explorar" className="text-[11px] font-semibold text-muted-foreground hover:text-primary">Ver más</Link>
        </div>
        {trends.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">Aún no hay tendencias.</p>
        ) : (
          <ul>
            {trends.map((t, i) => (
              <li key={t.tag}>
                <Link
                  to={`/lin/buscar?q=${encodeURIComponent("#" + t.tag)}`}
                  className="flex items-center justify-between gap-2 px-4 py-2.5 transition-colors hover:bg-secondary/40"
                >
                  <div className="min-w-0">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">#{i + 1} · Tendencia</p>
                    <p className="flex items-center gap-1 truncate text-sm font-bold"><Hash className="h-3.5 w-3.5 text-primary" />{t.tag}</p>
                    <p className="text-[11px] text-muted-foreground">{t.total} {t.total === 1 ? "publicación" : "publicaciones"}</p>
                  </div>
                  <Sparkles className="h-3.5 w-3.5 text-muted-foreground/40" />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* A quién seguir */}
      <section className="overflow-hidden rounded-2xl border bg-card">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h3 className="flex items-center gap-1.5 text-sm font-bold"><UserPlus className="h-4 w-4 text-primary" />A quién seguir</h3>
          <Link to="/lin/explorar" className="text-[11px] font-semibold text-muted-foreground hover:text-primary">Ver más</Link>
        </div>
        {suggested.length === 0 ? (
          <p className="px-4 py-6 text-center text-xs text-muted-foreground">Sin sugerencias por ahora.</p>
        ) : (
          <ul>
            {suggested.map((p) => {
              const yaSigo = following.has(p.id);
              return (
                <li key={p.id} className="flex items-center gap-2.5 px-4 py-2.5 transition-colors hover:bg-secondary/40">
                  <Link to={`/lin/perfil/${p.username}`} className="shrink-0">
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={p.avatar_url || ""} />
                      <AvatarFallback className="text-xs">{initials(p.nombre)}</AvatarFallback>
                    </Avatar>
                  </Link>
                  <Link to={`/lin/perfil/${p.username}`} className="min-w-0 flex-1">
                    <p className="flex items-center gap-1 truncate text-sm font-bold leading-tight">
                      {p.nombre}
                      {p.verificado && <BadgeCheck className="h-3.5 w-3.5 fill-primary text-primary-foreground" />}
                    </p>
                    <p className="truncate text-[11px] text-muted-foreground">@{p.username} · {TIPO_USUARIO[p.tipo] || ""}</p>
                  </Link>
                  <Button
                    onClick={() => seguir(p.id)}
                    size="sm"
                    variant={yaSigo ? "outline" : "default"}
                    className="h-7 rounded-full px-3 text-[11px] font-bold"
                  >
                    {yaSigo ? "Siguiendo" : "Seguir"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      {/* Atajos */}
      <section className="rounded-2xl border bg-gradient-to-br from-primary/10 via-card to-surface-mint p-4">
        <p className="text-sm font-bold">¿Tenés un proyecto?</p>
        <p className="mt-1 text-xs text-muted-foreground">Publicalo y encontrá cofounders, clientes o inversores.</p>
        <Button asChild size="sm" className="mt-3 w-full rounded-full font-semibold">
          <Link to="/lin/proyectos/nuevo">Publicar proyecto <ArrowRight className="h-3.5 w-3.5" /></Link>
        </Button>
      </section>

      <p className="px-2 text-[10px] text-muted-foreground/60">© 2026 Woref · Términos · Privacidad</p>
    </aside>
  );
}
