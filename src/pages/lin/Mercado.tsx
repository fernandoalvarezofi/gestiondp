import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Search, Star, Store, TrendingUp, Sparkles, Plus, ShoppingBag, Zap, Clock } from "lucide-react";
import { formatPrice, PRODUCT_TYPES } from "@/lib/marketplace";
import { useAuth } from "@/contexts/AuthContext";

const SORTS = [
  { id: "relevancia", label: "Relevancia", icon: Sparkles },
  { id: "recientes", label: "Recientes", icon: TrendingUp },
  { id: "precio_asc", label: "Precio ↑", icon: null },
  { id: "precio_desc", label: "Precio ↓", icon: null },
  { id: "rating", label: "Mejor valorados", icon: Star },
];

export default function Mercado() {
  const { user } = useAuth();
  const [cats, setCats] = useState<any[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [tipo, setTipo] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [sort, setSort] = useState("relevancia");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (supabase as any).from("marketplace_categorias").select("*").order("orden").then(({ data }) => setCats(data || []));
  }, []);

  const SELECT_PRODUCTO = `*, vendedor:perfiles!vendedor_id(id,nombre,username,avatar_url,verificado), categoria:marketplace_categorias!categoria_id(nombre,slug,color)`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      let query = (supabase as any)
        .from("marketplace_productos")
        .select(SELECT_PRODUCTO)
        .eq("estado", "activo")
        .limit(60);
      if (cat) query = query.eq("categoria_id", cat);
      if (tipo) query = query.eq("tipo", tipo);
      if (q.trim()) query = query.ilike("titulo", `%${q.trim()}%`);
      if (sort === "recientes") query = query.order("created_at", { ascending: false });
      else if (sort === "precio_asc") query = query.order("precio", { ascending: true });
      else if (sort === "precio_desc") query = query.order("precio", { ascending: false });
      else if (sort === "rating") query = query.order("rating_promedio", { ascending: false });
      else query = query.order("destacado", { ascending: false }).order("total_ventas", { ascending: false }).order("created_at", { ascending: false });
      const { data } = await query;
      if (active) {
        setItems(data || []);
        setLoading(false);
      }
    })();
    return () => { active = false; };
  }, [cat, tipo, q, sort]);

  // Realtime: nuevos productos, ediciones y eliminaciones aparecen al instante
  useEffect(() => {
    const ch = (supabase as any).channel("mercado_productos_rt")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "marketplace_productos" }, async (payload: any) => {
        if (payload.new?.estado !== "activo") return;
        const { data: row } = await (supabase as any).from("marketplace_productos").select(SELECT_PRODUCTO).eq("id", payload.new.id).maybeSingle();
        if (!row) return;
        setItems((arr) => arr.some((p) => p.id === row.id) ? arr : [row, ...arr]);
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "marketplace_productos" }, (payload: any) => {
        setItems((arr) => {
          if (payload.new?.estado && payload.new.estado !== "activo") return arr.filter((p) => p.id !== payload.new.id);
          return arr.map((p) => p.id === payload.new.id ? { ...p, ...payload.new } : p);
        });
      })
      .on("postgres_changes", { event: "DELETE", schema: "public", table: "marketplace_productos" }, (payload: any) => {
        setItems((arr) => arr.filter((p) => p.id !== payload.old?.id));
      })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, []);

  const destacados = useMemo(() => items.filter((p) => p.destacado).slice(0, 4), [items]);
  const recientes = useMemo(() => {
    const day = Date.now() - 24 * 60 * 60 * 1000;
    return items
      .filter((p) => new Date(p.created_at).getTime() > day)
      .sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
      .slice(0, 8);
  }, [items]);
  const isNew = (created_at: string) => Date.now() - new Date(created_at).getTime() < 24 * 60 * 60 * 1000;

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* HERO */}
      <div className="relative mb-6 overflow-hidden rounded-2xl border bg-gradient-to-br from-primary/15 via-background to-secondary/30 p-6 sm:p-8">
        <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
          <div>
            <div className="mb-2 inline-flex items-center gap-1.5 rounded-full border bg-background/80 px-3 py-1 text-xs font-medium backdrop-blur">
              <Store className="h-3.5 w-3.5 text-primary" /> Mercado Woref
            </div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">El marketplace digital de los que construyen</h1>
            <p className="mt-1 max-w-xl text-sm text-muted-foreground">Plantillas, código, IA, cursos, webs y servicios — comprá y vendé directo con cada creador.</p>
          </div>
          {user && (
            <Button asChild size="lg" className="gap-1.5 shrink-0">
              <Link to="/lin/vendedor/productos"><Plus className="h-4 w-4" /> Vender mi producto</Link>
            </Button>
          )}
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
      </div>

      {/* SEARCH + SORT */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos, plantillas, cursos…" className="pl-9" />
        </div>
        <ScrollArea className="sm:max-w-md">
          <div className="flex gap-1">
            {SORTS.map((s) => (
              <Button key={s.id} variant={sort === s.id ? "default" : "outline"} size="sm" onClick={() => setSort(s.id)} className="shrink-0 gap-1.5">
                {s.icon && <s.icon className="h-3.5 w-3.5" />}
                {s.label}
              </Button>
            ))}
          </div>
          <ScrollBar orientation="horizontal" />
        </ScrollArea>
      </div>

      {/* CATEGORÍAS */}
      <ScrollArea className="mb-3">
        <div className="flex gap-2 pb-2">
          <button
            onClick={() => setCat(null)}
            className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${!cat ? "border-primary bg-primary text-primary-foreground" : "hover:bg-secondary"}`}
          >
            Todas
          </button>
          {cats.map((c) => (
            <button
              key={c.id}
              onClick={() => setCat(c.id === cat ? null : c.id)}
              style={cat === c.id ? { background: c.color, borderColor: c.color, color: "white" } : {}}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition ${cat !== c.id ? "hover:bg-secondary" : ""}`}
            >
              {c.nombre}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* TIPOS */}
      <ScrollArea className="mb-6">
        <div className="flex gap-1.5 pb-2">
          <button
            onClick={() => setTipo(null)}
            className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${!tipo ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"}`}
          >
            Todos los tipos
          </button>
          {PRODUCT_TYPES.map((t) => (
            <button
              key={t.id}
              onClick={() => setTipo(t.id === tipo ? null : t.id)}
              className={`shrink-0 rounded-md border px-2.5 py-1 text-[11px] font-medium transition ${tipo === t.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground hover:bg-secondary"}`}
            >
              <span className="mr-1">{t.icon}</span>{t.label}
            </button>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* DESTACADOS */}
      {destacados.length > 0 && !q && !cat && !tipo && (
        <div className="mb-8">
          <div className="mb-3 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Destacados</h2>
          </div>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {destacados.map((p) => <ProductCard key={p.id} p={p} featured />)}
          </div>
        </div>
      )}

      {/* RECIÉN PUBLICADOS - rail */}
      {recientes.length > 0 && !q && !cat && !tipo && (
        <div className="mb-8">
          <div className="mb-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="relative flex h-2 w-2">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-500 opacity-75" />
                <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
              </span>
              <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">Recién publicados</h2>
              <Badge variant="secondary" className="gap-1 text-[10px]"><Zap className="h-2.5 w-2.5" />En vivo</Badge>
            </div>
          </div>
          <ScrollArea>
            <div className="flex gap-3 pb-3">
              {recientes.map((p) => (
                <div key={p.id} className="w-[240px] shrink-0 sm:w-[260px]">
                  <ProductCard p={p} isNew />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      )}

      {/* GRID */}
      {loading ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i}><CardContent className="p-3"><Skeleton className="aspect-video w-full rounded-lg" /><Skeleton className="mt-3 h-4 w-3/4" /><Skeleton className="mt-2 h-3 w-1/2" /></CardContent></Card>
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border bg-card p-12 text-center">
          <ShoppingBag className="mx-auto h-10 w-10 text-muted-foreground/40" />
          <p className="mt-3 font-semibold">Sin productos por ahora</p>
          <p className="mt-1 text-sm text-muted-foreground">Probá cambiar los filtros o sé el primero en publicar.</p>
          {user && (
            <Button asChild className="mt-4 gap-1.5"><Link to="/lin/vendedor/productos"><Plus className="h-4 w-4" /> Publicar producto</Link></Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {items.map((p) => <ProductCard key={p.id} p={p} isNew={isNew(p.created_at)} />)}
        </div>
      )}
    </div>
  );
}

function ProductCard({ p, featured, isNew }: { p: any; featured?: boolean; isNew?: boolean }) {
  const typeMeta = PRODUCT_TYPES.find((t) => t.id === p.tipo);
  return (
    <Link to={`/lin/mercado/${p.slug}`} className="group block">
      <Card className="h-full overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
        <div className="relative aspect-video overflow-hidden bg-gradient-to-br from-secondary/40 to-secondary">
          {p.portada_url ? (
            <img src={p.portada_url} alt={p.titulo} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl opacity-30">
              {typeMeta?.icon ?? "📦"}
            </div>
          )}
          {/* gradient overlay on hover for legibilidad */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/70 via-black/10 to-transparent opacity-0 transition-opacity duration-300 group-hover:opacity-100" />

          <div className="absolute left-2 top-2 flex flex-col gap-1">
            {featured && (
              <Badge className="gap-1 bg-primary/95 shadow-sm"><Sparkles className="h-3 w-3" /> Destacado</Badge>
            )}
            {isNew && !featured && (
              <Badge className="gap-1 border-0 bg-emerald-500/95 text-white shadow-sm"><Clock className="h-3 w-3" /> Nuevo</Badge>
            )}
          </div>

          {p.categoria && (
            <span style={{ background: `${p.categoria.color}E6` }} className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
              {p.categoria.nombre}
            </span>
          )}

          {/* Preview info en hover (resumen visible) */}
          <div className="pointer-events-none absolute inset-x-0 bottom-0 translate-y-2 p-2 opacity-0 transition-all duration-300 group-hover:translate-y-0 group-hover:opacity-100">
            <p className="line-clamp-2 text-[11px] font-medium leading-snug text-white drop-shadow">
              {p.resumen || p.descripcion}
            </p>
          </div>
        </div>

        <CardContent className="space-y-2 p-3">
          <div className="flex items-start justify-between gap-2">
            <p className="line-clamp-1 font-semibold leading-snug">{p.titulo}</p>
            <p className="shrink-0 font-display text-base font-bold text-primary">{formatPrice(Number(p.precio), p.moneda)}</p>
          </div>
          <p className="line-clamp-2 text-xs text-muted-foreground">{p.resumen || p.descripcion}</p>

          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {p.vendedor?.avatar_url ? (
                <img src={p.vendedor.avatar_url} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-5 w-5 shrink-0 rounded-full bg-secondary" />
              )}
              <span className="truncate text-[11px] text-muted-foreground">{p.vendedor?.nombre ?? "—"}</span>
              {p.vendedor?.verificado && <span className="text-[11px] text-primary">✓</span>}
            </div>
            <div className="flex shrink-0 items-center gap-2 text-[11px] text-muted-foreground">
              {typeMeta && <span title={typeMeta.label}>{typeMeta.icon}</span>}
              {p.total_reviews > 0 && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 fill-amber-400 text-amber-400" />
                  <span className="font-medium">{Number(p.rating_promedio).toFixed(1)}</span>
                </span>
              )}
              {p.total_ventas > 0 && <span>· {p.total_ventas} ventas</span>}
            </div>
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
