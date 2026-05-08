import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, Plus, Sparkles, Users } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import { PostCard } from "@/components/lin/PostCard";
import { TIPO_PUBLICACION } from "@/lib/linquenoHelpers";

export default function LinFeed() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState("todo");
  const [filtroTipo, setFiltroTipo] = useState<string>("all");
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [seguidos, setSeguidos] = useState<string[]>([]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("publicaciones")
        .select(`
          id,tipo,titulo,descripcion,tipo_operacion,tipo_propiedad,precio,moneda,precio_negociable,
          ambientes,dormitorios,banos,cochera,superficie_total,hectareas,
          vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,referencia,
          perfil:perfiles!perfil_id(id,nombre,slug,avatar_url,tipo,verificado,whatsapp),
          barrio:barrios!barrio_id(nombre,zona),
          media:media_publicacion(url,es_portada,orden)
        `)
        .eq("estado", "activa")
        .order("destacada", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(60);
      setItems(data || []);
      setLoading(false);
    })();

    if (user) {
      (async () => {
        const { data } = await (supabase as any).from("seguidos").select("seguido_id").eq("seguidor_id", user.id);
        setSeguidos((data || []).map((d: any) => d.seguido_id));
      })();
    }
  }, [user]);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (tab === "siguiendo" && !seguidos.includes(p.perfil?.id)) return false;
      if (filtroTipo !== "all" && p.tipo !== filtroTipo) return false;
      if (!q.trim()) return true;
      const t = q.toLowerCase();
      return (
        p.titulo?.toLowerCase().includes(t) ||
        p.descripcion?.toLowerCase().includes(t) ||
        p.barrio?.nombre?.toLowerCase().includes(t) ||
        p.perfil?.nombre?.toLowerCase().includes(t)
      );
    });
  }, [items, tab, seguidos, filtroTipo, q]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      {/* Header */}
      <div className="flex flex-col gap-3 rounded-2xl bg-secondary p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Lincoln, Buenos Aires</h1>
              <p className="text-xs text-muted-foreground">{items.length} publicaciones activas en la comunidad</p>
            </div>
          </div>
          <Button asChild size="sm">
            <Link to="/lin/publicar"><Plus className="h-4 w-4" /> Publicar</Link>
          </Button>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Buscar por barrio, propiedad, vecino..."
            className="bg-background pl-9"
          />
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="todo" className="gap-1.5"><Sparkles className="h-4 w-4" />Todo Lincoln</TabsTrigger>
          <TabsTrigger value="siguiendo" className="gap-1.5"><Users className="h-4 w-4" />Siguiendo</TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Filtros tipo */}
      <ScrollArea className="w-full whitespace-nowrap">
        <div className="flex gap-1.5 pb-2">
          <FilterChip active={filtroTipo === "all"} onClick={() => setFiltroTipo("all")}>Todo</FilterChip>
          {Object.entries(TIPO_PUBLICACION).map(([k, v]) => (
            <FilterChip key={k} active={filtroTipo === k} onClick={() => setFiltroTipo(k)}>
              <span>{v.emoji}</span> {v.label}
            </FilterChip>
          ))}
        </div>
        <ScrollBar orientation="horizontal" />
      </ScrollArea>

      {/* Posts */}
      {loading ? (
        <p className="text-center text-sm text-muted-foreground">Cargando...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {tab === "siguiendo"
                ? "Todavía no seguís a nadie. Explorá Todo Lincoln para descubrir vecinos."
                : "No hay publicaciones con esos filtros."}
            </p>
            <Button asChild className="mt-4"><Link to="/lin/publicar">Publicar la primera</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {filtered.map((p) => <PostCard key={p.id} pub={p} />)}
        </div>
      )}
    </div>
  );
}

function FilterChip({ active, onClick, children }: any) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors ${
        active ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background hover:bg-secondary"
      }`}
    >
      {children}
    </button>
  );
}
