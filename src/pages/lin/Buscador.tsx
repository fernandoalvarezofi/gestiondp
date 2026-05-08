import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Search } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { initials, formatPrecio, TIPO_PUBLICACION, TIPO_USUARIO, getFallbackImage } from "@/lib/linquenoHelpers";

export default function LinBuscador() {
  const [q, setQ] = useState("");
  const [pubs, setPubs] = useState<any[]>([]);
  const [perfiles, setPerfiles] = useState<any[]>([]);

  useEffect(() => {
    if (!q.trim()) { setPubs([]); setPerfiles([]); return; }
    const t = setTimeout(async () => {
      const term = `%${q}%`;
      const [{ data: ps }, { data: pf }] = await Promise.all([
        (supabase as any).from("publicaciones")
          .select("id,titulo,tipo,tipo_propiedad,precio,moneda,perfil:perfiles!perfil_id(nombre,slug),media:media_publicacion(url,es_portada)")
          .eq("estado", "activa").or(`titulo.ilike.${term},descripcion.ilike.${term}`).limit(20),
        (supabase as any).from("perfiles")
          .select("id,nombre,slug,avatar_url,tipo,verificado,total_seguidores")
          .eq("activo", true).ilike("nombre", term).limit(20),
      ]);
      setPubs(ps || []); setPerfiles(pf || []);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Buscar en Linqueño</h1>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Propiedades, vecinos, negocios..." className="pl-9" autoFocus />
      </div>

      <Tabs defaultValue="pubs">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="pubs">Publicaciones ({pubs.length})</TabsTrigger>
          <TabsTrigger value="usr">Vecinos ({perfiles.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="pubs" className="mt-4 space-y-2">
          {pubs.map((p) => {
            const img = p.media?.find((m: any) => m.es_portada)?.url || p.media?.[0]?.url || getFallbackImage(p.tipo, p.tipo_propiedad);
            return (
              <Link key={p.id} to={`/lin/publicacion/${p.id}`}>
                <Card className="hover:bg-secondary/40">
                  <CardContent className="flex items-center gap-3 p-3">
                    <img src={img} className="h-14 w-14 rounded-md object-cover" alt="" />
                    <div className="min-w-0 flex-1">
                      <p className="line-clamp-1 text-sm font-medium">{p.titulo}</p>
                      <p className="text-xs text-muted-foreground">{formatPrecio(p.precio, p.moneda)} · {p.perfil?.nombre}</p>
                    </div>
                    <Badge variant="secondary" className="gap-1">{TIPO_PUBLICACION[p.tipo]?.emoji}</Badge>
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </TabsContent>
        <TabsContent value="usr" className="mt-4 space-y-2">
          {perfiles.map((u) => (
            <Link key={u.id} to={`/lin/perfil/${u.slug}`}>
              <Card className="hover:bg-secondary/40">
                <CardContent className="flex items-center gap-3 p-3">
                  <Avatar><AvatarImage src={u.avatar_url || ""} className="object-cover" /><AvatarFallback>{initials(u.nombre)}</AvatarFallback></Avatar>
                  <div className="flex-1">
                    <p className="text-sm font-medium">{u.nombre}</p>
                    <p className="text-xs text-muted-foreground">{TIPO_USUARIO[u.tipo]} · {u.total_seguidores} seguidores</p>
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
