import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Star, Sparkles, Plus, ShoppingBag, Clock, CheckCircle2, XCircle, ShieldCheck,
  Users2, Ban, Tag, Zap, LayoutGrid, ArrowRight,
} from "lucide-react";
import { formatPrice, PRODUCT_TYPES } from "@/lib/marketplace";
import { useAuth } from "@/contexts/AuthContext";

export default function Mercado() {
  const { user } = useAuth();
  const [cats, setCats] = useState<any[]>([]);
  const [cat, setCat] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (supabase as any).from("marketplace_categorias").select("*").order("orden").then(({ data }: any) => setCats(data || []));
  }, []);

  const SELECT_PRODUCTO = `*, vendedor:perfiles!vendedor_id(id,nombre,username,avatar_url,verificado), categoria:marketplace_categorias!categoria_id(nombre,slug,color)`;

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      let query = (supabase as any).from("marketplace_productos").select(SELECT_PRODUCTO)
        .eq("estado", "activo").limit(60)
        .order("destacado", { ascending: false }).order("total_ventas", { ascending: false }).order("created_at", { ascending: false });
      if (cat) query = query.eq("categoria_id", cat);
      if (q.trim()) query = query.ilike("titulo", `%${q.trim()}%`);
      const { data } = await query;
      if (active) { setItems(data || []); setLoading(false); }
    })();
    return () => { active = false; };
  }, [cat, q]);

  useEffect(() => {
    const ch = (supabase as any).channel("mercado_rt")
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

  const destacados = useMemo(() => items.filter((p) => p.destacado).slice(0, 8), [items]);
  const catActiva = cats.find((c) => c.id === cat);
  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* HERO */}
      <section className="relative mb-10 overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-secondary/40 p-6 sm:p-10">
        <div className="grid items-center gap-8 md:grid-cols-2">
          <div>
            <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
              Comprá y vendé<br /><span className="text-primary">productos digitales</span>
            </h1>
            <p className="mt-3 max-w-md text-sm text-muted-foreground">
              El marketplace donde creadores y compradores se encuentran directamente, sin intermediarios.
            </p>
            <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2">
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><CheckCircle2 className="h-4 w-4 text-primary" /> Sin intermediarios</span>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><XCircle className="h-4 w-4 text-primary" /> Sin comisiones ocultas</span>
              <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"><ShieldCheck className="h-4 w-4 text-primary" /> Trato directo y seguro</span>
            </div>
            <div className="mt-6 flex flex-wrap gap-3">
              <Button onClick={scrollToGrid} className="rounded-full px-6">Explorar productos</Button>
              {user && (
                <Button asChild variant="outline" className="rounded-full px-6">
                  <Link to="/lin/vendedor/productos"><Plus className="h-4 w-4" /> Vender un producto</Link>
                </Button>
              )}
            </div>
          </div>
          <div className="hidden md:block">
            <Card className="bg-card/80 shadow-sm backdrop-blur">
              <CardContent className="p-5">
                <div className="flex items-center gap-3">
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><Users2 className="h-6 w-6 text-primary" /></div>
                    <Badge className="mb-1">Vendedor</Badge>
                    <p className="text-xs text-muted-foreground">Crea y publica tu producto</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><CheckCircle2 className="h-6 w-6 text-primary" /></div>
                    <Badge variant="outline" className="mb-1">Acuerdo</Badge>
                    <p className="text-xs text-muted-foreground">Trato directo y seguro</p>
                  </div>
                  <ArrowRight className="h-4 w-4 shrink-0 text-muted-foreground" />
                  <div className="flex flex-1 flex-col items-center text-center">
                    <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10"><ShoppingBag className="h-6 w-6 text-primary" /></div>
                    <Badge variant="secondary" className="mb-1">Comprador</Badge>
                    <p className="text-xs text-muted-foreground">Compra y descarga al instante</p>
                  </div>
                </div>
                <p className="mt-4 text-center text-xs text-muted-foreground">Sin intermediarios, sin comisiones extra</p>
              </CardContent>
            </Card>
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
      </section>

      {/* CATEGORÍAS */}
      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold">Explorá por categorías</h2>
          {cat && <button onClick={() => setCat(null)} className="text-sm font-medium text-primary hover:underline">Ver todas</button>}
        </div>
        <div className="grid grid-cols-4 gap-3 sm:grid-cols-6 lg:grid-cols-8">
          <button onClick={() => setCat(null)}
            className={`flex flex-col items-center gap-2 rounded-xl border p-3 transition hover:border-primary hover:bg-primary/5 ${!cat ? "border-primary bg-primary/5" : ""}`}>
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary/10"><LayoutGrid className="h-4 w-4 text-primary" /></div>
            <span className="text-xs font-medium">Todas</span>
          </button>
          {cats.map((c) => (
            <button key={c.id} onClick={() => setCat(c.id === cat ? null : c.id)}
              style={c.id === cat ? { borderColor: c.color, background: `${c.color}10` } : {}}
              className="flex flex-col items-center gap-2 rounded-xl border p-3 transition hover:border-primary/40 hover:bg-secondary/40">
              <div className="flex h-9 w-9 items-center justify-center rounded-full text-lg" style={{ background: `${c.color}20` }}>📦</div>
              <span className="line-clamp-1 text-xs font-medium">{c.nombre}</span>
            </button>
          ))}
        </div>
      </section>

      {/* SEARCH */}
      <div className="mb-6">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar productos, plantillas, cursos…" className="pl-9" />
        </div>
      </div>

      {/* DESTACADOS */}
      {destacados.length > 0 && !q && (
        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              <h2 className="text-lg font-bold">Productos destacados</h2>
            </div>
          </div>
          <ScrollArea>
            <div className="flex gap-4 pb-3">
              {destacados.map((p) => (
                <div key={p.id} className="w-[260px] shrink-0 snap-start">
                  <ProductCard p={p} featured />
                </div>
              ))}
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </section>
      )}

      {/* GRID */}
      <section ref={gridRef} className="mb-12">
        <h2 className="mb-4 text-lg font-bold">
          {q ? `Resultados para "${q}" (${items.length})` : catActiva ? `Categoría: ${catActiva.nombre}` : "Todos los productos"}
        </h2>
        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {Array.from({ length: 10 }).map((_, i) => (
              <Card key={i}><CardContent className="p-3"><Skeleton className="aspect-[4/3] w-full rounded-lg" /><Skeleton className="mt-3 h-4 w-3/4" /><Skeleton className="mt-2 h-3 w-1/2" /></CardContent></Card>
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
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            {items.map((p) => <ProductCard key={p.id} p={p} />)}
          </div>
        )}
      </section>

      {/* POR QUÉ */}
      <section className="mb-6 rounded-3xl border bg-secondary/30 p-6 sm:p-10">
        <div className="mb-6 text-center">
          <h2 className="text-xl font-bold sm:text-2xl">Por qué elegir Woref Mercado</h2>
        </div>
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
          {[
            { icon: Users2, title: "Conexión directa", desc: "Compradores y vendedores se conectan directamente." },
            { icon: Ban, title: "Sin intermediarios", desc: "Sin comisiones ocultas ni cargos adicionales." },
            { icon: Tag, title: "Vos ponés el precio", desc: "Decidís exactamente cuánto vale tu trabajo." },
            { icon: ShieldCheck, title: "Pagos seguros", desc: "Procesamos de forma segura y protegida." },
            { icon: Zap, title: "Descarga inmediata", desc: "El comprador obtiene acceso al instante." },
          ].map((f) => (
            <div key={f.title} className="flex flex-col items-center rounded-xl bg-card p-4 text-center">
              <div className="mb-2 flex h-10 w-10 items-center justify-center rounded-full bg-primary/10"><f.icon className="h-5 w-5 text-primary" /></div>
              <p className="text-sm font-semibold">{f.title}</p>
              <p className="mt-1 text-xs text-muted-foreground">{f.desc}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function ProductCard({ p, featured }: { p: any; featured?: boolean }) {
  const typeMeta = PRODUCT_TYPES.find((t) => t.id === p.tipo);
  return (
    <Link to={`/lin/mercado/${p.slug}`} className="group block">
      <Card className="h-full overflow-hidden border transition-all duration-300 hover:-translate-y-1 hover:border-primary/40 hover:shadow-xl hover:shadow-primary/10">
        <div className="relative aspect-[4/3] overflow-hidden bg-gradient-to-br from-secondary/40 to-secondary">
          {p.portada_url ? (
            <img src={p.portada_url} alt={p.titulo} loading="lazy" className="h-full w-full object-cover transition duration-500 group-hover:scale-105" />
          ) : (
            <div className="flex h-full items-center justify-center text-5xl opacity-30">{typeMeta?.icon ?? "📦"}</div>
          )}
          {featured && (
            <Badge className="absolute left-2 top-2 gap-1 bg-primary/95 shadow-sm"><Sparkles className="h-3 w-3" /> Destacado</Badge>
          )}
          {p.categoria && (
            <span style={{ background: `${p.categoria.color}E6` }} className="absolute right-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-medium text-white shadow-sm">
              {p.categoria.nombre}
            </span>
          )}
        </div>
        <CardContent className="space-y-2 p-3">
          <p className="line-clamp-1 font-semibold leading-snug">{p.titulo}</p>
          {p.total_reviews > 0 && (
            <p className="flex items-center gap-1 text-sm font-medium">
              <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
              {Number(p.rating_promedio).toFixed(1)}
              <span className="text-xs font-normal text-muted-foreground">({p.total_reviews})</span>
            </p>
          )}
          <p className="font-display text-lg font-extrabold text-primary">{formatPrice(Number(p.precio), p.moneda)}</p>
          <div className="flex items-center justify-between gap-2 pt-1">
            <div className="flex min-w-0 items-center gap-1.5">
              {p.vendedor?.avatar_url ? (
                <img src={p.vendedor.avatar_url} alt="" className="h-5 w-5 shrink-0 rounded-full object-cover" />
              ) : (
                <div className="h-5 w-5 shrink-0 rounded-full bg-secondary" />
              )}
              <span className="truncate text-[11px] text-muted-foreground">{p.vendedor?.nombre ?? "—"}</span>
            </div>
            {p.total_ventas > 0 && <Badge variant="secondary" className="shrink-0 text-[10px]">{p.total_ventas} ventas</Badge>}
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
