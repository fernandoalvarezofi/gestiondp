import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Globe, Instagram, Facebook, Phone, BadgeCheck, MessageCircleMore, Settings, MapPin, Plus } from "lucide-react";
import { PostCard } from "@/components/lin/PostCard";
import { TIPO_USUARIO, initials, getFallbackImage } from "@/lib/linquenoHelpers";
import { toast } from "sonner";

export default function LinPerfil() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [perfil, setPerfil] = useState<any>(null);
  const [pubs, setPubs] = useState<any[]>([]);
  const [siguiendo, setSiguiendo] = useState(false);
  const [tab, setTab] = useState("publicaciones");

  useEffect(() => {
    (async () => {
      let target = slug;
      if (!target && user) {
        const { data: me } = await (supabase as any).from("perfiles").select("slug").eq("id", user.id).single();
        target = me?.slug;
      }
      if (!target) return;

      const { data: p } = await (supabase as any).from("perfiles").select("*").eq("slug", target).single();
      setPerfil(p);
      if (!p) return;

      const { data: posts } = await (supabase as any)
        .from("publicaciones")
        .select(`id,tipo,titulo,descripcion,tipo_operacion,tipo_propiedad,precio,moneda,precio_negociable,
          ambientes,dormitorios,banos,cochera,superficie_total,hectareas,
          vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,referencia,
          perfil:perfiles!perfil_id(id,nombre,slug,avatar_url,tipo,verificado,whatsapp),
          barrio:barrios!barrio_id(nombre,zona),
          media:media_publicacion(url,es_portada,orden)`)
        .eq("perfil_id", p.id)
        .eq("estado", "activa")
        .order("created_at", { ascending: false });
      setPubs(posts || []);

      if (user && user.id !== p.id) {
        const { data: s } = await (supabase as any).from("seguidos")
          .select("id").eq("seguidor_id", user.id).eq("seguido_id", p.id).maybeSingle();
        setSiguiendo(!!s);
      }
    })();
  }, [slug, user]);

  const toggleSeguir = async () => {
    if (!user || !perfil) return toast.error("Iniciá sesión");
    if (siguiendo) {
      await (supabase as any).from("seguidos").delete().eq("seguidor_id", user.id).eq("seguido_id", perfil.id);
      setSiguiendo(false);
      setPerfil({ ...perfil, total_seguidores: perfil.total_seguidores - 1 });
    } else {
      await (supabase as any).from("seguidos").insert({ seguidor_id: user.id, seguido_id: perfil.id });
      setSiguiendo(true);
      setPerfil({ ...perfil, total_seguidores: perfil.total_seguidores + 1 });
      toast.success(`Ahora seguís a ${perfil.nombre}`);
    }
  };

  const abrirChat = async () => {
    if (!user || !perfil) return toast.error("Iniciá sesión");
    const { data } = await (supabase as any).rpc("get_or_create_conversacion", { user_a: user.id, user_b: perfil.id });
    navigate(`/lin/mensajes/${data}`);
  };

  if (!perfil) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  const isMine = user?.id === perfil.id;
  const wa = perfil.whatsapp ? `https://wa.me/${String(perfil.whatsapp).replace(/\D/g, "")}` : null;

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {/* Portada + avatar */}
      <div className="overflow-hidden rounded-2xl">
        <div
          className="h-40 w-full bg-gradient-to-br from-primary/20 to-secondary"
          style={perfil.portada_url ? { backgroundImage: `url(${perfil.portada_url})`, backgroundSize: "cover", backgroundPosition: "center" } : undefined}
        />
        <div className="relative bg-card px-5 pb-5 pt-0">
          <Avatar className="-mt-10 h-20 w-20 border-4 border-card">
            <AvatarImage src={perfil.avatar_url || ""} className="object-cover" />
            <AvatarFallback className="text-xl">{initials(perfil.nombre)}</AvatarFallback>
          </Avatar>

          <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
            <div>
              <div className="flex items-center gap-1.5">
                <h1 className="text-2xl font-bold tracking-tight">{perfil.nombre}</h1>
                {perfil.verificado && <BadgeCheck className="h-5 w-5 text-primary" />}
              </div>
              <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="outline">{TIPO_USUARIO[perfil.tipo]}</Badge>
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> Lincoln</span>
              </div>
            </div>

            <div className="flex gap-2">
              {isMine ? (
                <Button asChild variant="outline" size="sm">
                  <Link to="/lin/perfil/editar"><Settings className="h-4 w-4" /> Editar</Link>
                </Button>
              ) : (
                <>
                  <Button onClick={toggleSeguir} variant={siguiendo ? "outline" : "default"} size="sm">
                    {siguiendo ? "Siguiendo" : <><Plus className="h-4 w-4" />Seguir</>}
                  </Button>
                  <Button onClick={abrirChat} variant="outline" size="sm">
                    <MessageCircleMore className="h-4 w-4" /> Mensaje
                  </Button>
                </>
              )}
            </div>
          </div>

          {perfil.descripcion && <p className="mt-3 text-sm leading-relaxed">{perfil.descripcion}</p>}

          <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            {perfil.sitio_web && <a href={perfil.sitio_web} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><Globe className="h-3 w-3" />Sitio</a>}
            {perfil.instagram && <a href={`https://instagram.com/${perfil.instagram}`} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><Instagram className="h-3 w-3" />@{perfil.instagram}</a>}
            {perfil.facebook && <a href={perfil.facebook} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><Facebook className="h-3 w-3" />Facebook</a>}
            {perfil.mostrar_telefono && perfil.telefono && <span className="flex items-center gap-1"><Phone className="h-3 w-3" />{perfil.telefono}</span>}
            {wa && <a href={wa} target="_blank" rel="noreferrer" className="flex items-center gap-1 hover:text-primary"><MessageCircleMore className="h-3 w-3" />WhatsApp</a>}
          </div>

          <div className="mt-4 flex gap-5 border-t pt-3 text-sm">
            <Stat n={perfil.total_publicaciones} label="Publicaciones" />
            <Stat n={perfil.total_seguidores} label="Seguidores" />
            <Stat n={perfil.total_siguiendo} label="Siguiendo" />
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="publicaciones">Publicaciones ({pubs.length})</TabsTrigger>
          <TabsTrigger value="grilla">Grilla</TabsTrigger>
        </TabsList>
        <TabsContent value="publicaciones" className="mt-4 space-y-4">
          {pubs.length === 0 ? (
            <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">Aún no tiene publicaciones.</CardContent></Card>
          ) : pubs.map((p) => <PostCard key={p.id} pub={p} />)}
        </TabsContent>
        <TabsContent value="grilla" className="mt-4">
          <div className="grid grid-cols-3 gap-1">
            {pubs.map((p) => {
              const img = p.media?.find((m: any) => m.es_portada)?.url || p.media?.[0]?.url || getFallbackImage(p.tipo, p.tipo_propiedad);
              return (
                <Link key={p.id} to={`/lin/publicacion/${p.id}`} className="aspect-square overflow-hidden bg-muted">
                  <img src={img} alt={p.titulo} className="h-full w-full object-cover transition-transform hover:scale-105" />
                </Link>
              );
            })}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function Stat({ n, label }: { n: number; label: string }) {
  return (
    <div>
      <span className="font-semibold">{n}</span>{" "}
      <span className="text-muted-foreground">{label}</span>
    </div>
  );
}
