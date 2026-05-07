import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Search, MapPin } from "lucide-react";
import { getFallbackImage, TIPO_OPERACION_LABEL, TIPO_USUARIO_LABEL, formatPrecio } from "@/lib/inmoImages";

export default function InmoBuscador() {
  const [q, setQ] = useState("");
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [pubs, setPubs] = useState<any[]>([]);

  useEffect(() => {
    const t = setTimeout(async () => {
      if (!q.trim()) { setPerfiles([]); setPubs([]); return; }
      const pat = `%${q}%`;
      const [pf, pl] = await Promise.all([
        (supabase as any).from("perfiles_inmo").select("id,nombre,slug,avatar_url,tipo,verificado").ilike("nombre", pat).limit(20),
        (supabase as any).from("publicaciones").select(`
          id,titulo,tipo_operacion,tipo_propiedad,precio,moneda,
          barrio:barrios!barrio_id(nombre),
          imagenes:imagenes_publicacion(url,es_portada)
        `).or(`titulo.ilike.${pat},descripcion.ilike.${pat}`).eq("estado", "activa").limit(30),
      ]);
      setPerfiles(pf.data || []);
      setPubs(pl.data || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Buscar en Lincoln</h1>
        <p className="text-sm text-muted-foreground">Encontrá publicaciones, inmobiliarias o vecinos.</p>
      </div>

      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Barrio, propiedad, inmobiliaria..." className="pl-9" />
      </div>

      <Tabs defaultValue="pubs">
        <TabsList>
          <TabsTrigger value="pubs">Publicaciones ({pubs.length})</TabsTrigger>
          <TabsTrigger value="perfiles">Perfiles ({perfiles.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="pubs" className="mt-4">
          {pubs.length === 0 ? (
            <p className="text-sm text-muted-foreground">{q ? "Sin resultados." : "Empezá a escribir..."}</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {pubs.map((p) => {
                const img = p.imagenes?.find((i: any) => i.es_portada)?.url || p.imagenes?.[0]?.url || getFallbackImage(p.tipo_propiedad);
                return (
                  <Link key={p.id} to={`/inmo/publicacion/${p.id}`}>
                    <Card className="overflow-hidden transition-shadow hover:shadow-md">
                      <div className="flex">
                        <img src={img} alt="" className="h-24 w-24 shrink-0 object-cover" />
                        <CardContent className="flex-1 p-3">
                          <Badge variant="secondary" className="text-[10px]">{TIPO_OPERACION_LABEL[p.tipo_operacion]}</Badge>
                          <p className="mt-1 line-clamp-1 text-sm font-semibold">{p.titulo}</p>
                          <p className="text-sm font-bold text-primary">{formatPrecio(p.precio, p.moneda)}</p>
                          {p.barrio?.nombre && <p className="flex items-center gap-1 text-xs text-muted-foreground"><MapPin className="h-3 w-3" />{p.barrio.nombre}</p>}
                        </CardContent>
                      </div>
                    </Card>
                  </Link>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="perfiles" className="mt-4 space-y-2">
          {perfiles.length === 0 ? (
            <p className="text-sm text-muted-foreground">{q ? "Sin perfiles." : "Empezá a escribir..."}</p>
          ) : perfiles.map((p) => (
            <Link key={p.id} to={`/inmo/perfil/${p.slug}`}>
              <Card className="transition-shadow hover:shadow-md">
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar><AvatarImage src={p.avatar_url || ""} className="object-cover" /><AvatarFallback>{p.nombre?.slice(0, 2).toUpperCase()}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <p className="font-semibold">{p.nombre}</p>
                    <p className="text-xs text-muted-foreground">{TIPO_USUARIO_LABEL[p.tipo]}</p>
                  </div>
                </CardContent>
              </Card>
            </Link>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
