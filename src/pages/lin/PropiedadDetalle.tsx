import { useEffect, useState } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  ArrowLeft, Heart, MapPin, Bed, Bath, Car, Maximize, Ruler, Calendar, Building2,
  MessageCircle, ChevronRight, Box, Share2, Check, Eye, Pencil,
} from "lucide-react";
import { formatPrecio, formatM2, labelOperacion, labelTipo, labelEstado, ubicacionCorta } from "@/lib/inmobiliaria";
import { TourViewer } from "@/components/lin/TourViewer";
import { toast } from "sonner";

export default function PropiedadDetalle() {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [media, setMedia] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [fav, setFav] = useState(false);
  const [idx, setIdx] = useState(0);
  const [mensaje, setMensaje] = useState("");
  const [telefono, setTelefono] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviada, setEnviada] = useState(false);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    (async () => {
      setLoading(true);
      const { data: prop } = await (supabase as any)
        .from("propiedades")
        .select(`*, agente:perfiles!agente_id(id,nombre,username,avatar_url,verificado,bio,total_seguidores)`)
        .eq("slug", slug)
        .maybeSingle();
      if (!active) return;
      if (!prop) {
        setLoading(false);
        toast.error("Propiedad no encontrada");
        navigate("/lin/propiedades");
        return;
      }
      setP(prop);
      const { data: md } = await (supabase as any)
        .from("propiedad_media").select("*").eq("propiedad_id", prop.id).order("orden");
      if (!active) return;
      setMedia(md || []);
      setLoading(false);
      (supabase as any).rpc("registrar_vista_propiedad", { p_propiedad_id: prop.id }).then(() => {}, () => {});
      if (user) {
        const { data: f } = await (supabase as any)
          .from("propiedad_favoritos").select("id").eq("propiedad_id", prop.id).eq("perfil_id", user.id).maybeSingle();
        if (active) setFav(!!f);
      }
    })();
    return () => { active = false; };
  }, [slug, user, navigate]);

  const toggleFav = async () => {
    if (!user || !p) { navigate("/auth"); return; }
    if (fav) {
      await (supabase as any).from("propiedad_favoritos").delete().eq("propiedad_id", p.id).eq("perfil_id", user.id);
      setFav(false);
    } else {
      await (supabase as any).from("propiedad_favoritos").insert({ propiedad_id: p.id, perfil_id: user.id });
      setFav(true);
      toast.success("Guardada en tus propiedades");
    }
  };

  const enviarConsulta = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!mensaje.trim()) { toast.error("Escribí tu consulta"); return; }
    setEnviando(true);
    const { error } = await (supabase as any).from("propiedad_consultas").insert({
      propiedad_id: p.id, perfil_id: user.id, mensaje: mensaje.trim(), telefono: telefono.trim() || null,
    });
    setEnviando(false);
    if (error) { toast.error("No se pudo enviar la consulta"); return; }
    setEnviada(true);
    setMensaje("");
    toast.success("Consulta enviada al agente");
  };

  const compartir = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: p.titulo, url });
      else { await navigator.clipboard.writeText(url); toast.success("Link copiado"); }
    } catch { /* cancelado */ }
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-6">
        <Skeleton className="h-8 w-40" />
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_360px]">
          <Skeleton className="aspect-video w-full" />
          <Skeleton className="h-96 w-full" />
        </div>
      </div>
    );
  }
  if (!p) return null;

  const imagenes: string[] = [p.portada_url, ...media.filter((m) => m.tipo === "imagen").map((m) => m.url)].filter(Boolean);
  const cover = imagenes[idx] || p.portada_url;
  const esDueno = user?.id === p.agente_id;
  const ubic = ubicacionCorta(p);

  const ficha = [
    { icon: Bed, label: "Dormitorios", value: p.dormitorios },
    { icon: Bath, label: "Baños", value: p.banos },
    { icon: Building2, label: "Ambientes", value: p.ambientes },
    { icon: Car, label: "Cocheras", value: p.cocheras },
    { icon: Maximize, label: "Sup. total", value: formatM2(p.m2_totales) },
    { icon: Ruler, label: "Sup. cubierta", value: formatM2(p.m2_cubiertos) },
    { icon: Calendar, label: "Antigüedad", value: p.antiguedad != null ? `${p.antiguedad} años` : null },
  ].filter((f) => f.value !== null && f.value !== undefined && f.value !== "");

  return (
    <div className="mx-auto max-w-6xl px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="sm" className="gap-1.5">
          <Link to="/lin/propiedades"><ArrowLeft className="h-4 w-4" /> Volver a propiedades</Link>
        </Button>
        <div className="flex gap-2">
          {esDueno && (
            <Button asChild variant="outline" size="sm" className="gap-1.5">
              <Link to={`/lin/propiedades/nueva?id=${p.id}`}><Pencil className="h-4 w-4" /> Editar</Link>
            </Button>
          )}
          <Button variant="ghost" size="sm" onClick={compartir} className="gap-1.5">
            <Share2 className="h-4 w-4" /> Compartir
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-6 lg:grid-cols-[1fr_360px]">
        <div className="space-y-6">
          {/* GALERÍA / TOUR */}
          <Tabs defaultValue="fotos">
            <TabsList>
              <TabsTrigger value="fotos">Fotos ({imagenes.length})</TabsTrigger>
              <TabsTrigger value="tour" className="gap-1.5"><Box className="h-3.5 w-3.5" /> Tour 3D</TabsTrigger>
            </TabsList>
            <TabsContent value="fotos" className="mt-3">
              <div className="overflow-hidden rounded-2xl border bg-secondary/30">
                <div className="aspect-video">
                  {cover ? (
                    <img src={cover} alt={p.titulo} className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center text-muted-foreground/40"><Box className="h-14 w-14" /></div>
                  )}
                </div>
                {imagenes.length > 1 && (
                  <div className="flex gap-2 overflow-x-auto p-2">
                    {imagenes.map((g, i) => (
                      <button key={i} onClick={() => setIdx(i)} className={`shrink-0 overflow-hidden rounded-md border-2 ${i === idx ? "border-primary" : "border-transparent"}`}>
                        <img src={g} alt="" className="h-16 w-24 object-cover" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
            <TabsContent value="tour" className="mt-3">
              <TourViewer tourUrl={p.tour_url} estado={p.tour_estado} titulo={p.titulo} />
            </TabsContent>
          </Tabs>

          {/* HEADER */}
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge>{labelOperacion(p.operacion)}</Badge>
              <Badge variant="outline">{labelTipo(p.tipo)}</Badge>
              {p.estado !== "activa" && <Badge variant="secondary">{labelEstado(p.estado)}</Badge>}
              {p.tour_estado === "listo" && <Badge variant="secondary" className="gap-1"><Box className="h-3 w-3" /> Tour 3D</Badge>}
            </div>
            <h1 className="mt-3 text-2xl font-bold sm:text-3xl">{p.titulo}</h1>
            {ubic && (
              <p className="mt-2 flex items-center gap-1.5 text-sm text-muted-foreground">
                <MapPin className="h-4 w-4" /> {p.direccion ? `${p.direccion}, ` : ""}{ubic}
              </p>
            )}
            <p className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <Eye className="h-3.5 w-3.5" /> {p.total_vistas} vistas · {p.total_consultas} consultas
            </p>
          </div>

          {/* FICHA */}
          {ficha.length > 0 && (
            <Card>
              <CardContent className="grid grid-cols-2 gap-4 p-5 sm:grid-cols-4">
                {ficha.map((f) => (
                  <div key={f.label} className="flex items-center gap-2">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10">
                      <f.icon className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{f.value}</p>
                      <p className="truncate text-xs text-muted-foreground">{f.label}</p>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          {p.descripcion && (
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-3 font-semibold">Descripción</h2>
                <div className="whitespace-pre-wrap text-sm leading-relaxed text-foreground/90">{p.descripcion}</div>
              </CardContent>
            </Card>
          )}

          {p.amenities?.length > 0 && (
            <Card>
              <CardContent className="p-6">
                <h2 className="mb-3 font-semibold">Amenities y características</h2>
                <div className="flex flex-wrap gap-2">
                  {p.amenities.map((a: string) => (
                    <Badge key={a} variant="secondary" className="gap-1"><Check className="h-3 w-3" /> {a}</Badge>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* SIDEBAR */}
        <div className="space-y-4 lg:sticky lg:top-4 lg:self-start">
          <Card className="border-2 border-primary/20">
            <CardContent className="p-6">
              <p className="text-3xl font-bold text-primary">{formatPrecio(Number(p.precio), p.moneda, p.operacion)}</p>
              {p.expensas ? (
                <p className="mt-1 text-xs text-muted-foreground">
                  + {formatPrecio(Number(p.expensas), p.moneda)} de expensas
                </p>
              ) : null}

              {!esDueno && (
                <>
                  <div className="mt-4 space-y-2">
                    <Textarea
                      value={mensaje}
                      onChange={(e) => setMensaje(e.target.value)}
                      rows={3}
                      placeholder="Hola, quiero coordinar una visita…"
                    />
                    <Input value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Teléfono (opcional)" />
                    <Button onClick={enviarConsulta} disabled={enviando} size="lg" className="w-full gap-1.5">
                      <MessageCircle className="h-4 w-4" /> {enviada ? "Enviar otra consulta" : "Consultar al agente"}
                    </Button>
                  </div>
                  <Button asChild variant="outline" className="mt-2 w-full gap-1.5">
                    <Link to={`/lin/mensajes?to=${p.agente_id}`}><MessageCircle className="h-4 w-4" /> Chat directo</Link>
                  </Button>
                </>
              )}
              <Button onClick={toggleFav} variant="outline" className="mt-2 w-full gap-1.5">
                <Heart className={`h-4 w-4 ${fav ? "fill-primary text-primary" : ""}`} /> {fav ? "Guardada" : "Guardar"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-5">
              <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Publicada por</p>
              <Link to={`/lin/perfil/${p.agente?.username}`} className="group flex items-center gap-3">
                <Avatar className="h-12 w-12">
                  <AvatarImage src={p.agente?.avatar_url} />
                  <AvatarFallback>{(p.agente?.nombre || "U").slice(0, 1)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold group-hover:text-primary">{p.agente?.nombre}</p>
                  <p className="truncate text-xs text-muted-foreground">@{p.agente?.username}</p>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </Link>
              {p.agente?.bio && <p className="mt-3 text-sm text-muted-foreground">{p.agente.bio}</p>}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
