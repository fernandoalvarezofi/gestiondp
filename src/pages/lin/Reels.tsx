import { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Heart, MessageCircle, Share2, BadgeCheck, Music4, Volume2, VolumeX, ArrowLeft, Play, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { initials, formatNumber } from "@/lib/worefHelpers";
import { trackEvento } from "@/lib/feedTracker";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const SELECT = `id,titulo,cuerpo,video_url,imagen_url,thumbnail_url,total_likes,total_comentarios,total_repostes,vistas,created_at,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url,verificado)`;

export default function Reels() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [reels, setReels] = useState<any[]>([]);
  const [actual, setActual] = useState(0);
  const [muted, setMuted] = useState(true);
  const [likes, setLikes] = useState<Record<string, boolean>>({});
  const containerRef = useRef<HTMLDivElement>(null);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("publicaciones").select(SELECT)
        .eq("estado", "activa").not("video_url", "is", null)
        .order("created_at", { ascending: false }).limit(30);
      setReels(data || []);
      if (user && data?.length) {
        const { data: l } = await (supabase as any).from("likes").select("publicacion_id").eq("perfil_id", user.id).in("publicacion_id", data.map((r: any) => r.id));
        setLikes(Object.fromEntries((l || []).map((x: any) => [x.publicacion_id, true])));
      }
    })();
  }, [user]);

  // Detectar cuál video está en pantalla
  const onScroll = useCallback(() => {
    const c = containerRef.current; if (!c) return;
    const idx = Math.round(c.scrollTop / c.clientHeight);
    setActual(idx);
  }, []);

  useEffect(() => {
    videoRefs.current.forEach((v, i) => {
      if (!v) return;
      if (i === actual) { v.currentTime = 0; v.play().catch(() => {}); }
      else { v.pause(); }
    });
    const r = reels[actual];
    if (r && user) trackEvento({ perfilId: user.id, publicacionId: r.id, autorId: r.perfil?.id, accion: "view" });
  }, [actual, reels, user]);

  const toggleLike = async (pub: any) => {
    if (!user) { toast.error("Iniciá sesión"); return; }
    const liked = likes[pub.id];
    setLikes((s) => ({ ...s, [pub.id]: !liked }));
    if (liked) await (supabase as any).from("likes").delete().eq("perfil_id", user.id).eq("publicacion_id", pub.id);
    else {
      await (supabase as any).from("likes").insert({ perfil_id: user.id, publicacion_id: pub.id });
      trackEvento({ perfilId: user.id, publicacionId: pub.id, autorId: pub.perfil?.id, accion: "like" });
    }
  };

  const compartir = async (pub: any) => {
    const url = `${window.location.origin}/lin/publicacion/${pub.id}`;
    try {
      if (navigator.share) await navigator.share({ title: pub.titulo || "Reel", url });
      else { await navigator.clipboard.writeText(url); toast.success("Enlace copiado"); }
      if (user) trackEvento({ perfilId: user.id, publicacionId: pub.id, autorId: pub.perfil?.id, accion: "share" });
    } catch {}
  };

  if (reels.length === 0) {
    return (
      <div className="-mt-6 flex h-[calc(100vh-7rem)] flex-col items-center justify-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-full border-2"><Play className="ml-1 h-8 w-8" /></div>
        <p className="text-lg font-semibold">Aún no hay Reels</p>
        <p className="max-w-xs text-sm text-muted-foreground">Subí un video corto y lo verás acá. Vertical, máximo 60s.</p>
        <Button asChild className="rounded-full"><Link to="/lin/publicar"><Plus className="mr-1.5 h-4 w-4" /> Crear Reel</Link></Button>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-40 bg-black md:relative md:-mt-6 md:h-[calc(100vh-7rem)] md:rounded-2xl md:overflow-hidden">
      <button onClick={() => navigate(-1)} className="absolute left-3 top-3 z-20 rounded-full bg-black/40 p-2 text-white backdrop-blur md:hidden" aria-label="Volver">
        <ArrowLeft className="h-5 w-5" />
      </button>
      <button onClick={() => setMuted((m) => !m)} className="absolute right-3 top-3 z-20 rounded-full bg-black/40 p-2 text-white backdrop-blur" aria-label="Silenciar">
        {muted ? <VolumeX className="h-5 w-5" /> : <Volume2 className="h-5 w-5" />}
      </button>

      <div ref={containerRef} onScroll={onScroll} className="h-full snap-y snap-mandatory overflow-y-scroll scroll-smooth">
        {reels.map((r, i) => (
          <article key={r.id} className="relative flex h-full w-full snap-start items-center justify-center bg-black">
            <video
              ref={(el) => (videoRefs.current[i] = el)}
              src={r.video_url}
              poster={r.thumbnail_url || undefined}
              muted={muted}
              loop
              playsInline
              onClick={() => { const v = videoRefs.current[i]; if (!v) return; v.paused ? v.play() : v.pause(); }}
              className="max-h-full max-w-full object-contain"
            />

            {/* Overlay info */}
            <div className="absolute inset-x-0 bottom-0 flex items-end gap-3 bg-gradient-to-t from-black/70 via-black/30 to-transparent p-4 text-white">
              <div className="min-w-0 flex-1 space-y-2">
                <Link to={`/lin/perfil/${r.perfil?.username}`} className="flex items-center gap-2">
                  <Avatar className="h-9 w-9 ring-2 ring-white/30"><AvatarImage src={r.perfil?.avatar_url || ""} /><AvatarFallback>{initials(r.perfil?.nombre)}</AvatarFallback></Avatar>
                  <span className="font-semibold">{r.perfil?.nombre}</span>
                  {r.perfil?.verificado && <BadgeCheck className="h-4 w-4 text-primary" />}
                </Link>
                {r.titulo && <p className="text-sm font-medium">{r.titulo}</p>}
                {r.cuerpo && <p className="line-clamp-2 text-xs text-white/85">{r.cuerpo}</p>}
                <p className="flex items-center gap-1.5 text-[11px] text-white/70"><Music4 className="h-3 w-3" /> Audio original · {r.perfil?.nombre}</p>
              </div>

              <div className="flex flex-col items-center gap-3">
                <ReelAction icon={Heart} count={r.total_likes} active={!!likes[r.id]} onClick={() => toggleLike(r)} activeColor="text-rose-500 fill-rose-500" />
                <ReelAction icon={MessageCircle} count={r.total_comentarios} onClick={() => navigate(`/lin/publicacion/${r.id}`)} />
                <ReelAction icon={Share2} count={r.total_repostes} onClick={() => compartir(r)} />
              </div>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}

function ReelAction({ icon: Icon, count, onClick, active, activeColor }: any) {
  return (
    <button onClick={onClick} className="flex flex-col items-center gap-0.5 text-white">
      <span className="flex h-11 w-11 items-center justify-center rounded-full bg-white/10 backdrop-blur transition-transform active:scale-90">
        <Icon className={cn("h-6 w-6", active && activeColor)} />
      </span>
      <span className="text-[11px] font-semibold">{formatNumber(count)}</span>
    </button>
  );
}
