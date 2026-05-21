import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Bell, Heart, MessageCircle, UserPlus, Repeat2, AtSign, Send, BadgeCheck, CheckCheck } from "lucide-react";
import { formatTime, initials } from "@/lib/worefHelpers";
import { BackHeader } from "@/components/lin/BackHeader";
import { cn } from "@/lib/utils";

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
};

const FILTERS = [
  { v: "todas", label: "Todas" },
  { v: "menciones", label: "Menciones" },
  { v: "seguidores", label: "Seguidores" },
  { v: "interacciones", label: "Interacciones" },
];

export default function Notificaciones() {
  const { user } = useAuth();
  const [items, setItems] = useState<any[]>([]);
  const [filtro, setFiltro] = useState("todas");

  const load = async () => {
    const { data } = await (supabase as any).from("notificaciones")
      .select("*, origen:perfiles!origen_id(nombre,username,avatar_url,verificado), publicacion:publicaciones!publicacion_id(id,imagen_url,titulo,cuerpo)")
      .order("created_at", { ascending: false }).limit(100);
    setItems(data || []);
  };

  useEffect(() => {
    if (!user) return;
    load();
    const ch = (supabase as any).channel("notif-realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "notificaciones", filter: `perfil_id=eq.${user.id}` }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user]);

  const marcarTodas = async () => {
    if (!user) return;
    setItems((s) => s.map((n) => ({ ...n, leida: true })));
    await (supabase as any).from("notificaciones").update({ leida: true }).eq("perfil_id", user.id).eq("leida", false);
  };

  const filtrados = useMemo(() => {
    return items.filter((n) => {
      if (filtro === "menciones") return n.tipo === "mencion";
      if (filtro === "seguidores") return n.tipo === "nuevo_seguidor";
      if (filtro === "interacciones") return ["like", "like_publicacion", "comentario", "comentario_publicacion", "respuesta_comentario", "reposteo"].includes(n.tipo);
      return true;
    });
  }, [items, filtro]);

  const { hoy, ayer, semana, antes } = useMemo(() => {
    const ahora = Date.now();
    const HOY = 24 * 3600 * 1000;
    const SEMANA = 7 * HOY;
    const buckets: any = { hoy: [], ayer: [], semana: [], antes: [] };
    filtrados.forEach((n) => {
      const diff = ahora - new Date(n.created_at).getTime();
      if (diff < HOY) buckets.hoy.push(n);
      else if (diff < 2 * HOY) buckets.ayer.push(n);
      else if (diff < SEMANA) buckets.semana.push(n);
      else buckets.antes.push(n);
    });
    return buckets;
  }, [filtrados]);

  const noLeidas = items.filter((n) => !n.leida).length;

  return (
    <>
      <BackHeader title="Notificaciones" subtitle={noLeidas > 0 ? `${noLeidas} sin leer` : "Todo al día"} />
      <div className="mx-auto max-w-2xl">
        <div className="sticky top-[57px] z-10 border-b bg-background/95 backdrop-blur">
          <Tabs value={filtro} onValueChange={setFiltro}>
            <div className="flex items-center justify-between px-4 py-2">
              <TabsList className="h-9 gap-1 bg-secondary/40">
                {FILTERS.map((f) => <TabsTrigger key={f.v} value={f.v} className="rounded-full px-3 text-xs">{f.label}</TabsTrigger>)}
              </TabsList>
              {noLeidas > 0 && (
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs" onClick={marcarTodas}>
                  <CheckCheck className="h-3.5 w-3.5" />Leer todas
                </Button>
              )}
            </div>
          </Tabs>
        </div>

        {filtrados.length === 0 ? (
          <Card className="m-4">
            <CardContent className="py-16 text-center text-sm text-muted-foreground">
              <Bell className="mx-auto mb-2 h-8 w-8 opacity-50" />Sin notificaciones todavía
            </CardContent>
          </Card>
        ) : (
          <div className="divide-y">
            {hoy.length > 0 && <Bucket title="Hoy" items={hoy} />}
            {ayer.length > 0 && <Bucket title="Ayer" items={ayer} />}
            {semana.length > 0 && <Bucket title="Esta semana" items={semana} />}
            {antes.length > 0 && <Bucket title="Anteriores" items={antes} />}
          </div>
        )}
      </div>
    </>
  );
}

function Bucket({ title, items }: { title: string; items: any[] }) {
  return (
    <section>
      <h2 className="bg-secondary/30 px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{title}</h2>
      <ul>
        {items.map((n) => {
          const Icon = ICONS[n.tipo] || Bell;
          const colorCls = COLORS[n.tipo] || "text-muted-foreground bg-secondary";
          const link = n.publicacion?.id ? `/lin/publicacion/${n.publicacion.id}`
            : n.tipo === "nuevo_mensaje" ? "/lin/mensajes"
            : n.origen ? `/lin/perfil/${n.origen.username}` : "#";
          const thumb = n.publicacion?.imagen_url;
          return (
            <li key={n.id}>
              <Link to={link} className={cn("flex items-center gap-3 border-b px-4 py-3 transition-colors hover:bg-secondary/40",
                !n.leida && "bg-primary/[0.04]")}>
                <div className="relative shrink-0">
                  <Avatar className="h-11 w-11 ring-1 ring-border">
                    <AvatarImage src={n.origen?.avatar_url || ""} className="object-cover" />
                    <AvatarFallback>{initials(n.origen?.nombre)}</AvatarFallback>
                  </Avatar>
                  <div className={cn("absolute -bottom-0.5 -right-0.5 flex h-5 w-5 items-center justify-center rounded-full ring-2 ring-background", colorCls)}>
                    <Icon className="h-3 w-3" />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-tight">
                    <span className="font-semibold">{n.origen?.nombre || "Alguien"}</span>
                    {n.origen?.verificado && <BadgeCheck className="ml-1 inline h-3.5 w-3.5 text-primary" />}
                    <span className="ml-1 text-muted-foreground">{TXT[n.tipo] || n.tipo}</span>
                  </p>
                  {n.publicacion?.titulo && <p className="mt-0.5 truncate text-xs text-muted-foreground">"{n.publicacion.titulo}"</p>}
                  <p className="mt-0.5 text-[11px] text-muted-foreground">{formatTime(n.created_at)}</p>
                </div>
                {thumb ? (
                  <img src={thumb} alt="" className="h-12 w-12 shrink-0 rounded-md border object-cover" />
                ) : !n.leida ? <span className="h-2 w-2 shrink-0 rounded-full bg-primary" /> : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
