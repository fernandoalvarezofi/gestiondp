import { Link, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { Heart, MessageCircle, Repeat2, Bookmark, BadgeCheck, MoreHorizontal, BarChart3, Trash2, Pause, Play, Share2 } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TIPO_PUBLICACION, initials, formatTime, formatNumber } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export function PostCard({ pub }: { pub: any }) {
  const { user } = useAuth();
  const navigate = useNavigate();
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

  const requireAuth = () => { if (!user) { toast.error("Iniciá sesión"); return false; } return true; };

  const toggleLike = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!requireAuth()) return;
    if (liked) {
      await (supabase as any).from("likes").delete().eq("perfil_id", user!.id).eq("publicacion_id", pub.id);
      setLiked(false); setCounts((c) => ({ ...c, likes: Math.max(0, c.likes - 1) }));
    } else {
      await (supabase as any).from("likes").insert({ perfil_id: user!.id, publicacion_id: pub.id });
      setLiked(true); setCounts((c) => ({ ...c, likes: c.likes + 1 }));
    }
  };

  const toggleSave = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!requireAuth()) return;
    if (saved) {
      await (supabase as any).from("favoritos").delete().eq("perfil_id", user!.id).eq("publicacion_id", pub.id);
      setSaved(false);
    } else {
      await (supabase as any).from("favoritos").insert({ perfil_id: user!.id, publicacion_id: pub.id });
      setSaved(true); toast.success("Guardado");
    }
  };

  const toggleRepost = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    if (!requireAuth()) return;
    if (reposted) {
      await (supabase as any).from("repostes").delete().eq("perfil_id", user!.id).eq("publicacion_id", pub.id);
      setReposted(false); setCounts((c) => ({ ...c, rep: Math.max(0, c.rep - 1) }));
    } else {
      await (supabase as any).from("repostes").insert({ perfil_id: user!.id, publicacion_id: pub.id });
      setReposted(true); setCounts((c) => ({ ...c, rep: c.rep + 1 })); toast.success("Reposteado");
    }
  };

  const share = async (e: React.MouseEvent) => {
    e.stopPropagation(); e.preventDefault();
    const url = `${window.location.origin}/lin/publicacion/${pub.id}`;
    try {
      if (navigator.share) await navigator.share({ title: pub.titulo || "Woref", url });
      else { await navigator.clipboard.writeText(url); toast.success("Enlace copiado"); }
    } catch {}
  };

  const tipoMeta = TIPO_PUBLICACION[pub.tipo] || TIPO_PUBLICACION.general;
  const portada = pub.media?.find((m: any) => m.es_portada)?.url || pub.media?.[0]?.url || pub.imagen_url;
  const username = pub.perfil?.username;
  const open = () => navigate(`/lin/publicacion/${pub.id}`);

  return (
    <article
      onClick={open}
      className="group cursor-pointer border-b px-4 py-3 transition-colors hover:bg-secondary/30 sm:px-5"
    >
      <div className="flex gap-3">
        <Link to={username ? `/lin/perfil/${username}` : "#"} onClick={(e) => e.stopPropagation()} className="shrink-0">
          <Avatar className="h-11 w-11">
            <AvatarImage src={pub.perfil?.avatar_url || ""} className="object-cover" />
            <AvatarFallback className="text-xs">{initials(pub.perfil?.nombre)}</AvatarFallback>
          </Avatar>
        </Link>

        <div className="min-w-0 flex-1">
          {/* Meta row */}
          <div className="flex items-start gap-1.5">
            <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 text-sm leading-tight">
              <Link
                to={username ? `/lin/perfil/${username}` : "#"}
                onClick={(e) => e.stopPropagation()}
                className="truncate font-semibold hover:underline"
              >
                {pub.perfil?.nombre || "Sin nombre"}
              </Link>
              {pub.perfil?.verificado && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
              <span className="truncate text-muted-foreground">@{username}</span>
              <span className="text-muted-foreground">·</span>
              <span className="shrink-0 text-muted-foreground hover:underline">{formatTime(pub.created_at)}</span>
              {pub.destacada && (
                <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Destacado</span>
              )}
            </div>

            <div className="ml-auto -mr-1.5 -mt-1.5">
              {user?.id === pub.perfil?.id ? (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
                    <DropdownMenuItem
                      onClick={async () => {
                        await (supabase as any).from("publicaciones").update({ estado: pub.estado === "activa" ? "pausada" : "activa" }).eq("id", pub.id).eq("perfil_id", user.id);
                        toast.success(pub.estado === "activa" ? "Pausada" : "Activada");
                        window.location.reload();
                      }}
                    >
                      {pub.estado === "activa" ? <><Pause className="mr-2 h-4 w-4" /> Pausar</> : <><Play className="mr-2 h-4 w-4" /> Activar</>}
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onClick={async () => {
                        if (!confirm("¿Eliminar esta publicación?")) return;
                        await (supabase as any).from("publicaciones").update({ estado: "eliminada" }).eq("id", pub.id).eq("perfil_id", user.id);
                        toast.success("Eliminada");
                        window.location.reload();
                      }}
                    >
                      <Trash2 className="mr-2 h-4 w-4" /> Eliminar
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              ) : (
                <Button
                  variant="ghost" size="icon"
                  onClick={(e) => e.stopPropagation()}
                  className="h-8 w-8 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary"
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Tipo chip */}
          {pub.tipo !== "general" && (
            <div className="mt-0.5">
              <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                <span>{tipoMeta.emoji}</span>{tipoMeta.label}
              </span>
            </div>
          )}

          {/* Contenido */}
          <div className="mt-1 space-y-2">
            {pub.titulo && <h3 className="text-[15px] font-semibold leading-snug">{pub.titulo}</h3>}
            {pub.cuerpo && (
              <p className="whitespace-pre-wrap text-[15px] leading-relaxed text-foreground/90 line-clamp-6">
                {pub.cuerpo}
              </p>
            )}

            {pub.tipo === "encuesta" && pub.encuesta_opciones?.length > 0 && (
              <div className="space-y-1.5 pt-1">
                {pub.encuesta_opciones.map((op: string, i: number) => (
                  <div key={i} className="rounded-lg border px-3 py-2 text-sm transition-colors hover:border-primary hover:bg-primary/5">{op}</div>
                ))}
              </div>
            )}

            {(pub.tipo === "hiring" || pub.tipo === "oportunidad") && pub.rol_buscado && (
              <div className="space-y-1 rounded-xl border bg-secondary/30 p-3 text-xs">
                <p><span className="font-semibold">Rol:</span> {pub.rol_buscado}</p>
                {pub.modalidad && <p><span className="font-semibold">Modalidad:</span> {pub.modalidad}</p>}
                {pub.pais && <p><span className="font-semibold">País:</span> {pub.pais}</p>}
              </div>
            )}

            {portada && (
              <div className="overflow-hidden rounded-2xl border bg-secondary/20">
                <img src={portada} alt={pub.titulo || ""} className="max-h-[500px] w-full object-cover" loading="lazy" />
              </div>
            )}
            {pub.video_url && (
              <video
                src={pub.video_url}
                controls
                onClick={(e) => e.stopPropagation()}
                className="max-h-[500px] w-full rounded-2xl border bg-black"
              />
            )}

            {pub.tags?.length > 0 && (
              <div className="flex flex-wrap gap-x-2 gap-y-0.5 pt-0.5">
                {pub.tags.slice(0, 6).map((t: string) => (
                  <span key={t} className="text-[13px] text-primary hover:underline">#{t}</span>
                ))}
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="mt-2 -ml-2 flex items-center justify-between text-muted-foreground">
            <ActionBtn icon={MessageCircle} count={counts.com} onClick={open} hoverColor="text-primary" />
            <ActionBtn icon={Repeat2} count={counts.rep} active={reposted} onClick={toggleRepost} hoverColor="text-emerald-600" activeColor="text-emerald-600" />
            <ActionBtn icon={Heart} count={counts.likes} active={liked} onClick={toggleLike} hoverColor="text-rose-500" activeColor="text-rose-500" fillOnActive />
            <ActionBtn icon={BarChart3} count={pub.vistas} hoverColor="text-primary" />
            <div className="flex items-center">
              <IconBtn icon={Bookmark} active={saved} onClick={toggleSave} hoverColor="text-primary" activeColor="text-primary" fillOnActive />
              <IconBtn icon={Share2} onClick={share} hoverColor="text-primary" />
            </div>
          </div>
        </div>
      </div>
    </article>
  );
}

function ActionBtn({
  icon: Icon, count, onClick, active, hoverColor, activeColor, fillOnActive,
}: {
  icon: any; count: number; onClick?: (e: React.MouseEvent) => void;
  active?: boolean; hoverColor: string; activeColor?: string; fillOnActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("group/btn flex items-center gap-0.5 text-xs", active && activeColor)}
    >
      <span className={cn("rounded-full p-1.5 transition-colors", `group-hover/btn:bg-current/10 group-hover/btn:${hoverColor}`)}>
        <Icon className={cn("h-[18px] w-[18px] transition-colors", active && fillOnActive && "fill-current", !active && `group-hover/btn:${hoverColor}`)} />
      </span>
      <span className={cn("min-w-[1ch] transition-colors", !active && `group-hover/btn:${hoverColor}`)}>{formatNumber(count)}</span>
    </button>
  );
}

function IconBtn({
  icon: Icon, onClick, active, hoverColor, activeColor, fillOnActive,
}: {
  icon: any; onClick?: (e: React.MouseEvent) => void;
  active?: boolean; hoverColor: string; activeColor?: string; fillOnActive?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      className={cn("group/btn rounded-full p-1.5 transition-colors hover:bg-primary/10", active && activeColor)}
    >
      <Icon className={cn("h-[18px] w-[18px] transition-colors", active && fillOnActive && "fill-current", !active && `group-hover/btn:${hoverColor}`)} />
    </button>
  );
}
