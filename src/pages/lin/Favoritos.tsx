import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { PostCard } from "@/components/lin/PostCard";
import { Card, CardContent } from "@/components/ui/card";
import { BackHeader } from "@/components/lin/BackHeader";

const SELECT = `id,tipo,formato,titulo,cuerpo,imagen_url,video_url,tags,
  vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url,tipo,verificado),
  media:media_publicacion(url,es_portada,orden)`;

export default function Favoritos() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("favoritos")
        .select(`publicacion:publicaciones!publicacion_id(${SELECT})`)
        .eq("perfil_id", user.id).not("publicacion_id", "is", null)
        .order("created_at", { ascending: false });
      setItems((data || []).map((d: any) => d.publicacion).filter(Boolean));
    })();
  }, [user]);

  return (
    <>
      <BackHeader title="Guardados" />
      <div className="mx-auto max-w-2xl space-y-4">
      <h1 className="text-2xl font-bold tracking-tight">Guardados</h1>
      {items.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Aún no guardaste nada.</CardContent></Card>
        : items.map((p) => <PostCard key={p.id} pub={p} />)}
    </div>
    </>
  );
}
