import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PostCard } from "@/components/lin/PostCard";
import { Card, CardContent } from "@/components/ui/card";

export default function LinFavoritos() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("favoritos")
        .select(`publicacion:publicaciones!publicacion_id(
          id,tipo,titulo,descripcion,tipo_operacion,tipo_propiedad,precio,moneda,precio_negociable,
          ambientes,dormitorios,banos,cochera,superficie_total,hectareas,
          vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,referencia,
          perfil:perfiles!perfil_id(id,nombre,slug,avatar_url,tipo,verificado,whatsapp),
          barrio:barrios!barrio_id(nombre,zona),
          media:media_publicacion(url,es_portada,orden)
        )`)
        .eq("perfil_id", user.id)
        .order("created_at", { ascending: false });
      setItems((data || []).map((d: any) => d.publicacion).filter(Boolean));
    })();
  }, [user]);

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Mis favoritos</h1>
      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aún no guardaste publicaciones.</CardContent></Card>
      ) : items.map((p) => <PostCard key={p.id} pub={p} />)}
    </div>
  );
}
