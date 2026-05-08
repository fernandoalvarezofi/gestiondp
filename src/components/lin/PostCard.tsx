import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { Heart, MessageCircle, Repeat2, Bookmark, MapPin, BadgeCheck, Eye, MoreHorizontal, Share2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import {
  TIPO_PUBLICACION,
  TIPO_OPERACION,
  TIPO_PROPIEDAD,
  formatPrecio,
  timeAgo,
  initials,
  getFallbackImage,
} from "@/lib/linquenoHelpers";

type Pub = any;

interface Props {
  pub: Pub;
  onUpdated?: () => void;
}

export function PostCard({ pub, onUpdated }: Props) {
  const { user } = useAuth();
  const [liked, setLiked] = useState(false);
  const [favorito, setFavorito] = useState(false);
  const [reposted, setReposted] = useState(false);
  const [counts, setCounts] = useState({
    likes: pub.total_likes || 0,
    comentarios: pub.total_comentarios || 0,
    repostes: pub.total_repostes || 0,
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data: l }, { data: f }, { data: r }] = await Promise.all([
        (supabase as any).from("likes").select("id").eq("perfil_id", user.id).eq("publicacion_id", pub.id).maybeSingle(),
        (supabase as any).from("favoritos").select("id").eq("perfil_id", user.id).eq("publicacion_id", pub.id).maybeSingle(),
        (supabase as any).from("repostes").select("id").eq("perfil_id", user.id).eq("publicacion_id", pub.id).maybeSingle(),
      ]);
      setLiked(!!l);
      setFavorito(!!f);
      setReposted(!!r);
    })();
  }, [user, pub.id]);

  const portada =
    pub.media?.find((m: any) => m.es_portada)?.url ||
    pub.media?.[0]?.url ||
    getFallbackImage(pub.tipo, pub.tipo_propiedad);

  const toggleLike = async () => {
    if (!user) return toast.error("Iniciá sesión para dar me gusta");
    if (liked) {
      await (supabase as any).from("likes").delete().eq("perfil_id", user.id).eq("publicacion_id", pub.id);
      setLiked(false);
      setCounts((c) => ({ ...c, likes: c.likes - 1 }));
    } else {
      await (supabase as any).from("likes").insert({ perfil_id: user.id, publicacion_id: pub.id });
      setLiked(true);
      setCounts((c) => ({ ...c, likes: c.likes + 1 }));
    }
  };

  const toggleFav = async () => {
    if (!user) return toast.error("Iniciá sesión para guardar");
    if (favorito) {
      await (supabase as any).from("favoritos").delete().eq("perfil_id", user.id).eq("publicacion_id", pub.id);
      setFavorito(false);
    } else {
      await (supabase as any).from("favoritos").insert({ perfil_id: user.id, publicacion_id: pub.id });
      setFavorito(true);
      toast.success("Guardado en favoritos");
    }
  };

  const toggleRepost = async () => {
    if (!user) return toast.error("Iniciá sesión para repostear");
    if (reposted) {
      await (supabase as any).from("repostes").delete().eq("perfil_id", user.id).eq("publicacion_id", pub.id);
      setReposted(false);
      setCounts((c) => ({ ...c, repostes: c.repostes - 1 }));
    } else {
      await (supabase as any).from("repostes").insert({ perfil_id: user.id, publicacion_id: pub.id });
      setReposted(true);
      setCounts((c) => ({ ...c, repostes: c.repostes + 1 }));
      toast.success("Reposteado en tu perfil");
    }
  };

  const compartir = async () => {
    const url = `${window.location.origin}/lin/publicacion/${pub.id}`;
    if (navigator.share) {
      try { await navigator.share({ title: pub.titulo, url }); } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast.success("Link copiado");
    }
  };

  const tipoMeta = TIPO_PUBLICACION[pub.tipo] || TIPO_PUBLICACION.general;
  const showPropertyMeta = pub.tipo === "propiedad" || pub.tipo === "agro";

  return (
    <Card className="overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3">
        <Link to={`/lin/perfil/${pub.perfil?.slug}`} className="flex items-center gap-2.5 hover:opacity-80">
          <Avatar className="h-9 w-9">
            <AvatarImage src={pub.perfil?.avatar_url || ""} className="object-cover" />
            <AvatarFallback className="text-xs">{initials(pub.perfil?.nombre)}</AvatarFallback>
          </Avatar>
          <div className="leading-tight">
            <div className="flex items-center gap-1 text-sm font-semibold">
              {pub.perfil?.nombre}
              {pub.perfil?.verificado && <BadgeCheck className="h-3.5 w-3.5 text-primary" />}
            </div>
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span>{timeAgo(pub.created_at)}</span>
              {pub.barrio?.nombre && (
                <>
                  <span>·</span>
                  <span className="flex items-center gap-0.5"><MapPin className="h-3 w-3" />{pub.barrio.nombre}</span>
                </>
              )}
            </div>
          </div>
        </Link>
        <Button variant="ghost" size="icon" className="h-8 w-8">
          <MoreHorizontal className="h-4 w-4" />
        </Button>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap items-center gap-1.5 px-4 pb-2">
        <Badge variant="secondary" className="gap-1">
          <span>{tipoMeta.emoji}</span>{tipoMeta.label}
        </Badge>
        {pub.tipo_operacion && <Badge variant="outline">{TIPO_OPERACION[pub.tipo_operacion]}</Badge>}
        {pub.tipo_propiedad && <Badge variant="outline">{TIPO_PROPIEDAD[pub.tipo_propiedad]}</Badge>}
        {pub.perfil?.tipo === "dueno_directo" && (
          <Badge className="bg-primary/10 text-primary hover:bg-primary/20">Dueño directo</Badge>
        )}
      </div>

      {/* Title + price */}
      <div className="px-4 pb-3">
        <Link to={`/lin/publicacion/${pub.id}`}>
          <h3 className="text-base font-semibold leading-tight hover:text-primary">{pub.titulo}</h3>
        </Link>
        {pub.precio != null && (
          <p className="mt-1 text-xl font-bold text-foreground">
            {formatPrecio(pub.precio, pub.moneda)}
            {pub.precio_negociable && <span className="ml-2 text-xs font-normal text-muted-foreground">Negociable</span>}
          </p>
        )}
      </div>

      {/* Image */}
      <Link to={`/lin/publicacion/${pub.id}`} className="block">
        <div className="aspect-[4/3] overflow-hidden bg-muted sm:aspect-[16/10]">
          <img src={portada} alt={pub.titulo} loading="lazy" className="h-full w-full object-cover transition-transform hover:scale-[1.02]" />
        </div>
      </Link>

      {/* Property meta strip */}
      {showPropertyMeta && (pub.ambientes || pub.dormitorios || pub.superficie_total || pub.hectareas) && (
        <div className="flex flex-wrap items-center gap-3 border-b px-4 py-2 text-xs text-muted-foreground">
          {pub.ambientes && <span>🏠 {pub.ambientes} amb</span>}
          {pub.dormitorios && <span>🛏 {pub.dormitorios} dorm</span>}
          {pub.banos && <span>🚿 {pub.banos} baño</span>}
          {pub.cochera && <span>🚗 cochera</span>}
          {pub.superficie_total && <span>📐 {pub.superficie_total} m²</span>}
          {pub.hectareas && <span>🌾 {pub.hectareas} ha</span>}
        </div>
      )}

      {/* Description */}
      {pub.descripcion && (
        <p className="line-clamp-2 px-4 py-3 text-sm text-foreground/80">{pub.descripcion}</p>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between border-t px-2 py-1.5">
        <div className="flex items-center">
          <Button variant="ghost" size="sm" onClick={toggleLike} className={cn("gap-1.5", liked && "text-primary")}>
            <Heart className={cn("h-4 w-4", liked && "fill-current")} />
            <span className="text-xs">{counts.likes}</span>
          </Button>
          <Button variant="ghost" size="sm" asChild className="gap-1.5">
            <Link to={`/lin/publicacion/${pub.id}`}>
              <MessageCircle className="h-4 w-4" />
              <span className="text-xs">{counts.comentarios}</span>
            </Link>
          </Button>
          <Button variant="ghost" size="sm" onClick={toggleRepost} className={cn("gap-1.5", reposted && "text-[hsl(var(--teal-data))]")}>
            <Repeat2 className="h-4 w-4" />
            <span className="text-xs">{counts.repostes}</span>
          </Button>
          <Button variant="ghost" size="sm" onClick={compartir} className="gap-1.5">
            <Share2 className="h-4 w-4" />
          </Button>
        </div>
        <div className="flex items-center gap-2 pr-2">
          <span className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3" />{pub.vistas || 0}</span>
          <Button variant="ghost" size="icon" className="h-8 w-8" onClick={toggleFav}>
            <Bookmark className={cn("h-4 w-4", favorito && "fill-current text-primary")} />
          </Button>
        </div>
      </div>
    </Card>
  );
}
