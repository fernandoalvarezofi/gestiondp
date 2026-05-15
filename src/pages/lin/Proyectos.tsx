import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Rocket } from "lucide-react";
import { ESTADO_PROYECTO } from "@/lib/worefHelpers";

export default function Proyectos() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("proyectos")
        .select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url)")
        .order("destacado", { ascending: false }).order("created_at", { ascending: false }).limit(60);
      setItems(data || []);
    })();
  }, []);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Proyectos</h1><p className="text-sm text-muted-foreground">Iniciativas de la red</p></div>
        <Button asChild><Link to="/lin/proyectos/nuevo"><Plus className="h-4 w-4" />Nuevo</Link></Button>
      </div>
      {items.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Rocket className="mx-auto mb-2 h-8 w-8" />Aún no hay proyectos publicados.</CardContent></Card>
        : <div className="grid gap-3 sm:grid-cols-2">{items.map((p) => {
          const est = ESTADO_PROYECTO[p.estado];
          return (
            <Link key={p.id} to={`/lin/proyectos/${p.slug || p.id}`}><Card className="h-full overflow-hidden hover:border-primary/50">
              {p.portada_url && <img src={p.portada_url} alt="" className="h-32 w-full object-cover" />}
              <CardContent className="space-y-2 p-4">
                <div className="flex items-center justify-between gap-2"><h3 className="font-semibold">{p.nombre}</h3>{est && <Badge className={est.color}>{est.label}</Badge>}</div>
                <p className="text-sm text-muted-foreground line-clamp-2">{p.descripcion}</p>
                <p className="text-xs text-muted-foreground">por {p.perfil?.nombre} · {p.total_seguidores} seguidores</p>
              </CardContent>
            </Card></Link>
          );
        })}</div>}
    </div>
  );
}
