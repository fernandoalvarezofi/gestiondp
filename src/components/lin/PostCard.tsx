import { Link } from "react-router-dom";
import { useEffect, useState } from "react";
import { Heart, MessageCircle, Repeat2, Bookmark, BadgeCheck, MoreHorizontal, BarChart3 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TIPO_PUBLICACION, TIPO_USUARIO, initials, formatTime, formatNumber } from "@/lib/worefHelpers";
import { toast } from "sonner";

export function PostCard({ pub }: { pub: any }) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [counts, setCounts] = useState({ likes: pub.total_likes || 0, com: pub.total_comentarios || 0, rep: pub.total_repostes || 0 });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: l }, { data: f }, { data: r }] = await Promise.all([
        (supabase as any).from("likes").select("id").eq("perfil_id", user.id).eq("publicacion_id", pub.id).maybeSingle(),
        (supabase as any).from("favoritos").select("id").eq("perfil_id", user.id).eq("publicacion_id", pub.id).maybeSingle(),
        (supabase as any).from("repostes").select("id").eq("perfil_id", user.id).eq("publicacion_id", pub.id).maybeSingle(),
      ]);
      setLiked(!!l); setSaved(!!f); setReposted(!!r);
    })();
  }, [user, pub.id]);

  const toggleLike = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (liked) {
      await (supabase as any).from("likes").delete().eq("perfil_id", user.id).eq("publicacion_id", pub.id);
      setLiked(false); setCounts((c) => ({ ...c, likes: c.likes - 1 }));
    } else {
      await (supabase as any).from("likes").insert({ perfil_id: user.id, publicacion_id: pub.id });
      setLiked(true); setCounts((c) => ({ ...c, likes: c.likes + 1 }));
    }
  };

  const toggleSave = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (saved) {
      await (supabase as any).from("favoritos").delete().eq("perfil_id", user.id).eq("publicacion_id", pub.id);
      setSaved(false);
    } else {
      await (supabase as any).from("favoritos").insert({ perfil_id: user.id, publicacion_id: pub.id });
      setSaved(true); toast.success("Guardado");
    }
  };

  const toggleRepost = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (reposted) {
      await (supabase as any).from("repostes").delete().eq("perfil_id", user.id).eq("publicacion_id", pub.id);
      setReposted(false); setCounts((c) => ({ ...c, rep: c.rep - 1 }));
    } else {
      await (supabase as any).from("repostes").insert({ perfil_id: user.id, publicacion_id: pub.id });
      setReposted(true); setCounts((c) => ({ ...c, rep: c.rep + 1 })); toast.success("Reposteado");
    }
  };

  const tipoMeta = TIPO_PUBLICACION[pub.tipo] || TIPO_PUBLICACION.general;
  const portada = pub.media?.find((m: any) => m.es_portada)?.url || pub.media?.[0]?.url || pub.imagen_url;
  const username = pub.perfil?.username;

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <Link to={username ? `/lin/perfil/${username}` : "#"} className="flex items-center gap-3 min-w-0">
            <Avatar className="h-10 w-10">
              <AvatarImage src={pub.perfil?.avatar_url || ""} className="object-cover" />
              <AvatarFallback>{initials(pub.perfil?.nombre)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <p className="truncate text-sm font-semibold">{pub.perfil?.nombre}</p>
                {pub.perfil?.verificado && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
              </div>
              <p className="text-xs text-muted-foreground truncate">
                @{username} · {TIPO_USUARIO[pub.perfil?.tipo] || ""} · {formatTime(pub.created_at)}
              </p>
            </div>
          </Link>
          <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0"><MoreHorizontal className="h-4 w-4" /></Button>
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <Badge variant="secondary" className="text-xs"><span className="mr-1">{tipoMeta.emoji}</span>{tipoMeta.label}</Badge>
          {pub.destacada && <Badge className="text-xs">Destacado</Badge>}
        </div>

        <Link to={`/lin/publicacion/${pub.id}`} className="block space-y-2">
          {pub.titulo && <h3 className="text-base font-semibold leading-snug">{pub.titulo}</h3>}
          {pub.cuerpo && <p className="text-sm leading-relaxed text-foreground/90 whitespace-pre-wrap line-clamp-6">{pub.cuerpo}</p>}

          {pub.tipo === "encuesta" && pub.encuesta_opciones?.length > 0 && (
            <div className="space-y-1.5 pt-1">
              {pub.encuesta_opciones.map((op: string, i: number) => (
                <div key={i} className="rounded-md border bg-secondary/40 px-3 py-2 text-sm">{op}</div>
              ))}
            </div>
          )}

          {(pub.tipo === "hiring" || pub.tipo === "oportunidad") && pub.rol_buscado && (
            <div className="rounded-lg border bg-secondary/40 p-3 text-xs space-y-1">
              <p><span className="font-semibold">Rol:</span> {pub.rol_buscado}</p>
              {pub.modalidad && <p><span className="font-semibold">Modalidad:</span> {pub.modalidad}</p>}
              {pub.pais && <p><span className="font-semibold">País:</span> {pub.pais}</p>}
            </div>
          )}

          {portada && (
            <div className="overflow-hidden rounded-lg border">
              <img src={portada} alt={pub.titulo || ""} className="w-full max-h-[480px] object-cover" loading="lazy" />
            </div>
          )}
          {pub.video_url && (
            <video src={pub.video_url} controls className="w-full max-h-[480px] rounded-lg" />
          )}

          {pub.tags?.length > 0 && (
            <div className="flex flex-wrap gap-1 pt-1">
              {pub.tags.slice(0, 6).map((t: string) => <span key={t} className="text-xs text-primary">#{t}</span>)}
            </div>
          )}
        </Link>

        <div className="flex items-center justify-between border-t pt-3 text-muted-foreground">
          <button onClick={toggleLike} className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-rose-500" : "hover:text-rose-500"}`}>
            <Heart className={`h-4 w-4 ${liked ? "fill-current" : ""}`} />{formatNumber(counts.likes)}
          </button>
          <Link to={`/lin/publicacion/${pub.id}`} className="flex items-center gap-1.5 text-xs hover:text-primary">
            <MessageCircle className="h-4 w-4" />{formatNumber(counts.com)}
          </Link>
          <button onClick={toggleRepost} className={`flex items-center gap-1.5 text-xs transition-colors ${reposted ? "text-emerald-600" : "hover:text-emerald-600"}`}>
            <Repeat2 className="h-4 w-4" />{formatNumber(counts.rep)}
          </button>
          <span className="flex items-center gap-1.5 text-xs"><BarChart3 className="h-4 w-4" />{formatNumber(pub.vistas)}</span>
          <button onClick={toggleSave} className={`flex items-center gap-1.5 text-xs transition-colors ${saved ? "text-primary" : "hover:text-primary"}`}>
            <Bookmark className={`h-4 w-4 ${saved ? "fill-current" : ""}`} />
          </button>
        </div>
      </CardContent>
    </Card>
  );
}
