import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { MapPin, Search, MessageCircleMore, Eye, BadgeCheck, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getFallbackImage, TIPO_OPERACION_LABEL, TIPO_PROPIEDAD_LABEL, formatPrecio } from "@/lib/inmoImages";

type Pub = any;

export default function InmoFeed() {
  const [items, setItems] = useState<Pub[]>([]);
  const [q, setQ] = useState("");
  const [op, setOp] = useState<string>("all");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const { data } = await (supabase as any)
        .from("publicaciones")
        .select(`
          id,titulo,descripcion,tipo_operacion,tipo_propiedad,precio,moneda,vistas,created_at,referencia,
          perfil:perfiles_inmo!perfil_id(id,nombre,slug,avatar_url,tipo,verificado,whatsapp),
          barrio:barrios!barrio_id(nombre,zona),
          imagenes:imagenes_publicacion(url,es_portada,orden)
        `)
        .eq("estado", "activa")
        .order("created_at", { ascending: false })
        .limit(60);
      setItems(data || []);
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    return items.filter((p) => {
      if (op !== "all" && p.tipo_operacion !== op) return false;
      if (!q.trim()) return true;
      const t = q.toLowerCase();
      return (
        p.titulo?.toLowerCase().includes(t) ||
        p.descripcion?.toLowerCase().includes(t) ||
        p.barrio?.nombre?.toLowerCase().includes(t) ||
        p.perfil?.nombre?.toLowerCase().includes(t)
      );
    });
  }, [items, q, op]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 rounded-2xl bg-secondary p-5">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 text-foreground">
              <MapPin className="h-5 w-5 text-primary" />
              <h1 className="text-2xl font-bold tracking-tight">Lincoln, Buenos Aires</h1>
            </div>
            <p className="mt-1 text-sm text-muted-foreground">
              {items.length} publicaciones activas en la comunidad
            </p>
          </div>
          <Button asChild>
            <Link to="/inmo/publicar"><Plus className="h-4 w-4" /> Publicar</Link>
          </Button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Buscar barrio, propiedad o publicante..."
              className="bg-background pl-9"
            />
          </div>
          <Select value={op} onValueChange={setOp}>
            <SelectTrigger className="w-full bg-background sm:w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas las operaciones</SelectItem>
              {Object.entries(TIPO_OPERACION_LABEL).map(([k, v]) => (
                <SelectItem key={k} value={k}>{v}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Feed grid */}
      {loading ? (
        <p className="text-sm text-muted-foreground">Cargando publicaciones...</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Todavía no hay publicaciones que coincidan.</p>
            <Button asChild className="mt-4"><Link to="/inmo/publicar">Publicar la primera</Link></Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {filtered.map((p) => (
            <PubCard key={p.id} p={p} />
          ))}
        </div>
      )}
    </div>
  );
}

function PubCard({ p }: { p: Pub }) {
  const portada =
    p.imagenes?.find((i: any) => i.es_portada)?.url ||
    p.imagenes?.[0]?.url ||
    getFallbackImage(p.tipo_propiedad);

  const wa = p.perfil?.whatsapp
    ? `https://wa.me/${String(p.perfil.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, vi tu publicación "${p.titulo}" en Lincoln Inmobiliaria.`)}`
    : null;

  return (
    <Card className="overflow-hidden transition-shadow hover:shadow-lg">
      <Link to={`/inmo/publicacion/${p.id}`} className="block">
        <div className="aspect-[4/3] overflow-hidden bg-muted">
          <img src={portada} alt={p.titulo} loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-105" />
        </div>
      </Link>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary">{TIPO_OPERACION_LABEL[p.tipo_operacion]}</Badge>
          <Badge variant="outline">{TIPO_PROPIEDAD_LABEL[p.tipo_propiedad]}</Badge>
          {p.perfil?.tipo === "dueno_directo" && (
            <Badge className="bg-primary/10 text-primary hover:bg-primary/20">Dueño directo</Badge>
          )}
          {p.perfil?.verificado && (
            <Badge className="gap-1 bg-[hsl(var(--teal-data))] text-white">
              <BadgeCheck className="h-3 w-3" /> Verificada
            </Badge>
          )}
        </div>

        <Link to={`/inmo/publicacion/${p.id}`}>
          <h3 className="line-clamp-1 text-base font-semibold leading-tight hover:text-primary">{p.titulo}</h3>
        </Link>

        <p className="text-xl font-bold text-foreground">{formatPrecio(p.precio, p.moneda)}</p>

        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <MapPin className="h-3.5 w-3.5" />
          <span>{p.barrio?.nombre || "Lincoln"}{p.barrio?.zona ? ` · ${p.barrio.zona}` : ""}</span>
        </div>

        {p.descripcion && (
          <p className="line-clamp-2 text-sm text-muted-foreground">{p.descripcion}</p>
        )}

        <div className="flex items-center justify-between border-t pt-3">
          <Link to={`/inmo/perfil/${p.perfil?.slug}`} className="flex items-center gap-2 hover:opacity-80">
            <Avatar className="h-7 w-7">
              <AvatarImage src={p.perfil?.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="text-[10px]">{(p.perfil?.nombre || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
            </Avatar>
            <span className="text-xs font-medium">{p.perfil?.nombre}</span>
          </Link>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1"><Eye className="h-3.5 w-3.5" />{p.vistas || 0}</span>
          </div>
        </div>

        {wa && (
          <Button asChild size="sm" className="w-full bg-[#25D366] text-white hover:bg-[#20bd5a]">
            <a href={wa} target="_blank" rel="noreferrer">
              <MessageCircleMore className="h-4 w-4" /> Contactar por WhatsApp
            </a>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
