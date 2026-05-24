import { Link, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useState, useCallback } from "react";
import {
  Heart, MessageCircle, Repeat2, Bookmark, BadgeCheck, MoreHorizontal, BarChart3, Trash2,
  Pause, Play, Share2, ChevronLeft, ChevronRight, Link2, Flag, UserPlus, UserMinus, VolumeX,
  Volume2, FileText, Clock, ArrowRight, Briefcase, MapPin, Globe, Maximize2, X, ExternalLink,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator } from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { TIPO_PUBLICACION, initials, formatTime, formatNumber } from "@/lib/worefHelpers";
import { LazyImage } from "./LazyImage";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "./ConfirmDialog";


export function PostCard({ pub, onDeleted }: { pub: any; onDeleted?: (id: string) => void }) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [following, setFollowing] = useState<boolean | null>(null);
  const [hidden, setHidden] = useState(false);
  const [counts, setCounts] = useState({ likes: pub.total_likes || 0, com: pub.total_comentarios || 0, rep: pub.total_repostes || 0 });
  const [expandido, setExpandido] = useState(false);
  const [idxImg, setIdxImg] = useState(0);
  const [muted, setMuted] = useState(true);
  const [voted, setVoted] = useState<number | null>(null);
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: l }, { data: f }, { data: r }] = await Promise.all([
        (supabase as any).from("likes").select("id").eq("perfil_id", user.id).eq("publicacion_id", pub.id).maybeSingle(),
        (supabase as any).from("favoritos").select("id").eq("perfil_id", user.id).eq("publicacion_id", pub.id).maybeSingle(),
        (supabase as any).from("repostes").select("id").eq("perfil_id", user.id).eq("publicacion_id", pub.id).maybeSingle(),
      ]);
      setLiked(!!l); setSaved(!!f); setReposted(!!r);
      if (pub.perfil?.id && pub.perfil.id !== user.id) {
        const { data: s } = await (supabase as any).from("seguidos").select("id").eq("seguidor_id", user.id).eq("seguido_id", pub.perfil.id).maybeSingle();
        setFollowing(!!s);
      }
    })();
  }, [user, pub.id, pub.perfil?.id]);

  const requireAuth = () => { if (!user) { toast.error("Iniciá sesión"); return false; } return true; };
  const copyLink = async () => {
    await navigator.clipboard.writeText(`${window.location.origin}/lin/publicacion/${pub.id}`);
    toast.success("Enlace copiado");
  };
  const toggleFollow = async () => {
    if (!requireAuth() || !pub.perfil?.id) return;
    if (following) {
      await (supabase as any).from("seguidos").delete().eq("seguidor_id", user!.id).eq("seguido_id", pub.perfil.id);
      setFollowing(false); toast.success("Dejaste de seguir");
    } else {
      await (supabase as any).from("seguidos").insert({ seguidor_id: user!.id, seguido_id: pub.perfil.id });
      setFollowing(true); toast.success(`Siguiendo a @${pub.perfil.username}`);
    }
  };
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
  const imagenes = useMemo(() => {
    const set = new Set<string>();
    const arr: string[] = [];
    const push = (u?: string) => { if (u && !set.has(u)) { set.add(u); arr.push(u); } };
    (pub.media || []).sort((a: any, b: any) => (a.orden ?? 0) - (b.orden ?? 0)).forEach((m: any) => push(m.url));
    push(pub.imagen_url);
    return arr;
  }, [pub.media, pub.imagen_url]);
  const username = pub.perfil?.username;
  const open = () => navigate(`/lin/publicacion/${pub.id}`);
  const cuerpoLargo = (pub.cuerpo || "").length > 280;
  const cuerpoMostrado = expandido || !cuerpoLargo ? pub.cuerpo : `${pub.cuerpo.slice(0, 280)}…`;

  if (hidden) return null;
  const isMine = user?.id === pub.perfil?.id;
  const isArticle = pub.tipo === "contenido_largo" || pub.formato === "articulo";
  const isReel = pub.formato === "video_corto" || (pub.video_url && pub.es_reel);
  const isVideo = !!pub.video_url && !isReel;
  const isPoll = pub.tipo === "encuesta" && pub.encuesta_opciones?.length > 0;
  const isHiring = pub.tipo === "hiring" || pub.tipo === "oportunidad" || pub.tipo === "busco_socio";
  const readingTime = Math.max(1, Math.ceil(((pub.cuerpo_largo || pub.cuerpo || "").length) / 1100));

  // ARTÍCULO — layout editorial estilo Medium/LinkedIn
  if (isArticle && (imagenes[0] || pub.titulo)) {
    return (
      <article onClick={open} className="group cursor-pointer border-b px-4 py-4 transition-colors hover:bg-secondary/30 sm:px-5">
        <AutorHeader pub={pub} tipoMeta={tipoMeta} username={username} isMine={isMine} user={user} following={following}
          toggleFollow={toggleFollow} copyLink={copyLink} share={share} setHidden={setHidden} onDeleted={onDeleted} />
        <div className="mt-3 grid gap-4 sm:grid-cols-[1fr,180px]">
          <div className="min-w-0">
            <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-primary">
              <FileText className="h-3 w-3" /> Artículo
            </span>
            <h2 className="mt-1.5 font-display text-xl font-bold leading-tight tracking-tight sm:text-2xl">
              {pub.titulo || "Sin título"}
            </h2>
            {pub.cuerpo && <p className="mt-2 line-clamp-3 text-[14px] leading-relaxed text-muted-foreground">{pub.cuerpo}</p>}
            <div className="mt-3 flex items-center gap-3 text-[12px] text-muted-foreground">
              <span className="inline-flex items-center gap-1"><Clock className="h-3 w-3" />{readingTime} min de lectura</span>
              <span>·</span>
              <span className="inline-flex items-center gap-1 font-medium text-primary">Leer artículo <ArrowRight className="h-3 w-3" /></span>
            </div>
          </div>
          {imagenes[0] && (
            <div className="aspect-[4/3] overflow-hidden rounded-xl border bg-secondary/20 sm:aspect-square">
              <LazyImage src={imagenes[0]} className="object-cover transition-transform duration-500 group-hover:scale-105" />
            </div>
          )}
        </div>
        <Actions counts={counts} liked={liked} saved={saved} reposted={reposted}
          toggleLike={toggleLike} toggleRepost={toggleRepost} toggleSave={toggleSave} share={share} open={open} views={pub.vistas} />
      </article>
    );
  }

  // REEL — preview vertical estilo TikTok/IG Reels
  if (isReel) {
    return (
      <article onClick={open} className="group cursor-pointer border-b px-4 py-3 transition-colors hover:bg-secondary/30 sm:px-5">
        <AutorHeader pub={pub} tipoMeta={tipoMeta} username={username} isMine={isMine} user={user} following={following}
          toggleFollow={toggleFollow} copyLink={copyLink} share={share} setHidden={setHidden} onDeleted={onDeleted} />
        <div className="mt-2 grid gap-3 sm:grid-cols-[220px,1fr]">
          <div onClick={(e) => { e.stopPropagation(); navigate(`/lin/reels?p=${pub.id}`); }}
            className="group/reel relative aspect-[9/16] overflow-hidden rounded-2xl border bg-black sm:max-w-[220px]">
            <video src={pub.video_url} muted={muted} loop playsInline preload="metadata"
              className="absolute inset-0 h-full w-full object-cover"
              onMouseEnter={(e) => (e.currentTarget as HTMLVideoElement).play().catch(()=>{})}
              onMouseLeave={(e) => (e.currentTarget as HTMLVideoElement).pause()} />
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent" />
            <button onClick={(e) => { e.stopPropagation(); setMuted((m) => !m); }}
              className="absolute right-2 top-2 rounded-full bg-black/50 p-1.5 text-white backdrop-blur">
              {muted ? <VolumeX className="h-3.5 w-3.5" /> : <Volume2 className="h-3.5 w-3.5" />}
            </button>
            <div className="absolute bottom-2 left-2 right-2 flex items-end justify-between text-white">
              <span className="inline-flex items-center gap-1 rounded-full bg-black/50 px-2 py-0.5 text-[10px] font-semibold backdrop-blur">
                <Play className="h-2.5 w-2.5 fill-current" /> Reel
              </span>
              <span className="text-[10px] font-medium">{formatNumber(pub.vistas)} views</span>
            </div>
          </div>
          {(pub.titulo || pub.cuerpo) && (
            <div className="min-w-0">
              {pub.titulo && <h3 className="text-[15px] font-semibold leading-snug">{pub.titulo}</h3>}
              {pub.cuerpo && <p className="mt-1 line-clamp-4 text-[14px] leading-relaxed text-foreground/90">{pub.cuerpo}</p>}
              <TagsRow tags={pub.tags} />
            </div>
          )}
        </div>
        <Actions counts={counts} liked={liked} saved={saved} reposted={reposted}
          toggleLike={toggleLike} toggleRepost={toggleRepost} toggleSave={toggleSave} share={share} open={open} views={pub.vistas} />
      </article>
    );
  }

  // ESTÁNDAR (texto / foto / video / encuesta / hiring)
  return (
    <article onClick={open} className="group cursor-pointer border-b px-4 py-3 transition-colors hover:bg-secondary/30 sm:px-5">
      <div className="flex gap-3">
        <Link to={username ? `/lin/perfil/${username}` : "#"} onClick={(e) => e.stopPropagation()} className="shrink-0">
          <Avatar className="h-11 w-11 ring-1 ring-border">
            <AvatarImage src={pub.perfil?.avatar_url || ""} className="object-cover" />
            <AvatarFallback className="text-xs">{initials(pub.perfil?.nombre)}</AvatarFallback>
          </Avatar>
        </Link>
        <div className="min-w-0 flex-1">
          <AutorMeta pub={pub} tipoMeta={tipoMeta} username={username} isMine={isMine} user={user} following={following}
            toggleFollow={toggleFollow} copyLink={copyLink} share={share} setHidden={setHidden} onDeleted={onDeleted} />

          <div className="mt-1 space-y-2.5">
            {pub.titulo && <h3 className="text-[16px] sm:text-[15px] font-semibold leading-snug">{pub.titulo}</h3>}
            {pub.cuerpo && (
              <div>
                <p className="whitespace-pre-wrap break-words text-[16px] leading-relaxed text-foreground/90">
                  {renderTextWithLinks(cuerpoMostrado)}
                </p>
                {cuerpoLargo && (
                  <button onClick={(e) => { e.stopPropagation(); e.preventDefault(); setExpandido(!expandido); }}
                    className="mt-0.5 text-[13px] font-medium text-primary hover:underline">
                    {expandido ? "Ver menos" : "Ver más"}
                  </button>
                )}
              </div>
            )}

            {/* Link preview — solo si no hay imágenes ni video */}
            {imagenes.length === 0 && !isVideo && pub.cuerpo && (
              <LinkPreview text={pub.cuerpo} />
            )}

            {isHiring && (pub.rol_buscado || pub.modalidad || pub.pais) && (
              <div className="rounded-2xl border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-amber-500/5 p-3.5">
                <div className="flex items-start gap-2">
                  <div className="rounded-lg bg-primary/15 p-1.5 text-primary"><Briefcase className="h-4 w-4" /></div>
                  <div className="min-w-0 flex-1">
                    {pub.rol_buscado && <p className="text-sm font-semibold">{pub.rol_buscado}</p>}
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {pub.modalidad && <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[12px] font-medium"><Globe className="h-2.5 w-2.5" />{pub.modalidad}</span>}
                      {pub.pais && <span className="inline-flex items-center gap-1 rounded-full bg-background px-2 py-0.5 text-[12px] font-medium"><MapPin className="h-2.5 w-2.5" />{pub.pais}</span>}
                    </div>
                  </div>
                  <Button size="sm" variant="default" className="h-7 rounded-full px-3 text-[12px]" onClick={(e) => { e.stopPropagation(); open(); }}>
                    Aplicar
                  </Button>
                </div>
              </div>
            )}

            {isPoll && (
              <div className="space-y-2 pt-1">
                {pub.encuesta_opciones.map((op: string, i: number) => {
                  const isVoted = voted === i;
                  const pct = voted !== null ? (isVoted ? 62 : Math.max(8, 38 - i * 7)) : 0;
                  return (
                    <button key={i} onClick={(e) => { e.stopPropagation(); e.preventDefault(); if (!requireAuth()) return; setVoted(i); }}
                      className={cn("relative w-full overflow-hidden rounded-xl border text-left text-sm transition-all",
                        voted === null ? "border-border px-3 py-2.5 hover:border-primary hover:bg-primary/5" : "border-primary/30 px-3 py-2.5")}>
                      {voted !== null && (
                        <div className={cn("absolute inset-y-0 left-0 transition-all duration-700", isVoted ? "bg-primary/20" : "bg-secondary")}
                          style={{ width: `${pct}%` }} />
                      )}
                      <div className="relative flex items-center justify-between">
                        <span className={cn("font-medium", isVoted && "text-primary")}>{op}</span>
                        {voted !== null && <span className="text-xs font-semibold text-muted-foreground">{pct}%</span>}
                      </div>
                    </button>
                  );
                })}
                <p className="text-[12px] text-muted-foreground">{voted !== null ? "Voto registrado" : "Tocá una opción para votar"} · {formatNumber(pub.vistas)} vistas</p>
              </div>
            )}

            {imagenes.length === 1 && (
              <div
                onClick={(e) => { e.stopPropagation(); e.preventDefault(); setLightboxIdx(0); }}
                className="cursor-zoom-in overflow-hidden rounded-2xl border bg-secondary/20"
                style={{ aspectRatio: "16 / 10" }}
              >
                <LazyImage src={imagenes[0]} alt={pub.titulo || ""} className="object-cover" />
              </div>
            )}
            {imagenes.length > 1 && (
              <div className="relative overflow-hidden rounded-2xl border bg-secondary/20" style={{ aspectRatio: "4 / 3" }}
                onClick={(e) => e.stopPropagation()}>
                <div className="h-full w-full cursor-zoom-in" onClick={(e) => { e.stopPropagation(); e.preventDefault(); setLightboxIdx(idxImg); }}>
                  <LazyImage src={imagenes[idxImg]} alt={pub.titulo || ""} className="object-cover" />
                </div>
                <span className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-0.5 text-[12px] font-semibold text-white backdrop-blur">
                  {idxImg + 1}/{imagenes.length}
                </span>
                <button onClick={() => setIdxImg((i) => (i - 1 + imagenes.length) % imagenes.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-80 transition hover:opacity-100">
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button onClick={() => setIdxImg((i) => (i + 1) % imagenes.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/50 p-1.5 text-white opacity-80 transition hover:opacity-100">
                  <ChevronRight className="h-4 w-4" />
                </button>
                <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 gap-1">
                  {imagenes.map((_, i) => <span key={i} className={cn("h-1.5 rounded-full transition-all", i === idxImg ? "w-4 bg-white" : "w-1.5 bg-white/40")} />)}
                </div>
              </div>
            )}
            {isVideo && (
              <div className="relative overflow-hidden rounded-2xl border bg-black" onClick={(e) => e.stopPropagation()}>
                <video src={pub.video_url} controls className="max-h-[500px] w-full" preload="metadata" />
                <span className="pointer-events-none absolute left-2 top-2 inline-flex items-center gap-1 rounded-md bg-black/60 px-1.5 py-0.5 text-[12px] font-semibold text-white backdrop-blur">
                  <Play className="h-2.5 w-2.5 fill-current" /> Video
                </span>
              </div>
            )}
            <TagsRow tags={pub.tags} />
          </div>

          <Actions counts={counts} liked={liked} saved={saved} reposted={reposted}
            toggleLike={toggleLike} toggleRepost={toggleRepost} toggleSave={toggleSave} share={share} open={open} views={pub.vistas} />
        </div>
      </div>

      {lightboxIdx !== null && imagenes.length > 0 && (
        <Lightbox
          images={imagenes}
          index={lightboxIdx}
          onClose={() => setLightboxIdx(null)}
          onChange={setLightboxIdx}
        />
      )}
    </article>
  );
}

function TagsRow({ tags }: { tags?: string[] }) {
  if (!tags?.length) return null;
  return (
    <div className="flex flex-wrap gap-x-2 gap-y-0.5 pt-0.5">
      {tags.slice(0, 6).map((t) => <span key={t} className="text-[13px] text-primary hover:underline">#{t}</span>)}
    </div>
  );
}

function AutorMeta({ pub, tipoMeta, username, isMine, user, following, toggleFollow, copyLink, share, setHidden, onDeleted }: any) {
  return (
    <div className="flex items-start gap-1.5">
      <div className="flex min-w-0 flex-wrap items-center gap-x-1.5 gap-y-0 text-sm leading-tight">
        <Link to={username ? `/lin/perfil/${username}` : "#"} onClick={(e) => e.stopPropagation()}
          className="truncate font-semibold hover:underline">{pub.perfil?.nombre || "Sin nombre"}</Link>
        {pub.perfil?.verificado && <BadgeCheck className="h-4 w-4 shrink-0 text-primary" />}
        <span className="truncate text-muted-foreground">@{username}</span>
        <span className="text-muted-foreground">·</span>
        <span className="shrink-0 text-muted-foreground">{formatTime(pub.created_at)}</span>
        {pub.tipo !== "general" && (
          <span className={cn("ml-1 hidden items-center gap-1 rounded-full px-1.5 py-0.5 text-[10px] font-medium sm:inline-flex", tipoMeta.color)}>
            <tipoMeta.icon className="h-3 w-3" />{tipoMeta.label}
          </span>
        )}
        {pub.destacada && <span className="ml-1 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">Destacado</span>}
      </div>
      <PostMenu pub={pub} isMine={isMine} user={user} username={username} following={following}
        toggleFollow={toggleFollow} copyLink={copyLink} share={share} setHidden={setHidden} onDeleted={onDeleted} />
    </div>
  );
}

function AutorHeader({ pub, tipoMeta, username, isMine, user, following, toggleFollow, copyLink, share, setHidden, onDeleted }: any) {
  return (
    <div className="flex items-start gap-3">
      <Link to={username ? `/lin/perfil/${username}` : "#"} onClick={(e) => e.stopPropagation()} className="shrink-0">
        <Avatar className="h-10 w-10 ring-1 ring-border">
          <AvatarImage src={pub.perfil?.avatar_url || ""} className="object-cover" />
          <AvatarFallback className="text-xs">{initials(pub.perfil?.nombre)}</AvatarFallback>
        </Avatar>
      </Link>
      <div className="min-w-0 flex-1">
        <AutorMeta pub={pub} tipoMeta={tipoMeta} username={username} isMine={isMine} user={user} following={following}
          toggleFollow={toggleFollow} copyLink={copyLink} share={share} setHidden={setHidden} onDeleted={onDeleted} />
      </div>
    </div>
  );
}

function PostMenu({ pub, isMine, user, username, following, toggleFollow, copyLink, share, setHidden, onDeleted }: any) {
  const confirm = useConfirm();

  return (
    <div className="ml-auto -mr-1.5 -mt-1.5">
      <DropdownMenu>
        <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
          <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56" onClick={(e) => e.stopPropagation()}>
          <DropdownMenuItem onClick={copyLink}><Link2 className="mr-2 h-4 w-4" />Copiar enlace</DropdownMenuItem>
          <DropdownMenuItem onClick={share}><Share2 className="mr-2 h-4 w-4" />Compartir</DropdownMenuItem>
          {isMine ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={async () => {
                await (supabase as any).from("publicaciones").update({ estado: pub.estado === "activa" ? "pausada" : "activa" }).eq("id", pub.id).eq("perfil_id", user!.id);
                toast.success(pub.estado === "activa" ? "Pausada" : "Activada");
                setHidden(true);
              }}>
                {pub.estado === "activa" ? <><Pause className="mr-2 h-4 w-4" />Pausar</> : <><Play className="mr-2 h-4 w-4" />Activar</>}
              </DropdownMenuItem>
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={async () => {
                const ok = await confirm({ title: "¿Eliminar publicación?", description: "Esta acción no se puede deshacer.", confirmText: "Eliminar", destructive: true });
                if (!ok) return;
                await (supabase as any).from("publicaciones").update({ estado: "eliminada" }).eq("id", pub.id).eq("perfil_id", user!.id);
                toast.success("Publicación eliminada"); setHidden(true); onDeleted?.(pub.id);
              }}>
                <Trash2 className="mr-2 h-4 w-4" />Eliminar
              </DropdownMenuItem>

            </>
          ) : user ? (
            <>
              <DropdownMenuSeparator />
              {following !== null && (
                <DropdownMenuItem onClick={toggleFollow}>
                  {following ? <><UserMinus className="mr-2 h-4 w-4" />Dejar de seguir a @{username}</> : <><UserPlus className="mr-2 h-4 w-4" />Seguir a @{username}</>}
                </DropdownMenuItem>
              )}
              <DropdownMenuItem onClick={() => { setHidden(true); toast("No te volveremos a mostrar esto"); }}>
                <VolumeX className="mr-2 h-4 w-4" />No me interesa
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem className="text-destructive focus:text-destructive" onClick={() => toast.success("Reporte enviado, gracias")}>
                <Flag className="mr-2 h-4 w-4" />Reportar
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

function Actions({ counts, liked, saved, reposted, toggleLike, toggleRepost, toggleSave, share, open, views }: any) {
  return (
    <div className="mt-2 -ml-2 flex items-center justify-between text-muted-foreground">
      <ActionBtn icon={MessageCircle} count={counts.com} onClick={open} hoverColor="text-primary" />
      <ActionBtn icon={Repeat2} count={counts.rep} active={reposted} onClick={toggleRepost} hoverColor="text-emerald-600" activeColor="text-emerald-600" />
      <ActionBtn icon={Heart} count={counts.likes} active={liked} onClick={toggleLike} hoverColor="text-rose-500" activeColor="text-rose-500" fillOnActive />
      <ActionBtn icon={BarChart3} count={views} hoverColor="text-primary" />
      <div className="flex items-center">
        <IconBtn icon={Bookmark} active={saved} onClick={toggleSave} hoverColor="text-primary" activeColor="text-primary" fillOnActive />
        <IconBtn icon={Share2} onClick={share} hoverColor="text-primary" />
      </div>
    </div>
  );
}

function ActionBtn({ icon: Icon, count, onClick, active, hoverColor, activeColor, fillOnActive }: any) {
  return (
    <button onClick={onClick} className={cn("group/btn flex items-center gap-0.5 text-xs", active && activeColor)}>
      <span className={cn("rounded-full p-1.5 transition-colors", `group-hover/btn:bg-current/10 group-hover/btn:${hoverColor}`)}>
        <Icon className={cn("h-[18px] w-[18px] transition-colors", active && fillOnActive && "fill-current", !active && `group-hover/btn:${hoverColor}`)} />
      </span>
      {count > 0 && <span className={cn("min-w-[1ch] transition-colors", !active && `group-hover/btn:${hoverColor}`)}>{formatNumber(count)}</span>}
    </button>
  );
}

function IconBtn({ icon: Icon, onClick, active, hoverColor, activeColor, fillOnActive }: any) {
  return (
    <button onClick={onClick} className={cn("group/btn rounded-full p-1.5 transition-colors hover:bg-primary/10", active && activeColor)}>
      <Icon className={cn("h-[18px] w-[18px] transition-colors", active && fillOnActive && "fill-current", !active && `group-hover/btn:${hoverColor}`)} />
    </button>
  );
}

/* ----------------------------- Helpers UI ----------------------------- */

const URL_REGEX = /(https?:\/\/[^\s]+)/g;

function renderTextWithLinks(text: string) {
  if (!text) return null;
  const parts = text.split(URL_REGEX);
  return parts.map((part, i) => {
    if (URL_REGEX.test(part)) {
      URL_REGEX.lastIndex = 0;
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="text-primary hover:underline break-all">
          {part.length > 60 ? `${part.slice(0, 60)}…` : part}
        </a>
      );
    }
    return <span key={i}>{part}</span>;
  });
}

function extractFirstUrl(text: string): string | null {
  if (!text) return null;
  const m = text.match(URL_REGEX);
  return m?.[0] || null;
}

function LinkPreview({ text }: { text: string }) {
  const url = extractFirstUrl(text);
  if (!url) return null;
  let host = "";
  let path = "";
  try {
    const u = new URL(url);
    host = u.hostname.replace(/^www\./, "");
    path = u.pathname === "/" ? "" : u.pathname;
  } catch { return null; }
  const favicon = `https://www.google.com/s2/favicons?domain=${host}&sz=64`;
  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      onClick={(e) => e.stopPropagation()}
      className="group/lp flex items-stretch gap-3 overflow-hidden rounded-2xl border bg-secondary/30 transition-colors hover:border-primary/40 hover:bg-secondary/50"
    >
      <div className="flex h-20 w-20 shrink-0 items-center justify-center bg-background sm:h-24 sm:w-24">
        <img
          src={favicon}
          alt=""
          className="h-10 w-10 rounded-md"
          onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }}
        />
      </div>
      <div className="flex min-w-0 flex-1 flex-col justify-center py-2.5 pr-3">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">{host}</p>
        <p className="line-clamp-2 text-[14px] font-medium text-foreground">{path || url}</p>
        <p className="mt-1 inline-flex items-center gap-1 text-[12px] text-primary opacity-0 transition-opacity group-hover/lp:opacity-100">
          Abrir enlace <ExternalLink className="h-3 w-3" />
        </p>
      </div>
    </a>
  );
}

function Lightbox({ images, index, onClose, onChange }: { images: string[]; index: number; onClose: () => void; onChange: (i: number) => void }) {
  const prev = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange((index - 1 + images.length) % images.length);
  }, [index, images.length, onChange]);
  const next = useCallback((e?: React.MouseEvent) => {
    e?.stopPropagation();
    onChange((index + 1) % images.length);
  }, [index, images.length, onChange]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft") prev();
      if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [onClose, prev, next]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/95 p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={(e) => { e.stopPropagation(); onClose(); }}
        className="absolute right-4 top-4 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
        aria-label="Cerrar"
      >
        <X className="h-5 w-5" />
      </button>
      {images.length > 1 && (
        <>
          <button
            onClick={prev}
            className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
            aria-label="Anterior"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
          <button
            onClick={next}
            className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-3 text-white transition hover:bg-white/20"
            aria-label="Siguiente"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
          <span className="absolute bottom-4 left-1/2 -translate-x-1/2 rounded-full bg-white/10 px-3 py-1 text-[12px] font-semibold text-white">
            {index + 1} / {images.length}
          </span>
        </>
      )}
      <img
        src={images[index]}
        alt=""
        onClick={(e) => e.stopPropagation()}
        className="max-h-[92vh] max-w-[92vw] object-contain"
      />
    </div>
  );
}

