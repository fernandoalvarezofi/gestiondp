import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { ArrowLeft, MapPin, BadgeCheck, MessageCircleMore, Eye, Heart, Send } from "lucide-react";
import {
  TIPO_PUBLICACION, TIPO_OPERACION, TIPO_PROPIEDAD, formatPrecio, timeAgo, initials, getFallbackImage
} from "@/lib/linquenoHelpers";
import { toast } from "sonner";

export default function LinPublicacionDetalle() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [pub, setPub] = useState<any>(null);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [imgIdx, setImgIdx] = useState(0);

  useEffect(() => {
    if (!id) return;
    (async () => {
      await (supabase as any).rpc("registrar_vista", { p_publicacion_id: id });
      const { data } = await (supabase as any)
        .from("publicaciones")
        .select(`*,
          perfil:perfiles!perfil_id(id,nombre,slug,avatar_url,tipo,verificado,whatsapp,telefono,mostrar_telefono),
          barrio:barrios!barrio_id(nombre,zona),
          media:media_publicacion(url,tipo,es_portada,orden)
        `)
        .eq("id", id).single();
      setPub(data);
      cargarComentarios();
    })();
  }, [id]);

  const cargarComentarios = async () => {
    const { data } = await (supabase as any)
      .from("comentarios")
      .select("id,contenido,created_at,perfil:perfiles!perfil_id(nombre,slug,avatar_url)")
      .eq("publicacion_id", id)
      .order("created_at", { ascending: true });
    setComentarios(data || []);
  };

  const enviarComentario = async () => {
    if (!user) return toast.error("Iniciá sesión para comentar");
    if (!nuevo.trim()) return;
    setEnviando(true);
    const { error } = await (supabase as any).from("comentarios").insert({
      publicacion_id: id,
      perfil_id: user.id,
      contenido: nuevo.trim(),
    });
    setEnviando(false);
    if (error) return toast.error(error.message);
    setNuevo("");
    cargarComentarios();
  };

  const enviarConsulta = async () => {
    if (!user) return toast.error("Iniciá sesión");
    const mensaje = prompt("Mensaje al publicante:");
    if (!mensaje?.trim()) return;
    const { error } = await (supabase as any).from("consultas").insert({
      publicacion_id: id,
      de_perfil_id: user.id,
      mensaje: mensaje.trim(),
    });
    if (error) return toast.error(error.message);
    toast.success("Consulta enviada");
  };

  const abrirChat = async () => {
    if (!user || !pub?.perfil?.id) return toast.error("Iniciá sesión");
    const { data } = await (supabase as any).rpc("get_or_create_conversacion", {
      user_a: user.id, user_b: pub.perfil.id,
    });
    navigate(`/lin/mensajes/${data}`);
  };

  if (!pub) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  const imgs = pub.media?.length ? pub.media : [{ url: getFallbackImage(pub.tipo, pub.tipo_propiedad), tipo: "imagen" }];
  const wa = pub.perfil?.whatsapp
    ? `https://wa.me/${String(pub.perfil.whatsapp).replace(/\D/g, "")}?text=${encodeURIComponent(`Hola, vi tu publicación "${pub.titulo}" en Linqueño.`)}`
    : null;

  return (
    <div className="mx-auto max-w-4xl space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-1.5">
        <ArrowLeft className="h-4 w-4" /> Volver
      </Button>

      <div className="grid gap-5 lg:grid-cols-[1fr_360px]">
        <div className="space-y-5">
          {/* Galería */}
          <div className="overflow-hidden rounded-2xl bg-muted">
            <div className="aspect-[4/3] sm:aspect-[16/10]">
              {imgs[imgIdx]?.tipo === "video" ? (
                <video src={imgs[imgIdx].url} controls className="h-full w-full object-cover" />
              ) : (
                <img src={imgs[imgIdx]?.url} alt={pub.titulo} className="h-full w-full object-cover" />
              )}
            </div>
            {imgs.length > 1 && (
              <div className="flex gap-1 overflow-x-auto p-2">
                {imgs.map((m: any, i: number) => (
                  <button
                    key={i}
                    onClick={() => setImgIdx(i)}
                    className={`h-14 w-14 shrink-0 overflow-hidden rounded-md border-2 ${imgIdx === i ? "border-primary" : "border-transparent"}`}
                  >
                    <img src={m.url} alt="" className="h-full w-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Info */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <div className="flex flex-wrap items-center gap-1.5">
                <Badge variant="secondary" className="gap-1">
                  <span>{TIPO_PUBLICACION[pub.tipo]?.emoji}</span>{TIPO_PUBLICACION[pub.tipo]?.label}
                </Badge>
                {pub.tipo_operacion && <Badge variant="outline">{TIPO_OPERACION[pub.tipo_operacion]}</Badge>}
                {pub.tipo_propiedad && <Badge variant="outline">{TIPO_PROPIEDAD[pub.tipo_propiedad]}</Badge>}
              </div>

              <div>
                <h1 className="text-2xl font-bold tracking-tight">{pub.titulo}</h1>
                {pub.precio != null && (
                  <p className="mt-1 text-3xl font-bold text-primary">
                    {formatPrecio(pub.precio, pub.moneda)}
                    {pub.precio_negociable && <span className="ml-2 text-sm font-normal text-muted-foreground">Negociable</span>}
                  </p>
                )}
                <div className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  {pub.barrio?.nombre || "Lincoln"}{pub.barrio?.zona ? ` · ${pub.barrio.zona}` : ""}
                  {pub.referencia && <span> · {pub.referencia}</span>}
                </div>
                <div className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Eye className="h-3 w-3" />{pub.vistas} vistas</span>
                  <span>·</span>
                  <span>{timeAgo(pub.created_at)}</span>
                </div>
              </div>

              {pub.descripcion && <p className="whitespace-pre-wrap text-sm leading-relaxed">{pub.descripcion}</p>}

              {(pub.tipo === "propiedad" || pub.tipo === "agro") && (
                <>
                  <Separator />
                  <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-3">
                    {pub.ambientes && <Spec label="Ambientes" v={pub.ambientes} />}
                    {pub.dormitorios && <Spec label="Dormitorios" v={pub.dormitorios} />}
                    {pub.banos && <Spec label="Baños" v={pub.banos} />}
                    {pub.superficie_total && <Spec label="Sup. total" v={`${pub.superficie_total} m²`} />}
                    {pub.superficie_cubierta && <Spec label="Sup. cubierta" v={`${pub.superficie_cubierta} m²`} />}
                    {pub.hectareas && <Spec label="Hectáreas" v={pub.hectareas} />}
                    <Spec label="Cochera" v={pub.cochera ? "Sí" : "No"} />
                    <Spec label="Gas natural" v={pub.gas_natural ? "Sí" : "No"} />
                    <Spec label="Agua corriente" v={pub.agua_corriente ? "Sí" : "No"} />
                  </div>
                </>
              )}

              {pub.tipo === "evento" && pub.fecha_evento && (
                <>
                  <Separator />
                  <div className="text-sm">
                    <p><span className="text-muted-foreground">📅 Fecha:</span> {new Date(pub.fecha_evento).toLocaleString("es-AR")}</p>
                    {pub.lugar_evento && <p><span className="text-muted-foreground">📍 Lugar:</span> {pub.lugar_evento}</p>}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Comentarios */}
          <Card>
            <CardContent className="space-y-4 p-5">
              <h2 className="text-base font-semibold">Comentarios ({comentarios.length})</h2>
              <div className="flex gap-2">
                <Textarea value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Dejá un comentario público..." rows={2} />
                <Button onClick={enviarComentario} disabled={enviando || !nuevo.trim()} size="icon">
                  <Send className="h-4 w-4" />
                </Button>
              </div>
              {comentarios.length === 0 ? (
                <p className="text-sm text-muted-foreground">Sé el primero en comentar.</p>
              ) : (
                <div className="space-y-3">
                  {comentarios.map((c) => (
                    <div key={c.id} className="flex gap-2.5">
                      <Avatar className="h-8 w-8">
                        <AvatarImage src={c.perfil?.avatar_url || ""} className="object-cover" />
                        <AvatarFallback className="text-[10px]">{initials(c.perfil?.nombre)}</AvatarFallback>
                      </Avatar>
                      <div className="flex-1 rounded-lg bg-secondary/50 p-2.5">
                        <div className="flex items-center justify-between">
                          <Link to={`/lin/perfil/${c.perfil?.slug}`} className="text-xs font-semibold hover:text-primary">
                            {c.perfil?.nombre}
                          </Link>
                          <span className="text-[10px] text-muted-foreground">{timeAgo(c.created_at)}</span>
                        </div>
                        <p className="mt-1 text-sm">{c.contenido}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Sidebar publicante */}
        <Card className="h-fit lg:sticky lg:top-4">
          <CardContent className="space-y-3 p-5">
            <Link to={`/lin/perfil/${pub.perfil?.slug}`} className="flex items-center gap-3 hover:opacity-80">
              <Avatar className="h-12 w-12">
                <AvatarImage src={pub.perfil?.avatar_url || ""} className="object-cover" />
                <AvatarFallback>{initials(pub.perfil?.nombre)}</AvatarFallback>
              </Avatar>
              <div>
                <div className="flex items-center gap-1 font-semibold">
                  {pub.perfil?.nombre}
                  {pub.perfil?.verificado && <BadgeCheck className="h-4 w-4 text-primary" />}
                </div>
                <p className="text-xs text-muted-foreground">{pub.perfil?.tipo === "dueno_directo" ? "Dueño directo" : pub.perfil?.tipo}</p>
              </div>
            </Link>

            <Separator />

            <div className="space-y-2">
              {wa && (
                <Button asChild className="w-full bg-[#25D366] text-white hover:bg-[#20bd5a]">
                  <a href={wa} target="_blank" rel="noreferrer"><MessageCircleMore className="h-4 w-4" /> WhatsApp</a>
                </Button>
              )}
              <Button variant="outline" className="w-full" onClick={abrirChat}>
                <MessageCircleMore className="h-4 w-4" /> Mensaje privado
              </Button>
              <Button variant="ghost" className="w-full" onClick={enviarConsulta}>
                Hacer una consulta
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function Spec({ label, v }: { label: string; v: any }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="font-medium">{v}</p>
    </div>
  );
}
