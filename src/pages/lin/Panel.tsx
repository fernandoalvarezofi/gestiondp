import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Eye, Heart, MessageCircle, Users, Trash2 } from "lucide-react";
import { toast } from "sonner";

export default function Panel() {
  const { user } = useAuth();
  const [p, setP] = useState<any>(null);
  const [pubs, setPubs] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data: perf } = await (supabase as any).from("perfiles").select("*").eq("id", user.id).single();
      const { data: ps } = await (supabase as any).from("publicaciones")
        .select("id,titulo,cuerpo,vistas,total_likes,total_comentarios,estado,created_at")
        .eq("perfil_id", user.id).order("created_at", { ascending: false });
      setP(perf); setPubs(ps || []);
    })();
  }, [user]);

  if (!p) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div><h1 className="text-2xl font-bold tracking-tight">Mi panel</h1><p className="text-sm text-muted-foreground">Resumen de actividad</p></div>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <SC icon={Eye} label="Publicaciones" v={p.total_publicaciones} />
        <SC icon={Users} label="Seguidores" v={p.total_seguidores} />
        <SC icon={Heart} label="Siguiendo" v={p.total_siguiendo} />
        <SC icon={MessageCircle} label="Score" v={p.score} />
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Mis publicaciones</CardTitle></CardHeader>
        <CardContent className="space-y-2">
          {pubs.length === 0 ? <p className="text-sm text-muted-foreground">Aún no publicaste nada.</p>
            : pubs.map((pub) => (
              <div key={pub.id} className="flex items-center gap-2 rounded-md border px-3 py-2 hover:bg-secondary/40">
                <Link to={`/lin/publicacion/${pub.id}`} className="flex min-w-0 flex-1 items-center justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium">{pub.titulo || pub.cuerpo?.slice(0, 60)}</p>
                    <p className="text-xs text-muted-foreground">{pub.estado}</p>
                  </div>
                  <div className="flex shrink-0 gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{pub.vistas}</span>
                    <span className="flex items-center gap-1"><Heart className="h-3 w-3" />{pub.total_likes}</span>
                    <span className="flex items-center gap-1"><MessageCircle className="h-3 w-3" />{pub.total_comentarios}</span>
                  </div>
                </Link>
                <button
                  onClick={async (e) => {
                    e.preventDefault();
                    if (!confirm("¿Seguro que querés eliminar esta publicación? Esta acción no se puede deshacer.")) return;
                    await (supabase as any).from("publicaciones").update({ estado: "eliminada" }).eq("id", pub.id).eq("perfil_id", user?.id);
                    setPubs((prev) => prev.filter((p) => p.id !== pub.id));
                    toast.success("Publicación eliminada");
                  }}
                  className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"
                  aria-label="Eliminar"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            ))}
        </CardContent>
      </Card>
    </div>
  );
}
function SC({ icon: I, label, v }: any) {
  return <Card><CardContent className="space-y-1 p-4"><I className="h-4 w-4 text-primary" /><p className="text-2xl font-bold">{v}</p><p className="text-xs text-muted-foreground">{label}</p></CardContent></Card>;
}
