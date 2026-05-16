import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Plus, Users, Search } from "lucide-react";

export default function Comunidades() {
  const [items, setItems] = useState<any[]>([]);
  const [q, setQ] = useState("");

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("comunidades").select("*").eq("privada", false).order("total_miembros", { ascending: false });
      setItems(data || []);
    })();
  }, []);

  const filtered = items.filter((c) => {
    if (!q.trim()) return true;
    const t = q.toLowerCase();
    return c.nombre?.toLowerCase().includes(t) || c.descripcion?.toLowerCase().includes(t) || c.tematica?.toLowerCase().includes(t);
  });

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <div className="flex flex-col gap-3 rounded-2xl bg-secondary p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="text-xl font-bold tracking-tight sm:text-2xl">Comunidades</h1>
            <p className="text-xs text-muted-foreground">{items.length} espacios temáticos para conectar</p>
          </div>
          <Button asChild size="sm"><Link to="/lin/comunidades/nueva"><Plus className="h-4 w-4" />Crear</Link></Button>
        </div>
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar comunidades…" className="bg-background pl-9" />
        </div>
      </div>

      {filtered.length === 0 ? (
        <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
          <Users className="mx-auto mb-2 h-8 w-8" />
          {items.length === 0 ? "Aún no hay comunidades. Creá la primera." : "No hay resultados."}
        </CardContent></Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((c) => (
            <Link key={c.id} to={`/lin/comunidades/${c.slug}`} className="group">
              <Card className="h-full overflow-hidden transition-all hover:border-primary/50 hover:shadow-md">
                <div
                  className="h-24 w-full bg-gradient-to-br from-primary/20 to-secondary"
                  style={c.portada_url ? { backgroundImage: `url(${c.portada_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
                />
                <CardContent className="space-y-2 p-4">
                  <div className="flex items-start gap-3">
                    {c.avatar_url
                      ? <img src={c.avatar_url} className="-mt-8 h-12 w-12 rounded-full border-4 border-card object-cover" alt="" />
                      : <div className="-mt-8 flex h-12 w-12 items-center justify-center rounded-full border-4 border-card bg-secondary text-sm font-semibold">{c.nombre?.[0] || "C"}</div>}
                    <div className="min-w-0 flex-1 pt-1">
                      <h3 className="truncate font-semibold leading-tight">{c.nombre}</h3>
                      <p className="text-xs text-muted-foreground">{c.total_miembros} miembros</p>
                    </div>
                  </div>
                  {c.descripcion && <p className="line-clamp-2 text-sm text-muted-foreground">{c.descripcion}</p>}
                  {c.tematica && <span className="inline-block rounded-full bg-secondary px-2 py-0.5 text-[10px] font-medium">{c.tematica}</span>}
                </CardContent>
              </Card>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
