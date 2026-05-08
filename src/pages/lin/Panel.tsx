import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Heart, MessageCircle, Users, Mail } from "lucide-react";

export default function LinPanel() {
  const { user } = useAuth();
  const [stats, setStats] = useState<any>(null);
  const [misPubs, setMisPubs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: p } = await (supabase as any).from("perfiles").select("*").eq("id", user.id).single();
      const { data: pubs } = await (supabase as any).from("publicaciones")
        .select("id,titulo,vistas,total_likes,total_comentarios,estado,created_at")
        .eq("perfil_id", user.id).order("created_at", { ascending: false });
      const { count: consul } = await (supabase as any).from("consultas")
        .select("id", { count: "exact", head: true })
        .eq("leida", false)
        .in("publicacion_id", (pubs || []).map((x: any) => x.id));
      setStats({ perfil: p, consultas: consul || 0 });
      setMisPubs(pubs || []);
    })();
  }, [user]);

  if (!stats) return <p className="text-sm text-muted-foreground">Cargando...</p>;
  const p = stats.perfil;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Mi panel</h1>
        <p className="text-sm text-muted-foreground">Resumen de actividad de {p.nombre}</p>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard icon={Eye} label="Publicaciones" v={p.total_publicaciones} />
        <StatCard icon={Users} label="Seguidores" v={p.total_seguidores} />
        <StatCard icon={Heart} label="Siguiendo" v={p.total_siguiendo} />
        <StatCard icon={Mail} label="Consultas sin leer" v={stats.consultas} />
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Mis publicaciones</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {misPubs.length === 0 ? (
            <p className="text-sm text-muted-foreground">Aún no publicaste nada.</p>
          ) : misPubs.map((pub) => (
            <Link key={pub.id} to={`/lin/publicacion/${pub.id}`} className="flex items-center justify-between rounded-md border px-3 py-2 hover:bg-secondary/40">
              <div>
                <p className="text-sm font-medium">{pub.titulo}</p>
                <p className="text-xs text-muted-foreground">Estado: {pub.estado}</p>
              </div>
              <div className="flex gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{pub.vistas}</span>
                <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{pub.total_likes}</span>
                <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{pub.total_comentarios}</span>
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, v }: any) {
  return (
    <Card>
      <CardContent className="space-y-1 p-4">
        <Icon className="h-4 w-4 text-primary" />
        <p className="text-2xl font-bold">{v}</p>
        <p className="text-xs text-muted-foreground">{label}</p>
      </CardContent>
    </Card>
  );
}
