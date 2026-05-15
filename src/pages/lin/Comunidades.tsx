import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Users } from "lucide-react";

export default function Comunidades() {
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("comunidades").select("*").eq("privada", false).order("total_miembros", { ascending: false });
      setItems(data || []);
    })();
  }, []);
  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex items-center justify-between">
        <div><h1 className="text-2xl font-bold tracking-tight">Comunidades</h1><p className="text-sm text-muted-foreground">Espacios temáticos</p></div>
        <Button asChild><Link to="/lin/comunidades/nueva"><Plus className="h-4 w-4" />Crear</Link></Button>
      </div>
      {items.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Users className="mx-auto mb-2 h-8 w-8" />Aún no hay comunidades.</CardContent></Card>
        : <div className="grid gap-3 sm:grid-cols-2">{items.map((c) => (
          <Link key={c.id} to={`/lin/comunidades/${c.slug}`}><Card className="h-full hover:border-primary/50"><CardContent className="space-y-2 p-4">
            <div className="flex items-center gap-3">
              {c.avatar_url ? <img src={c.avatar_url} className="h-10 w-10 rounded-full object-cover" alt="" /> : <div className="h-10 w-10 rounded-full bg-secondary" />}
              <div><h3 className="font-semibold">{c.nombre}</h3><p className="text-xs text-muted-foreground">{c.total_miembros} miembros</p></div>
            </div>
            <p className="text-sm text-muted-foreground line-clamp-2">{c.descripcion}</p>
          </CardContent></Card></Link>
        ))}</div>}
    </div>
  );
}
