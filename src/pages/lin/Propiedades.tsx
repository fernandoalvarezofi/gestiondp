import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Plus, Home, Box, ShieldCheck, MapPin, SlidersHorizontal, X } from "lucide-react";
import { OPERACIONES, TIPOS_INMUEBLE, MONEDAS, formatPrecio } from "@/lib/inmobiliaria";
import { PropiedadCard } from "@/components/lin/PropiedadCard";
import { toast } from "sonner";

const SELECT_PROP = `*, agente:perfiles!agente_id(id,nombre,username,avatar_url,verificado)`;

export default function Propiedades() {
  const { user } = useAuth();
  const [operacion, setOperacion] = useState<string>("venta");
  const [tipo, setTipo] = useState<string>("todos");
  const [q, setQ] = useState("");
  const [ciudad, setCiudad] = useState("");
  const [dorm, setDorm] = useState<string>("todos");
  const [moneda, setMoneda] = useState<string>("todas");
  const [maxPrecio, setMaxPrecio] = useState<number>(0);
  const [soloTour, setSoloTour] = useState(false);
  const [orden, setOrden] = useState<string>("recientes");
  const [items, setItems] = useState<any[]>([]);
  const [favs, setFavs] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const gridRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setLoading(true);
    (async () => {
      let query = (supabase as any)
        .from("propiedades")
        .select(SELECT_PROP)
        .in("estado", ["activa", "reservada"])
        .limit(90);

      if (operacion !== "todas") query = query.eq("operacion", operacion);
      if (tipo !== "todos") query = query.eq("tipo", tipo);
      if (moneda !== "todas") query = query.eq("moneda", moneda);
      if (dorm !== "todos") query = query.gte("dormitorios", Number(dorm));
      if (maxPrecio > 0) query = query.lte("precio", maxPrecio);
      if (soloTour) query = query.eq("tour_estado", "listo");
      if (ciudad.trim()) query = query.ilike("ciudad", `%${ciudad.trim()}%`);
      if (q.trim()) query = query.or(`titulo.ilike.%${q.trim()}%,barrio.ilike.%${q.trim()}%,direccion.ilike.%${q.trim()}%`);

      if (orden === "precio_asc") query = query.order("precio", { ascending: true });
      else if (orden === "precio_desc") query = query.order("precio", { ascending: false });
      else if (orden === "m2") query = query.order("m2_totales", { ascending: false, nullsFirst: false });
      else query = query.order("destacada", { ascending: false }).order("created_at", { ascending: false });

      const { data, error } = await query;
      if (!active) return;
      if (error) toast.error("No se pudieron cargar las propiedades");
      setItems(data || []);
      setLoading(false);
    })();
    return () => { active = false; };
  }, [operacion, tipo, moneda, dorm, maxPrecio, soloTour, ciudad, q, orden]);

  useEffect(() => {
    if (!user) { setFavs(new Set()); return; }
    (supabase as any).from("propiedad_favoritos").select("propiedad_id").eq("perfil_id", user.id)
      .then(({ data }: any) => setFavs(new Set((data || []).map((f: any) => f.propiedad_id))));
  }, [user]);

  const toggleFav = async (id: string) => {
    if (!user) { toast.error("Iniciá sesión para guardar propiedades"); return; }
    if (favs.has(id)) {
      await (supabase as any).from("propiedad_favoritos").delete().eq("perfil_id", user.id).eq("propiedad_id", id);
      setFavs((s) => { const n = new Set(s); n.delete(id); return n; });
    } else {
      await (supabase as any).from("propiedad_favoritos").insert({ perfil_id: user.id, propiedad_id: id });
      setFavs((s) => new Set(s).add(id));
    }
  };

  const destacadas = useMemo(() => items.filter((p) => p.destacada).slice(0, 4), [items]);
  const conTour = useMemo(() => items.filter((p) => p.tour_estado === "listo").length, [items]);
  const filtrosActivos = tipo !== "todos" || dorm !== "todos" || moneda !== "todas" || maxPrecio > 0 || soloTour || !!ciudad || !!q;

  const limpiar = () => {
    setTipo("todos"); setDorm("todos"); setMoneda("todas"); setMaxPrecio(0);
    setSoloTour(false); setCiudad(""); setQ("");
  };

  const scrollToGrid = () => gridRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      {/* HERO */}
      <section className="relative mb-8 overflow-hidden rounded-3xl border bg-gradient-to-br from-primary/10 via-background to-secondary/40 p-6 sm:p-10">
        <div className="max-w-2xl">
          <h1 className="text-3xl font-bold leading-tight sm:text-4xl">
            Encontrá tu próxima<br /><span className="text-primary">propiedad en 3D</span>
          </h1>
          <p className="mt-3 text-sm text-muted-foreground">
            Publicá, recorré y consultá propiedades directamente con el agente. Con recorridos 3D generados desde un simple video.
          </p>
          <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-muted-foreground">
            <span className="inline-flex items-center gap-1.5"><Box className="h-4 w-4 text-primary" /> Tours 3D reales</span>
            <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-primary" /> Contacto directo</span>
            <span className="inline-flex items-center gap-1.5"><MapPin className="h-4 w-4 text-primary" /> Búsqueda por zona</span>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <Button onClick={scrollToGrid} className="rounded-full px-6">Ver propiedades</Button>
            {user && (
              <Button asChild variant="outline" className="rounded-full px-6">
                <Link to="/lin/propiedades/nueva"><Plus className="h-4 w-4" /> Publicar propiedad</Link>
              </Button>
            )}
          </div>
        </div>
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-primary/15 blur-3xl" />
      </section>

      {/* OPERACIÓN */}
      <div className="mb-4 flex flex-wrap gap-2">
        {[{ id: "todas", label: "Todas" }, ...OPERACIONES].map((o) => (
          <button
            key={o.id}
            onClick={() => setOperacion(o.id)}
            className={`rounded-full border px-4 py-1.5 text-sm font-medium transition ${
              operacion === o.id ? "border-primary bg-primary text-primary-foreground" : "hover:border-primary/40 hover:bg-secondary/60"
            }`}
          >
            {o.label}
          </button>
        ))}
      </div>

      {/* FILTROS */}
      <Card className="mb-8">
        <CardContent className="space-y-4 p-4">
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Título, barrio, dirección…" className="pl-9" />
            </div>
            <div className="relative">
              <MapPin className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={ciudad} onChange={(e) => setCiudad(e.target.value)} placeholder="Ciudad" className="pl-9" />
            </div>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue placeholder="Tipo" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos los tipos</SelectItem>
                {TIPOS_INMUEBLE.map((t) => <SelectItem key={t.id} value={t.id}>{t.label}</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={orden} onValueChange={setOrden}>
              <SelectTrigger><SelectValue placeholder="Ordenar" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="recientes">Más recientes</SelectItem>
                <SelectItem value="precio_asc">Menor precio</SelectItem>
                <SelectItem value="precio_desc">Mayor precio</SelectItem>
                <SelectItem value="m2">Más metros</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <Select value={dorm} onValueChange={setDorm}>
              <SelectTrigger><SelectValue placeholder="Dormitorios" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Dormitorios: cualquiera</SelectItem>
                {[1, 2, 3, 4, 5].map((n) => <SelectItem key={n} value={String(n)}>{n}+ dormitorios</SelectItem>)}
              </SelectContent>
            </Select>
            <Select value={moneda} onValueChange={setMoneda}>
              <SelectTrigger><SelectValue placeholder="Moneda" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todas">Cualquier moneda</SelectItem>
                {MONEDAS.map((m) => <SelectItem key={m} value={m}>{m}</SelectItem>)}
              </SelectContent>
            </Select>
            <div className="lg:col-span-2">
              <div className="mb-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1.5"><SlidersHorizontal className="h-3.5 w-3.5" /> Precio máximo</span>
                <span className="font-medium text-foreground">
                  {maxPrecio > 0 ? formatPrecio(maxPrecio, moneda === "todas" ? "USD" : moneda) : "Sin límite"}
                </span>
              </div>
              <Slider value={[maxPrecio]} onValueChange={(v) => setMaxPrecio(v[0])} min={0} max={1000000} step={10000} />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setSoloTour((v) => !v)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition ${
                soloTour ? "border-primary bg-primary/10 text-primary" : "hover:bg-secondary/60"
              }`}
            >
              <Box className="h-3.5 w-3.5" /> Solo con tour 3D {conTour > 0 && !soloTour ? `(${conTour})` : ""}
            </button>
            {filtrosActivos && (
              <button onClick={limpiar} className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium text-muted-foreground hover:bg-secondary/60">
                <X className="h-3.5 w-3.5" /> Limpiar filtros
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* DESTACADAS */}
      {destacadas.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-bold">Destacadas</h2>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {destacadas.map((p) => <PropiedadCard key={p.id} p={p} fav={favs.has(p.id)} onToggleFav={toggleFav} />)}
          </div>
        </section>
      )}

      {/* GRID */}
      <section ref={gridRef} className="mb-12">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold">
            {loading ? "Buscando propiedades…" : `${items.length} ${items.length === 1 ? "propiedad" : "propiedades"}`}
          </h2>
          {operacion !== "todas" && <Badge variant="secondary">{OPERACIONES.find((o) => o.id === operacion)?.label}</Badge>}
        </div>

        {loading ? (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Card key={i}><CardContent className="p-3">
                <Skeleton className="aspect-[4/3] w-full rounded-lg" />
                <Skeleton className="mt-3 h-4 w-3/4" />
                <Skeleton className="mt-2 h-3 w-1/2" />
              </CardContent></Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="rounded-2xl border bg-card p-12 text-center">
            <Home className="mx-auto h-10 w-10 text-muted-foreground/40" />
            <p className="mt-3 font-semibold">No encontramos propiedades con estos filtros</p>
            <p className="mt-1 text-sm text-muted-foreground">Ampliá la búsqueda o publicá la primera de la zona.</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <Button variant="outline" onClick={limpiar}>Limpiar filtros</Button>
              {user && <Button asChild className="gap-1.5"><Link to="/lin/propiedades/nueva"><Plus className="h-4 w-4" /> Publicar propiedad</Link></Button>}
            </div>
          </div>
        ) : (
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {items.map((p) => <PropiedadCard key={p.id} p={p} fav={favs.has(p.id)} onToggleFav={toggleFav} />)}
          </div>
        )}
      </section>
    </div>
  );
}
