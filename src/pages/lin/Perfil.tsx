import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Globe, Instagram, Twitter, Linkedin, Youtube, BadgeCheck, MessageCircleMore, Settings, MapPin,
  UserPlus, UserCheck, Loader2, Camera, Grid3x3, Rows3, Play, Share2, MoreHorizontal,
  Calendar, Briefcase, Heart, Repeat2, Info,
} from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger, TooltipProvider } from "@/components/ui/tooltip";
import { PostCard } from "@/components/lin/PostCard";
import { LazyImage } from "@/components/lin/LazyImage";
import { TIPO_USUARIO, initials, formatNumber } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useConfirm } from "@/components/lin/ConfirmDialog";


const SELECT = `id,tipo,formato,titulo,cuerpo,imagen_url,video_url,tags,
  vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,encuesta_opciones,
  rol_buscado,modalidad,pais,estado,cuerpo_largo,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url,tipo,verificado),
  media:media_publicacion(url,es_portada,orden)`;

export default function Perfil() {
  const { slug } = useParams();
  const { user } = useAuth();
  const confirm = useConfirm();

  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<any>(null);
  const [pubs, setPubs] = useState<any[]>([]);
  const [resenas, setResenas] = useState<any[]>([]);
  const [likedPubs, setLikedPubs] = useState<any[]>([]);
  const [repostesPubs, setRepostesPubs] = useState<any[]>([]);
  const [siguiendo, setSiguiendo] = useState(false);
  const [loadingSeguir, setLoadingSeguir] = useState(false);
  const [tab, setTab] = useState("publicaciones");
  const [vista, setVista] = useState<"lista" | "grid">("grid");
  const [tieneHistoria, setTieneHistoria] = useState(false);

  useEffect(() => {
    (async () => {
      let target = slug;
      if (!target && user) {
        const { data: me } = await (supabase as any).from("perfiles").select("username").eq("id", user.id).single();
        target = me?.username;
      }
      if (!target) { navigate("/lin"); return; }
      const { data: p, error } = await (supabase as any).from("perfiles").select("*").eq("username", target).single();
      if (error || !p) { toast.error("Perfil no encontrado"); navigate("/lin"); return; }
      setPerfil(p);

      const [{ data: posts }, { data: rs }, { data: hist }, { data: likedData }, { data: repostesData }] = await Promise.all([
        (supabase as any).from("publicaciones").select(SELECT).eq("perfil_id", p.id).eq("estado", "activa").order("created_at", { ascending: false }),
        (supabase as any).from("resenas").select("*, autor:perfiles!autor_id(nombre,username,avatar_url)").eq("perfil_id", p.id).order("created_at", { ascending: false }),
        (supabase as any).from("historias").select("id").eq("perfil_id", p.id).gt("expira_at", new Date().toISOString()).limit(1),
        (supabase as any).from("likes").select(`publicacion:publicaciones!publicacion_id(${SELECT})`).eq("perfil_id", p.id).order("created_at", { ascending: false }).limit(50),
        (supabase as any).from("repostes").select(`publicacion:publicaciones!publicacion_id(${SELECT})`).eq("perfil_id", p.id).order("created_at", { ascending: false }).limit(50),
      ]);
      setPubs(posts || []);
      setResenas(rs || []);
      setLikedPubs((likedData || []).map((l: any) => l.publicacion).filter(Boolean));
      setRepostesPubs((repostesData || []).map((r: any) => r.publicacion).filter(Boolean));
      setTieneHistoria((hist || []).length > 0);

      if (user && user.id !== p.id) {
        const { data: s } = await (supabase as any).from("seguidos").select("id").eq("seguidor_id", user.id).eq("seguido_id", p.id).maybeSingle();
        setSiguiendo(!!s);
      }
    })();
  }, [slug, user]);

  useEffect(() => {
    if (!perfil?.id) return;
    const refrescarStats = async () => {
      const { data } = await (supabase as any).from("perfiles")
        .select("total_seguidores,total_siguiendo,total_publicaciones,score").eq("id", perfil.id).single();
      if (data) setPerfil((p: any) => p ? { ...p, ...data } : p);
    };
    const refrescarPubs = async () => {
      const { data } = await (supabase as any).from("publicaciones").select(SELECT)
        .eq("perfil_id", perfil.id).eq("estado", "activa").order("created_at", { ascending: false });
      setPubs(data || []); refrescarStats();
    };
    const ch = (supabase as any).channel(`perfil-rt-${perfil.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "seguidos", filter: `seguido_id=eq.${perfil.id}` }, refrescarStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "seguidos", filter: `seguidor_id=eq.${perfil.id}` }, refrescarStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "publicaciones", filter: `perfil_id=eq.${perfil.id}` }, refrescarPubs)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [perfil?.id]);

  const toggleSeguir = async () => {
    if (!user || !perfil || loadingSeguir) return;
    setLoadingSeguir(true);
    try {
      if (siguiendo) {
        await (supabase as any).from("seguidos").delete().eq("seguidor_id", user.id).eq("seguido_id", perfil.id);
        setSiguiendo(false);
      } else {
        await (supabase as any).from("seguidos").insert({ seguidor_id: user.id, seguido_id: perfil.id });
        setSiguiendo(true); toast.success(`Ahora seguís a ${perfil.nombre}`);
      }
    } finally { setLoadingSeguir(false); }
  };

  const abrirChat = async () => {
    if (!user || !perfil) return toast.error("Iniciá sesión");
    const { data } = await (supabase as any).rpc("get_or_create_conversacion", { user_a: user.id, user_b: perfil.id });
    navigate(`/lin/mensajes/${data}`);
  };

  const compartirPerfil = async () => {
    const url = `${window.location.origin}/lin/perfil/${perfil.username}`;
    try {
      if (navigator.share) await navigator.share({ title: perfil.nombre, url });
      else { await navigator.clipboard.writeText(url); toast.success("Enlace copiado"); }
    } catch {}
  };

  const bloquear = async () => {
    if (!user || !perfil) return;
    const ok = await confirm({ title: `¿Bloquear a ${perfil.nombre}?`, description: "No verán tu perfil ni podrán contactarte.", confirmText: "Bloquear", destructive: true });
    if (!ok) return;
    await (supabase as any).from("bloqueos").insert({ perfil_id: user.id, bloqueado_id: perfil.id });
    toast.success("Usuario bloqueado");
  };


  const reels = pubs.filter((p) => p.video_url);
  const articulos = pubs.filter((p) => p.tipo === "contenido_largo" || p.formato === "articulo");
  const conMedia = pubs.filter((p) => p.imagen_url || p.video_url);

  if (!perfil) return (
    <div className="mx-auto max-w-4xl space-y-3">
      <div className="h-56 animate-pulse rounded-2xl bg-secondary" />
      <div className="h-32 animate-pulse rounded-2xl bg-secondary" />
    </div>
  );
  const isMine = user?.id === perfil.id;
  const fechaUnion = new Date(perfil.created_at).toLocaleDateString("es-AR", { month: "long", year: "numeric" });

  return (
    <div className="mx-auto max-w-4xl">
      {/* PORTADA */}
      <div className="relative overflow-hidden rounded-b-2xl">
        <div className="relative h-44 w-full bg-gradient-to-br from-primary/30 via-amber-400/20 to-secondary sm:h-60"
          style={perfil.portada_url ? { backgroundImage: `url(${perfil.portada_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}>
          <div className="absolute inset-0 bg-gradient-to-t from-background/40 to-transparent" />
          {isMine && (
            <Button onClick={() => navigate("/lin/perfil/editar")} variant="secondary" size="sm"
              className="absolute right-3 top-3 h-8 gap-1.5 rounded-full bg-background/85 backdrop-blur hover:bg-background">
              <Camera className="h-3.5 w-3.5" />Cambiar portada
            </Button>
          )}
        </div>
      </div>

      {/* IDENTIDAD */}
      <div className="px-4 sm:px-6">
        <div className="-mt-14 flex items-end justify-between sm:-mt-16">
          {tieneHistoria ? (
            <button onClick={() => navigate(`/lin/historias/${perfil.id}`)} className="rounded-full bg-gradient-to-tr from-primary via-pink-500 to-amber-400 p-[3px]">
              <div className="rounded-full bg-background p-[3px]">
                <Avatar className="h-24 w-24 sm:h-28 sm:w-28">
                  <AvatarImage src={perfil.avatar_url || ""} className="object-cover" />
                  <AvatarFallback className="text-2xl">{initials(perfil.nombre)}</AvatarFallback>
                </Avatar>
              </div>
            </button>
          ) : (
            <div className="relative">
              <Avatar className="h-24 w-24 ring-4 ring-background sm:h-28 sm:w-28">
                <AvatarImage src={perfil.avatar_url || ""} className="object-cover" />
                <AvatarFallback className="text-2xl">{initials(perfil.nombre)}</AvatarFallback>
              </Avatar>
              {isMine && (
                <button onClick={() => navigate("/lin/perfil/editar")}
                  className="absolute bottom-1 right-1 rounded-full bg-primary p-1.5 text-primary-foreground shadow-ember">
                  <Camera className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          )}

          <div className="flex gap-1.5 pb-2">
            {isMine ? (
              <>
                <Button variant="outline" size="sm" onClick={() => navigate("/lin/perfil/editar")}><Settings className="h-4 w-4" />Editar perfil</Button>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={compartirPerfil}><Share2 className="h-4 w-4" /></Button>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={() => navigate("/lin/configuracion")}><Settings className="h-4 w-4" /></Button>
              </>
            ) : (
              <>
                <Button onClick={toggleSeguir} disabled={loadingSeguir} variant={siguiendo ? "outline" : "default"} size="sm" className={cn(!siguiendo && "shadow-ember")}>
                  {loadingSeguir ? <Loader2 className="h-4 w-4 animate-spin" /> : siguiendo ? <><UserCheck className="h-4 w-4" />Siguiendo</> : <><UserPlus className="h-4 w-4" />Seguir</>}
                </Button>
                <Button onClick={abrirChat} variant="outline" size="sm"><MessageCircleMore className="h-4 w-4" />Mensaje</Button>
                <Button variant="outline" size="icon" className="h-9 w-9" onClick={compartirPerfil}><Share2 className="h-4 w-4" /></Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="icon" className="h-9 w-9"><MoreHorizontal className="h-4 w-4" /></Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => toast.success("Reporte enviado")}>Reportar</DropdownMenuItem>
                    <DropdownMenuItem className="text-destructive" onClick={bloquear}>Bloquear</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            )}
          </div>
        </div>

        <div className="mt-3">
          <div className="flex items-center gap-1.5">
            <h1 className="font-display text-2xl font-bold tracking-tight sm:text-3xl">{perfil.nombre}</h1>
            {perfil.verificado && <BadgeCheck className="h-5 w-5 text-primary" />}
          </div>
          <p className="text-sm text-muted-foreground">@{perfil.username}</p>
          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
            <Badge variant="outline" className="rounded-full font-medium">{TIPO_USUARIO[perfil.tipo]}</Badge>
            {perfil.industria && <span className="inline-flex items-center gap-1"><Briefcase className="h-3 w-3" />{perfil.industria}</span>}
            {perfil.ubicacion && perfil.mostrar_ubicacion && <span className="inline-flex items-center gap-1"><MapPin className="h-3 w-3" />{perfil.ubicacion}</span>}
            <span className="inline-flex items-center gap-1"><Calendar className="h-3 w-3" />Se unió en {fechaUnion}</span>
          </div>

          {perfil.bio && <p className="mt-3 max-w-2xl whitespace-pre-wrap text-[15px] leading-relaxed">{perfil.bio}</p>}
          {perfil.actualmente && (
            <p className="mt-2 text-sm">
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary">● Actualmente</span>
              <span className="ml-2">{perfil.actualmente}</span>
            </p>
          )}

          {(perfil.que_ofrece || perfil.que_busca) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {perfil.que_ofrece && <div className="rounded-xl border bg-secondary/40 p-3 text-xs"><p className="font-semibold uppercase tracking-wider text-muted-foreground mb-1">Ofrece</p><p>{perfil.que_ofrece}</p></div>}
              {perfil.que_busca && <div className="rounded-xl border bg-secondary/40 p-3 text-xs"><p className="font-semibold uppercase tracking-wider text-muted-foreground mb-1">Busca</p><p>{perfil.que_busca}</p></div>}
            </div>
          )}

          {perfil.skills?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {perfil.skills.map((s: string) => <Badge key={s} variant="secondary" className="rounded-full text-xs font-medium">{s}</Badge>)}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {perfil.sitio_web && <a href={perfil.sitio_web} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary"><Globe className="h-3 w-3" />Sitio</a>}
            {perfil.instagram && <a href={`https://instagram.com/${perfil.instagram}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary"><Instagram className="h-3 w-3" />@{perfil.instagram}</a>}
            {perfil.twitter && <a href={`https://twitter.com/${perfil.twitter}`} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary"><Twitter className="h-3 w-3" />@{perfil.twitter}</a>}
            {perfil.linkedin && <a href={perfil.linkedin} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary"><Linkedin className="h-3 w-3" />LinkedIn</a>}
            {perfil.youtube && <a href={perfil.youtube} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 hover:text-primary"><Youtube className="h-3 w-3" />YouTube</a>}
          </div>

          <div className="mt-4 grid grid-cols-4 divide-x rounded-2xl border bg-card">
            <StatCell n={perfil.total_publicaciones} label="Posts" />
            <StatCell n={perfil.total_seguidores} label="Seguidores" to={`/lin/perfil/${perfil.username}/red?tab=seguidores`} />
            <StatCell n={perfil.total_siguiendo} label="Siguiendo" to={`/lin/perfil/${perfil.username}/red?tab=siguiendo`} />
            <StatCell n={perfil.score} label="Score" tooltip="El score refleja tu actividad en Woref: publicaciones, seguidores, likes y comentarios." />
          </div>
        </div>

        {/* TABS */}
        <Tabs value={tab} onValueChange={setTab} className="mt-5">
          <div className="flex items-center justify-between border-b">
            <TabsList className="h-auto justify-start gap-0 rounded-none border-0 bg-transparent p-0">
              <TabTrigger value="publicaciones" icon={Grid3x3} label="Posts" count={pubs.length} active={tab === "publicaciones"} />
              <TabTrigger value="reels" icon={Play} label="Reels" count={reels.length} active={tab === "reels"} />
              <TabTrigger value="articulos" icon={FileText} label="Artículos" count={articulos.length} active={tab === "articulos"} />
              <TabTrigger value="resenas" icon={Star} label="Reseñas" count={resenas.length} active={tab === "resenas"} />
              {isMine && <TabTrigger value="likes" icon={Heart} label="Me gusta" count={likedPubs.length} active={tab === "likes"} />}
              {isMine && <TabTrigger value="repostes" icon={Repeat2} label="Repostes" count={repostesPubs.length} active={tab === "repostes"} />}
            </TabsList>
            {tab === "publicaciones" && (
              <div className="hidden gap-1 sm:flex">
                <button onClick={() => setVista("grid")} className={cn("rounded-md p-1.5", vista === "grid" ? "bg-secondary text-foreground" : "text-muted-foreground")}><Grid3x3 className="h-4 w-4" /></button>
                <button onClick={() => setVista("lista")} className={cn("rounded-md p-1.5", vista === "lista" ? "bg-secondary text-foreground" : "text-muted-foreground")}><Rows3 className="h-4 w-4" /></button>
              </div>
            )}
          </div>

          <TabsContent value="publicaciones" className="mt-4">
            {pubs.length === 0 ? <EmptyTab text="Aún no tiene publicaciones." />
              : vista === "grid" ? <PostGrid items={conMedia} navigate={navigate} /> : <div className="-mx-4 sm:-mx-6">{pubs.map((p) => <PostCard key={p.id} pub={p} />)}</div>}
          </TabsContent>
          <TabsContent value="reels" className="mt-4">
            {reels.length === 0 ? <EmptyTab text="Sin reels todavía." /> : <PostGrid items={reels} navigate={navigate} aspect="9/16" />}
          </TabsContent>
          <TabsContent value="articulos" className="mt-4 -mx-4 sm:-mx-6">
            {articulos.length === 0 ? <EmptyTab text="Sin artículos publicados." /> : articulos.map((p) => <PostCard key={p.id} pub={p} />)}
          </TabsContent>
          <TabsContent value="resenas" className="mt-4 space-y-3">
            {resenas.length === 0 ? <EmptyTab text="Sin reseñas aún." />
              : resenas.map((r) => (
                <Card key={r.id}><CardContent className="space-y-2 p-4">
                  <div className="flex items-center justify-between">
                    <Link to={`/lin/perfil/${r.autor.username}`} className="flex items-center gap-2">
                      <Avatar className="h-7 w-7"><AvatarImage src={r.autor.avatar_url || ""} /><AvatarFallback>{initials(r.autor.nombre)}</AvatarFallback></Avatar>
                      <span className="text-sm font-medium">{r.autor.nombre}</span>
                    </Link>
                    <div className="flex">{Array.from({ length: 5 }).map((_, i) => <Star key={i} className={`h-4 w-4 ${i < r.puntuacion ? "fill-amber-400 text-amber-400" : "text-muted"}`} />)}</div>
                  </div>
                  {r.comentario && <p className="text-sm">{r.comentario}</p>}
                </CardContent></Card>
              ))}
          </TabsContent>
          {isMine && (
            <TabsContent value="likes" className="mt-4 -mx-4 sm:-mx-6">
              {likedPubs.length === 0 ? <EmptyTab text="Aún no hay publicaciones con me gusta." /> : likedPubs.map((p) => <PostCard key={p.id} pub={p} />)}
            </TabsContent>
          )}
          {isMine && (
            <TabsContent value="repostes" className="mt-4 -mx-4 sm:-mx-6">
              {repostesPubs.length === 0 ? <EmptyTab text="Aún no reposteaste nada." /> : repostesPubs.map((p) => <PostCard key={p.id} pub={p} />)}
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  );
}

function StatCell({ n, label, to, tooltip }: { n: number; label: string; to?: string; tooltip?: string }) {
  const inner = (
    <div className={cn("flex flex-col items-center justify-center px-2 py-3 text-center", tooltip && "cursor-help")}>
      <span className="font-display text-xl font-bold">{formatNumber(n)}</span>
      <span className="inline-flex items-center gap-1 text-[11px] uppercase tracking-wider text-muted-foreground">
        {label}
        {tooltip && <Info className="h-3 w-3" />}
      </span>
    </div>
  );
  if (tooltip) {
    return (
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild><div>{inner}</div></TooltipTrigger>
          <TooltipContent className="max-w-[220px] text-xs">{tooltip}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }
  return to ? <Link to={to} className="transition-colors hover:bg-secondary/40">{inner}</Link> : inner;
}

function TabTrigger({ value, icon: Icon, label, count, active }: any) {
  return (
    <TabsTrigger value={value} className={cn(
      "relative h-11 gap-1.5 rounded-none border-b-2 border-transparent bg-transparent px-4 text-sm font-medium text-muted-foreground shadow-none transition-colors",
      "data-[state=active]:border-primary data-[state=active]:bg-transparent data-[state=active]:text-foreground data-[state=active]:shadow-none"
    )}>
      <Icon className="h-4 w-4" />
      <span className="hidden sm:inline">{label}</span>
      <span className="text-xs text-muted-foreground">{count}</span>
    </TabsTrigger>
  );
}

function PostGrid({ items, navigate, aspect = "1/1" }: { items: any[]; navigate: any; aspect?: string }) {
  return (
    <div className="grid grid-cols-3 gap-1 sm:gap-1.5">
      {items.map((p) => {
        const cover = p.media?.[0]?.url || p.imagen_url || p.thumbnail_url;
        return (
          <button key={p.id} onClick={() => navigate(`/lin/publicacion/${p.id}`)}
            className="group relative overflow-hidden rounded-md border bg-secondary/30" style={{ aspectRatio: aspect }}>
            {p.video_url ? (
              <video src={p.video_url} muted loop playsInline preload="metadata" className="h-full w-full object-cover" />
            ) : cover ? (
              <LazyImage src={cover} className="object-cover transition-transform duration-500 group-hover:scale-110" />
            ) : (
              <div className="flex h-full items-center justify-center p-3 text-center text-[11px] text-muted-foreground">
                {p.titulo || (p.cuerpo || "").slice(0, 80)}
              </div>
            )}
            {p.video_url && <Play className="absolute right-1.5 top-1.5 h-3.5 w-3.5 fill-white text-white drop-shadow" />}
            <div className="absolute inset-0 bg-black/0 opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
              <div className="absolute inset-0 flex items-center justify-center gap-3 text-sm font-semibold text-white">
                <span>♥ {formatNumber(p.total_likes)}</span>
                <span>💬 {formatNumber(p.total_comentarios)}</span>
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function EmptyTab({ text }: { text: string }) {
  return <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">{text}</CardContent></Card>;
}
