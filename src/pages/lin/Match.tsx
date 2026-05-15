import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Sparkles } from "lucide-react";
import { initials, TIPO_USUARIO } from "@/lib/worefHelpers";

function score(me: any, other: any) {
  let s = 0; const motivos: string[] = [];
  const skillsMe = new Set((me.skills || []).map((x: string) => x.toLowerCase()));
  const skillsOt = (other.skills || []).filter((x: string) => skillsMe.has(x.toLowerCase()));
  if (skillsOt.length) { s += skillsOt.length * 10; motivos.push(`${skillsOt.length} skills en común`); }
  const intMe = new Set((me.intereses || []).map((x: string) => x.toLowerCase()));
  const intOt = (other.intereses || []).filter((x: string) => intMe.has(x.toLowerCase()));
  if (intOt.length) { s += intOt.length * 8; motivos.push(`${intOt.length} intereses afines`); }
  if (me.industria && me.industria === other.industria) { s += 20; motivos.push("misma industria"); }
  if (me.ubicacion && me.ubicacion === other.ubicacion) { s += 5; motivos.push("misma ubicación"); }
  return { s: Math.min(100, s), motivos };
}

export default function Match() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: me } = await (supabase as any).from("perfiles").select("*").eq("id", user.id).single();
      const { data: otros } = await (supabase as any).from("perfiles").select("*").neq("id", user.id).limit(40);
      const ranked = (otros || []).map((o: any) => ({ ...o, ...score(me, o) })).filter((x: any) => x.s > 0).sort((a: any, b: any) => b.s - a.s);
      setItems(ranked);
    })();
  }, [user]);

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div><h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight"><Sparkles className="h-5 w-5 text-primary" />Match</h1>
        <p className="text-sm text-muted-foreground">Personas que matchean con tus skills, intereses e industria</p></div>
      {items.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">Completá tu perfil con skills e intereses para ver matches.</CardContent></Card>
        : <div className="grid gap-3 sm:grid-cols-2">{items.map((p) => (
          <Card key={p.id}><CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-3">
              <Avatar className="h-12 w-12"><AvatarImage src={p.avatar_url || ""} /><AvatarFallback>{initials(p.nombre)}</AvatarFallback></Avatar>
              <div className="min-w-0 flex-1"><p className="truncate font-semibold">{p.nombre}</p><p className="truncate text-xs text-muted-foreground">@{p.username} · {TIPO_USUARIO[p.tipo]}</p></div>
              <Badge>{p.s}%</Badge>
            </div>
            <p className="text-xs text-muted-foreground">{p.motivos.join(" · ")}</p>
            <div className="flex justify-end"><Button asChild size="sm" variant="outline"><Link to={`/lin/perfil/${p.username}`}>Ver perfil</Link></Button></div>
          </CardContent></Card>
        ))}</div>}
    </div>
  );
}
