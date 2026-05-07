import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { MapPin, MessageCircleMore, BadgeCheck, Eye, ArrowLeft, Bed, Bath, Maximize2, Car, Flame, Droplet } from "lucide-react";
import { getFallbackImage, TIPO_OPERACION_LABEL, TIPO_PROPIEDAD_LABEL, TIPO_USUARIO_LABEL, formatPrecio } from "@/lib/inmoImages";
import { toast } from "sonner";

export default function InmoPublicacionDetalle() {
  const { id } = useParams();
  const { user } = useAuth();
  const [pub, setPub] = useState<any>(null);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [nuevoComentario, setNuevoComentario] = useState("");
  const [activeImg, setActiveImg] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data } = await (supabase as any)
        .from("publicaciones")
        .select(`
          *,
          perfil:perfiles_inmo!perfil_id(id,nombre,slug,avatar_url,tipo,verificado,whatsapp,descripcion),
          barrio:barrios!barrio_id(nombre,zona),
          imagenes:imagenes_publicacion(url,es_portada,orden)
        `)
        .eq("id", id)
        .single();
      setPub(data);
      await (supabase as any).rpc("incrementar_vistas", { p_publicacion_id: id });
      loadComentarios();
    })();
  }, [id]);

  const loadComentarios = async () => {
    const { data } = await (supabase as any)
      .from("comentarios")
      .select("id,contenido,created_at,perfil:perfiles_inmo!perfil_id(nombre,avatar_url,slug)")
      .eq("publicacion_id", id)
      .order("created_at", { ascending: true });
    setComentarios(data || []);
  };

  const enviarComentario = async () => {
    if (!user || !nuevoComentario.trim()) return;
    const { error } = await (supabase as any).from("comentarios").insert({
      publicacion_id: id, perfil_id: user.id, contenido: nuevoComentario.trim(),
    });
    if (error) return toast.error(error.message);
    setNuevoComentario("");
    loadComentarios();
  };

  if (!pub) return <p className="text-muted-foreground">Cargando...</p>;

  const imgs = pub.imagenes?.length ? pub.imagenes.sort((a: any, b: any) => a.orden - b.orden) : [{ url: getFallbackImage(pub.tipo_propiedad) }];
  const wa = pub.perfil?.whatsapp
    ? `https://wa.me/${String(pub.perfil.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, vi tu publicación "${pub.titulo}".`)}`
    : null;

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Button asChild variant="ghost" size="sm"><Link to="/inmo"><ArrowLeft className="h-4 w-4" /> Volver al feed</Link></Button>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <div className="aspect-[4/3] overflow-hidden rounded-2xl bg-muted">
            <img src={imgs[activeImg].url} alt={pub.titulo} className="h-full w-full object-cover" />
          </div>
          {imgs.length > 1 && (
            <div className="grid grid-cols-5 gap-2">
              {imgs.map((im: any, i: number) => (
                <button key={i} onClick={() => setActiveImg(i)}
                  className={`aspect-square overflow-hidden rounded-md border-2 ${i === activeImg ? "border-primary" : "border-transparent"}`}>
                  <img src={im.url} alt="" className="h-full w-full object-cover" />
                </button>
              ))}
            </div>
          )}

          <div className="space-y-3">
            <div className="flex flex-wrap gap-1.5">
              <Badge variant="secondary">{TIPO_OPERACION_LABEL[pub.tipo_operacion]}</Badge>
              <Badge variant="outline">{TIPO_PROPIEDAD_LABEL[pub.tipo_propiedad]}</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">{pub.titulo}</h1>
            <p className="text-3xl font-bold text-primary">{formatPrecio(pub.precio, pub.moneda)}</p>
            <div className="flex items-center gap-1.5 text-sm text-muted-foreground">
              <MapPin className="h-4 w-4" />
              {pub.barrio?.nombre || "Lincoln"}{pub.referencia ? ` · ${pub.referencia}` : ""}
            </div>
          </div>

          <Card>
            <CardContent className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              {pub.dormitorios != null && <Spec icon={Bed} label="Dorm." value={pub.dormitorios} />}
              {pub.banos != null && <Spec icon={Bath} label="Baños" value={pub.banos} />}
              {pub.superficie_total != null && <Spec icon={Maximize2} label="m² total" value={pub.superficie_total} />}
              {pub.cochera && <Spec icon={Car} label="Cochera" value="Sí" />}
              {pub.gas_natural && <Spec icon={Flame} label="Gas natural" value="Sí" />}
              {pub.agua_corriente && <Spec icon={Droplet} label="Agua" value="Sí" />}
              {pub.hectareas != null && <Spec icon={Maximize2} label="Hectáreas" value={pub.hectareas} />}
            </CardContent>
          </Card>

          {pub.descripcion && (
            <Card><CardContent className="p-5">
              <h3 className="mb-2 font-semibold">Descripción</h3>
              <p className="whitespace-pre-line text-sm leading-relaxed text-muted-foreground">{pub.descripcion}</p>
            </CardContent></Card>
          )}

          {/* Comentarios */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <h3 className="font-semibold">Comentarios de la comunidad ({comentarios.length})</h3>
              {user ? (
                <div className="space-y-2">
                  <Textarea value={nuevoComentario} onChange={(e) => setNuevoComentario(e.target.value)} placeholder="Hacé una pregunta o dejá un comentario..." rows={2} />
                  <Button size="sm" onClick={enviarComentario} disabled={!nuevoComentario.trim()}>Comentar</Button>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground"><Link to="/auth" className="text-primary underline">Iniciá sesión</Link> para comentar.</p>
              )}
              <div className="space-y-3">
                {comentarios.map((c) => (
                  <div key={c.id} className="flex gap-3 border-t pt-3">
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={c.perfil?.avatar_url || ""} className="object-cover" />
                      <AvatarFallback className="text-[10px]">{(c.perfil?.nombre || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1">
                      <Link to={`/inmo/perfil/${c.perfil?.slug}`} className="text-sm font-medium hover:text-primary">{c.perfil?.nombre}</Link>
                      <p className="text-sm text-muted-foreground">{c.contenido}</p>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sidebar publicante */}
        <div className="space-y-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={pub.perfil?.avatar_url || ""} className="object-cover" />
                  <AvatarFallback>{(pub.perfil?.nombre || "?").slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                <div>
                  <Link to={`/inmo/perfil/${pub.perfil?.slug}`} className="font-semibold hover:text-primary">{pub.perfil?.nombre}</Link>
                  <p className="text-xs text-muted-foreground">{TIPO_USUARIO_LABEL[pub.perfil?.tipo]}</p>
                </div>
              </div>
              {pub.perfil?.verificado && (
                <Badge className="gap-1 bg-[hsl(var(--teal-data))] text-white"><BadgeCheck className="h-3 w-3" /> Verificada</Badge>
              )}
              {pub.perfil?.descripcion && <p className="text-sm text-muted-foreground">{pub.perfil.descripcion}</p>}
              {wa && (
                <Button asChild className="w-full bg-[#25D366] text-white hover:bg-[#20bd5a]">
                  <a href={wa} target="_blank" rel="noreferrer"><MessageCircleMore className="h-4 w-4" /> Contactar por WhatsApp</a>
                </Button>
              )}
              <p className="flex items-center gap-1 text-xs text-muted-foreground"><Eye className="h-3 w-3" /> {pub.vistas} vistas</p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

function Spec({ icon: Icon, label, value }: any) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <Icon className="h-4 w-4 text-primary" />
      <div><div className="text-xs text-muted-foreground">{label}</div><div className="font-semibold">{value}</div></div>
    </div>
  );
}
