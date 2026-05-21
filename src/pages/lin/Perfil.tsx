import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Globe, Instagram, Twitter, Linkedin, Youtube, BadgeCheck, MessageCircleMore, Settings, MapPin, Star, UserPlus, UserCheck, Loader2 } from "lucide-react";
import { PostCard } from "@/components/lin/PostCard";
import { TIPO_USUARIO, initials } from "@/lib/worefHelpers";
import { toast } from "sonner";

const SELECT = `id,tipo,formato,titulo,cuerpo,imagen_url,video_url,tags,
  vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url,tipo,verificado),
  media:media_publicacion(url,es_portada,orden)`;

export default function Perfil() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<any>(null);
  const [pubs, setPubs] = useState<any[]>([]);
  const [resenas, setResenas] = useState<any[]>([]);
  const [siguiendo, setSiguiendo] = useState(false);
  const [loadingSeguir, setLoadingSeguir] = useState(false);
  const [tab, setTab] = useState("publicaciones");
  const [tieneHistoria, setTieneHistoria] = useState(false);

  useEffect(() => {
    (async () => {
      let target = slug;
      if (!target && user) {
        const { data: me } = await (supabase as any).from("perfiles").select("username").eq("id", user.id).single();
        target = me?.username;
      }
      if (!target) { navigate("/lin"); return; }
      const { data: p, error } = await (supabase as any)
        .from("perfiles").select("*").eq("username", target).single();
      if (error || !p) {
        toast.error("Perfil no encontrado");
        navigate("/lin");
        return;
      }
      setPerfil(p);

      const [{ data: posts }, { data: rs }, { data: hist }] = await Promise.all([
        (supabase as any).from("publicaciones").select(SELECT).eq("perfil_id", p.id).eq("estado", "activa").order("created_at", { ascending: false }),
        (supabase as any).from("resenas").select("*, autor:perfiles!autor_id(nombre,username,avatar_url)").eq("perfil_id", p.id).order("created_at", { ascending: false }),
        (supabase as any).from("historias").select("id").eq("perfil_id", p.id).gt("expira_at", new Date().toISOString()).limit(1),
      ]);
      setPubs(posts || []);
      setResenas(rs || []);
      setTieneHistoria((hist || []).length > 0);

      if (user && user.id !== p.id) {
        const { data: s } = await (supabase as any).from("seguidos").select("id").eq("seguidor_id", user.id).eq("seguido_id", p.id).maybeSingle();
        setSiguiendo(!!s);
      }
    })();
  }, [slug, user]);

  // Realtime: refresh perfil stats on seguidos changes
  useEffect(() => {
    if (!perfil?.id) return;
    const refrescarStats = async () => {
      const { data } = await (supabase as any).from("perfiles")
        .select("total_seguidores,total_siguiendo,total_publicaciones,score").eq("id", perfil.id).single();
      if (data) setPerfil((p: any) => p ? { ...p, ...data } : p);
    };
    const ch = (supabase as any).channel(`perfil-stats-${perfil.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "seguidos", filter: `seguido_id=eq.${perfil.id}` }, refrescarStats)
      .on("postgres_changes", { event: "*", schema: "public", table: "seguidos", filter: `seguidor_id=eq.${perfil.id}` }, refrescarStats)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [perfil?.id]);

  const toggleSeguir = async () => {
    if (!user || !perfil || loadingSeguir) return;
    if (!user) return toast.error("Iniciá sesión");
    setLoadingSeguir(true);
    try {
      if (siguiendo) {
        await (supabase as any).from("seguidos").delete().eq("seguidor_id", user.id).eq("seguido_id", perfil.id);
        setSiguiendo(false);
      } else {
        await (supabase as any).from("seguidos").insert({ seguidor_id: user.id, seguido_id: perfil.id });
        setSiguiendo(true);
        toast.success(`Ahora seguís a ${perfil.nombre}`);
      }
    } finally { setLoadingSeguir(false); }
  };

  const abrirChat = async () => {
    if (!user || !perfil) return toast.error("Iniciá sesión");
    const { data } = await (supabase as any).rpc("get_or_create_conversacion", { user_a: user.id, user_b: perfil.id });
    navigate(`/lin/mensajes/${data}`);
  };

  if (!perfil) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const isMine = user?.id === perfil.id;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="overflow-hidden rounded-2xl">
        <div className="h-40 w-full bg-gradient-to-br from-primary/20 to-secondary"
          style={perfil.portada_url ? { backgroundImage: `url(${perfil.portada_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined} />
        <div className="relative bg-card px-5 pb-5 pt-0">
          {tieneHistoria ? (
            <button onClick={() => navigate(`/lin/historias/${perfil.id}`)} className="-mt-10 inline-block rounded-full bg-gradient-to-tr from-primary via-pink-500 to-amber-400 p-[3px]">
              <div className="rounded-full bg-card p-[2px]">
                <Avatar className="h-20 w-20">
                  <AvatarImage src={perfil.avatar_url || ""} className="object-cover" />
                  <AvatarFallback className="text-xl">{initials(perfil.nombre)}</AvatarFallback>
                </Avatar>
              </div>
            </button>
          ) : (
            <Avatar className="-mt-10 h-20 w-20 border-4 border-card">
              <AvatarImage src={perfil.avatar_url || ""} className="object-cover" />
              <AvatarFallback className="text-xl">{initials(perfil.nombre)}</AvatarFallback>
            </Avatar>
          )}

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-2xl font-bold tracking-tight">{perfil.nombre}</h1>
                {perfil.verificado && <BadgeCheck className="h-5 w-5 text-primary" />}
              </div>
              <p className="text-sm text-muted-foreground">@{perfil.username}</p>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{TIPO_USUARIO[perfil.tipo]}</Badge>
                {perfil.industria && <Badge variant="outline">{perfil.industria}</Badge>}
                {perfil.ubicacion && perfil.mostrar_ubicacion && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />{perfil.ubicacion}</span>}
              </div>
            </div>
            <div className="flex gap-2">
              {isMine ? (
                <Button asChild variant="outline" size="sm"><Link to="/lin/perfil/editar"><Settings className="h-4 w-4" />Editar</Link></Button>
              ) : (
                <>
                  <Button onClick={toggleSeguir} variant={siguiendo ? "outline" : "default"} size="sm">
                    {siguiendo ? "Siguiendo" : <><Plus className="h-4 w-4" />Seguir</>}
                  </Button>
                  <Button onClick={abrirChat} variant="outline" size="sm"><MessageCircleMore className="h-4 w-4" />Mensaje</Button>
                </>
              )}
            </div>
          </div>

          {perfil.bio && <p className="mt-3 text-sm leading-relaxed">{perfil.bio}</p>}
          {perfil.actualmente && <p className="mt-2 text-sm"><span className="font-semibold">Actualmente:</span> {perfil.actualmente}</p>}

          {(perfil.que_ofrece || perfil.que_busca) && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {perfil.que_ofrece && <div className="rounded-md border bg-secondary/40 p-3 text-xs"><p className="font-semibold mb-1">Ofrece</p><p>{perfil.que_ofrece}</p></div>}
              {perfil.que_busca && <div className="rounded-md border bg-secondary/40 p-3 text-xs"><p className="font-semibold mb-1">Busca</p><p>{perfil.que_busca}</p></div>}
            </div>
          )}

          {perfil.skills?.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1">
              {perfil.skills.map((s: string) => <Badge key={s} variant="secondary" className="text-xs">{s}</Badge>)}
            </div>
          )}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {perfil.sitio_web && <a href={perfil.sitio_web} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><Globe className="h-3 w-3" />Sitio</a>}
            {perfil.instagram && <a href={`https://instagram.com/${perfil.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><Instagram className="h-3 w-3" />@{perfil.instagram}</a>}
            {perfil.twitter && <a href={`https://twitter.com/${perfil.twitter}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><Twitter className="h-3 w-3" />@{perfil.twitter}</a>}
            {perfil.linkedin && <a href={perfil.linkedin} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><Linkedin className="h-3 w-3" />LinkedIn</a>}
            {perfil.youtube && <a href={perfil.youtube} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><Youtube className="h-3 w-3" />YouTube</a>}
          </div>

          <div className="mt-4 flex gap-5 border-t pt-3 text-sm">
            <Stat n={perfil.total_publicaciones} label="Publicaciones" />
            <Stat n={perfil.total_seguidores} label="Seguidores" />
            <Stat n={perfil.total_siguiendo} label="Siguiendo" />
            <Stat n={perfil.score} label="Score" />
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="publicaciones">Publicaciones ({pubs.length})</TabsTrigger>
          <TabsTrigger value="resenas">Reseñas ({resenas.length})</TabsTrigger>
        </TabsList>
        <TabsContent value="publicaciones" className="mt-4 space-y-4">
          {pubs.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aún no tiene publicaciones.</CardContent></Card>
            : pubs.map((p) => <PostCard key={p.id} pub={p} />)}
        </TabsContent>
        <TabsContent value="resenas" className="mt-4 space-y-3">
          {resenas.length === 0 ? <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Sin reseñas aún.</CardContent></Card>
            : resenas.map((r) => (
              <Card key={r.id}><CardContent className="p-4 space-y-2">
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
      </Tabs>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return <div><span className="font-semibold">{n}</span> <span className="text-muted-foreground">{label}</span></div>;
}
