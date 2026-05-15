import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { formatTime } from "@/lib/worefHelpers";

export default function Foro() {
  const [cats, setCats] = useState<any[]>([]);
  const [posts, setPosts] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const [{ data: c }, { data: p }] = await Promise.all([
        (supabase as any).from("foro_categorias").select("*").order("orden"),
        (supabase as any).from("foro_posts").select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url), categoria:foro_categorias!categoria_id(nombre,slug,color)").order("fijado", { ascending: false }).order("created_at", { ascending: false }).limit(40),
      ]);
      setCats(c || []); setPosts(p || []);
    })();
  }, []);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Foro</h1><p className="text-sm text-muted-foreground">Preguntas y debates de la comunidad</p></div>
        <Button asChild><Link to="/lin/foro/nuevo"><Plus className="h-4 w-4" />Nuevo post</Link></Button>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {cats.map((c) => (
          <Link key={c.id} to={`/lin/foro/cat/${c.slug}`}>
            <Card className="hover:border-primary/50"><CardContent className="p-3"><p className="text-sm font-medium" style={{ color: c.color }}>{c.nombre}</p></CardContent></Card>
          </Link>
        ))}
      </div>

      <div className="space-y-2">
        {posts.map((p) => (
          <Link key={p.id} to={`/lin/foro/post/${p.id}`}>
            <Card className="hover:border-primary/50"><CardContent className="p-4">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <p className="font-semibold">{p.titulo}</p>
                  <p className="text-xs text-muted-foreground">por {p.perfil?.nombre} en <span style={{ color: p.categoria?.color }}>{p.categoria?.nombre}</span> · {formatTime(p.created_at)}</p>
                </div>
                <div className="text-right text-xs text-muted-foreground"><p>{p.total_respuestas} resp.</p><p>{p.total_likes} likes</p></div>
              </div>
            </CardContent></Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
