import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { initials, timeAgo } from "@/lib/linquenoHelpers";
import { Heart, MessageCircle, UserPlus, Repeat2, Bell } from "lucide-react";

const ICONS: any = {
  like_publicacion: Heart,
  comentario_publicacion: MessageCircle,
  respuesta_comentario: MessageCircle,
  nuevo_seguidor: UserPlus,
  reposteo: Repeat2,
  mencion: Bell,
};

const TEXTOS: any = {
  like_publicacion: "le dio me gusta a tu publicación",
  comentario_publicacion: "comentó en tu publicación",
  respuesta_comentario: "respondió a tu comentario",
  nuevo_seguidor: "empezó a seguirte",
  reposteo: "reposteó tu publicación",
  mencion: "te mencionó",
};

export default function LinNotificaciones() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  useEffect(() => {
    if (!user) return;
    cargar();
    const ch = (supabase as any).channel("notif")
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "notificaciones", filter: `perfil_id=eq.${user.id}` },
        () => cargar())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user]);

  const cargar = async () => {
    const { data } = await (supabase as any).from("notificaciones")
      .select("*,origen:perfiles!origen_id(nombre,slug,avatar_url),publicacion:publicaciones!publicacion_id(id,titulo)")
      .eq("perfil_id", user!.id).order("created_at", { ascending: false }).limit(50);
    setItems(data || []);
  };

  const marcarLeidas = async () => {
    await (supabase as any).from("notificaciones").update({ leida: true }).eq("perfil_id", user!.id).eq("leida", false);
    cargar();
  };

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
        <Button variant="ghost" size="sm" onClick={marcarLeidas}>Marcar todas leídas</Button>
      </div>
      {items.length === 0 ? (
        <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Sin notificaciones todavía.</CardContent></Card>
      ) : items.map((n) => {
        const Icon = ICONS[n.tipo] || Bell;
        return (
          <Card key={n.id} className={n.leida ? "" : "border-primary/40 bg-primary/5"}>
            <CardContent className="flex items-center gap-3 p-3">
              <div className="rounded-full bg-secondary p-2"><Icon className="h-4 w-4" /></div>
              <Avatar className="h-8 w-8"><AvatarImage src={n.origen?.avatar_url || ""} className="object-cover" /><AvatarFallback className="text-[10px]">{initials(n.origen?.nombre)}</AvatarFallback></Avatar>
              <div className="flex-1 text-sm">
                <Link to={`/lin/perfil/${n.origen?.slug}`} className="font-semibold hover:text-primary">{n.origen?.nombre || "Alguien"}</Link>{" "}
                {TEXTOS[n.tipo] || n.texto}
                {n.publicacion && <Link to={`/lin/publicacion/${n.publicacion.id}`} className="ml-1 text-muted-foreground hover:text-primary">"{n.publicacion.titulo}"</Link>}
                <div className="text-xs text-muted-foreground">{timeAgo(n.created_at)}</div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
