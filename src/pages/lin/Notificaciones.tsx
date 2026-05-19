import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Bell, Heart, MessageCircle, UserPlus, Repeat2, AtSign, Send } from "lucide-react";
import { formatTime, initials } from "@/lib/worefHelpers";

const ICONS: Record<string, any> = {
  nuevo_seguidor: UserPlus, like: Heart, like_publicacion: Heart,
  comentario: MessageCircle, comentario_publicacion: MessageCircle,
  respuesta_comentario: MessageCircle, reposteo: Repeat2,
  mencion: AtSign, nuevo_mensaje: Send,
};
const COLORS: Record<string, string> = {
  nuevo_seguidor: "text-blue-500 bg-blue-500/10",
  like: "text-rose-500 bg-rose-500/10",
  like_publicacion: "text-rose-500 bg-rose-500/10",
  comentario: "text-emerald-500 bg-emerald-500/10",
  comentario_publicacion: "text-emerald-500 bg-emerald-500/10",
  respuesta_comentario: "text-emerald-500 bg-emerald-500/10",
  reposteo: "text-violet-500 bg-violet-500/10",
  mencion: "text-amber-500 bg-amber-500/10",
  nuevo_mensaje: "text-primary bg-primary/10",
};
const TXT: Record<string, string> = {
  nuevo_seguidor: "empezó a seguirte",
  like: "le gustó tu publicación",
  like_publicacion: "le gustó tu publicación",
  comentario: "comentó tu publicación",
  comentario_publicacion: "comentó tu publicación",
  respuesta_comentario: "respondió tu comentario",
  reposteo: "reposteó tu publicación",
  mencion: "te mencionó",
  nuevo_mensaje: "te escribió",
  match: "es un match",
};

export default function Notificaciones() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);

  const load = async () => {
    const { data } = await (supabase as any).from("notificaciones")
      .select("*, origen:perfiles!origen_id(nombre,username,avatar_url)")
      .order("created_at", { ascending: false }).limit(80);
    setItems(data || []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = (supabase as any).channel("notif-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notificaciones", filter: `perfil_id=eq.${user.id}` },
        () => load())
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user]);

  const marcarTodas = async () => {
    if (!user) return;
    // Optimistic
    setItems((s) => s.map((n) => ({ ...n, leida: true })));
    await (supabase as any).from("notificaciones").update({ leida: true }).eq("perfil_id", user.id).eq("leida", false);
  };

  const noLeidas = items.filter((n) => !n.leida).length;

  return (
    <div className="mx-auto max-w-2xl space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Notificaciones</h1>
          {noLeidas > 0 && <p className="text-xs text-muted-foreground">{noLeidas} sin leer</p>}
        </div>
        {noLeidas > 0 && <Button variant="outline" size="sm" onClick={marcarTodas}>Marcar todas como leídas</Button>}
      </div>

      {items.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center text-sm text-muted-foreground">
            <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />
            Sin notificaciones todavía
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          {items.map((n, i) => {
            const Icon = ICONS[n.tipo] || Bell;
            const colorCls = COLORS[n.tipo] || "text-muted-foreground bg-secondary";
            const link = n.publicacion_id ? `/lin/publicacion/${n.publicacion_id}`
              : n.tipo === "nuevo_mensaje" ? "/lin/mensajes"
              : n.origen ? `/lin/perfil/${n.origen.username}` : "#";
            return (
              <Link
                key={n.id}
                to={link}
                className={`flex items-center gap-3 px-4 py-3 transition-colors hover:bg-secondary/40 ${i > 0 ? "border-t" : ""} ${!n.leida ? "bg-primary/5" : ""}`}
              >
                <div className="relative">
                  <Avatar className="h-11 w-11">
                    <AvatarImage src={n.origen?.avatar_url || ""} className="object-cover" />
                    <AvatarFallback>{initials(n.origen?.nombre)}</AvatarFallback>
                  </Avatar>
                  <div className={`absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background ${colorCls}`}>
                    <Icon className="h-3 w-3" />
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-tight">
                    <span className="font-semibold">{n.origen?.nombre || "Alguien"}</span>{" "}
                    <span className="text-muted-foreground">{TXT[n.tipo] || n.tipo}</span>
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">{formatTime(n.created_at)}</p>
                </div>
                {!n.leida && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
