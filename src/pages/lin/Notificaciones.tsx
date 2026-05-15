import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Bell, Heart, MessageCircle, UserPlus, Repeat2 } from "lucide-react";
import { formatTime } from "@/lib/worefHelpers";

const ICONS: Record<string, any> = {
  nuevo_seguidor: UserPlus, like: Heart, comentario: MessageCircle, respuesta_comentario: MessageCircle, reposteo: Repeat2,
};
const TXT: Record<string, string> = {
  nuevo_seguidor: "empezó a seguirte", like: "le gustó tu publicación", comentario: "comentó tu publicación",
  respuesta_comentario: "respondió tu comentario", reposteo: "reposteó tu publicación", mencion: "te mencionó",
  nuevo_mensaje: "te escribió", match: "es un match contigo",
};

export default function Notificaciones() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    const { data } = await (supabase as any).from("notificaciones")
      .select("*, origen:perfiles!origen_id(nombre,username,avatar_url)")
      .order("created_at", { ascending: false }).limit(50);
    setItems(data || []);
  };
  useEffect(() => { if (user) load(); }, [user]);

  const marcarTodas = async () => {
    await (supabase as any).from("notificaciones").update({ leida: true }).eq("perfil_id", user!.id).eq("leida", false);
    load();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
        <Button variant="outline" size="sm" onClick={marcarTodas}>Marcar todas como leídas</Button>
      </div>
      {items.length === 0 ? <Card><CardContent className="py-12 text-center text-sm text-muted-foreground"><Bell className="mx-auto mb-2 h-8 w-8" />Sin notificaciones</CardContent></Card>
        : items.map((n) => {
          const Icon = ICONS[n.tipo] || Bell;
          const link = n.publicacion_id ? `/lin/publicacion/${n.publicacion_id}` : n.origen ? `/lin/perfil/${n.origen.username}` : "#";
          return (
            <Link key={n.id} to={link}><Card className={n.leida ? "" : "border-primary/40 bg-primary/5"}><CardContent className="flex items-center gap-3 p-3">
              <div className="rounded-full bg-secondary p-2"><Icon className="h-4 w-4 text-primary" /></div>
              <div className="flex-1 text-sm"><p><span className="font-medium">{n.origen?.nombre}</span> {TXT[n.tipo] || n.tipo}</p>
                <p className="text-xs text-muted-foreground">{formatTime(n.created_at)}</p></div>
            </CardContent></Card></Link>
          );
        })}
    </div>
  );
}
