import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Plus, Pencil, Trash2, Box, Loader2, RefreshCw, Upload, Eye, MessageCircle, Home, Check, Settings2,
} from "lucide-react";
import { formatPrecio, labelEstado, labelOperacion, ubicacionCorta } from "@/lib/inmobiliaria";
import {
  crearTourJob, obtenerTourJob, getSplatServiceUrl, setSplatServiceUrl,
  verificarSaludServicio, type SaludServicio,
} from "@/lib/splatService";
import { toast } from "sonner";

const MAX_VIDEO = 400 * 1024 * 1024;

export default function MisPropiedades() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [props, setProps] = useState<any[]>([]);
  const [consultas, setConsultas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [serviceUrl, setServiceUrlState] = useState(getSplatServiceUrl());
  const [procesando, setProcesando] = useState<string | null>(null);
  const [salud, setSalud] = useState<SaludServicio | null>(null);
  const [verificando, setVerificando] = useState(false);

  const chequear = async () => {
    setVerificando(true);
    try {
      setSalud(await verificarSaludServicio());
    } finally {
      setVerificando(false);
    }
  };

  useEffect(() => {
    chequear();
    const id = setInterval(chequear, 60000);
    const onVisible = () => { if (document.visibilityState === "visible") chequear(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", onVisible); };
  }, [serviceUrl]);

  const cargar = async () => {
    if (!user) return;
    const [{ data: p }, { data: c }] = await Promise.all([
      (supabase as any).from("propiedades").select("*").eq("agente_id", user.id).order("created_at", { ascending: false }),
      (supabase as any).from("propiedad_consultas")
        .select(`*, perfil:perfiles!perfil_id(id,nombre,username,avatar_url), propiedad:propiedades!propiedad_id(id,titulo,slug)`)
        .order("created_at", { ascending: false }).limit(50),
    ]);
    setProps(p || []);
    setConsultas((c || []).filter((x: any) => x.perfil_id !== user.id));
    setLoading(false);
  };

  useEffect(() => {
    if (!user) { navigate("/auth"); return; }
    cargar();
  }, [user]);

  const eliminar = async (id: string) => {
    if (!confirm("¿Eliminar esta propiedad? Esta acción no se puede deshacer.")) return;
    const { error } = await (supabase as any).from("propiedades").delete().eq("id", id);
    if (error) { toast.error("No se pudo eliminar"); return; }
    setProps((arr) => arr.filter((p) => p.id !== id));
    toast.success("Propiedad eliminada");
  };

  const guardarUrl = () => {
    setSplatServiceUrl(serviceUrl);
    setServiceUrlState(getSplatServiceUrl());
    toast.success(getSplatServiceUrl() ? "Servicio 3D configurado" : "Servicio 3D desconectado");
    chequear();
  };

  const subirVideo = async (propiedad: any, file: File | null) => {
    if (!file || !user) return;
    if (!getSplatServiceUrl()) { toast.error("Primero configurá la URL del servicio 3D"); return; }
    if (!file.type.startsWith("video/")) { toast.error("Tiene que ser un video"); return; }
    if (file.size > MAX_VIDEO) { toast.error("El video supera los 400 MB"); return; }

    setProcesando(propiedad.id);
    try {
      const path = `${user.id}/tours/${propiedad.id}-${Date.now()}.${file.name.split(".").pop() || "mp4"}`;
      await supabase.storage.from("propiedades").upload(path, file, { contentType: file.type });
      const { data: pub } = supabase.storage.from("propiedades").getPublicUrl(path);

      const job = await crearTourJob(file, propiedad.id);
      await (supabase as any).from("propiedades").update({
        tour_estado: "procesando",
        tour_job_id: job.job_id,
        tour_video_url: pub.publicUrl,
      }).eq("id", propiedad.id);
      toast.success("Video enviado. La reconstrucción 3D está en cola.");
      await cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo iniciar el tour 3D");
      await (supabase as any).from("propiedades").update({ tour_estado: "error" }).eq("id", propiedad.id);
      await cargar();
    } finally {
      setProcesando(null);
    }
  };

  const revisarTour = async (propiedad: any) => {
    if (!propiedad.tour_job_id) return;
    setProcesando(propiedad.id);
    try {
      const job = await obtenerTourJob(propiedad.tour_job_id);
      if (job.status === "done" && job.splat_url) {
        await (supabase as any).from("propiedades").update({ tour_estado: "listo", tour_url: job.splat_url }).eq("id", propiedad.id);
        toast.success("¡Tour 3D listo!");
      } else if (job.status === "failed") {
        await (supabase as any).from("propiedades").update({ tour_estado: "error" }).eq("id", propiedad.id);
        toast.error(job.error || "La reconstrucción falló");
      } else {
        toast.info(`En proceso${job.stage ? ` · ${job.stage}` : ""}${job.progress != null ? ` · ${Math.round(job.progress * 100)}%` : ""}`);
      }
      await cargar();
    } catch (e: any) {
      toast.error(e?.message || "No se pudo consultar el estado");
    } finally {
      setProcesando(null);
    }
  };

  const tourBadge = (estado: string) => {
    if (estado === "listo") return <Badge variant="secondary" className="gap-1"><Check className="h-3 w-3" /> Tour 3D listo</Badge>;
    if (estado === "procesando") return <Badge variant="secondary" className="gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Generando tour</Badge>;
    if (estado === "error") return <Badge variant="destructive">Tour con error</Badge>;
    return null;
  };

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Mis propiedades</h1>
          <p className="mt-1 text-sm text-muted-foreground">Administrá tus publicaciones, tours 3D y consultas.</p>
        </div>
        <Button asChild className="gap-1.5"><Link to="/lin/propiedades/nueva"><Plus className="h-4 w-4" /> Publicar propiedad</Link></Button>
      </div>

      <Tabs defaultValue="publicaciones" className="mt-6">
        <TabsList>
          <TabsTrigger value="publicaciones">Publicaciones ({props.length})</TabsTrigger>
          <TabsTrigger value="consultas">Consultas ({consultas.length})</TabsTrigger>
          <TabsTrigger value="tours" className="gap-1.5"><Settings2 className="h-3.5 w-3.5" /> Tours 3D</TabsTrigger>
        </TabsList>

        <TabsContent value="publicaciones" className="mt-4 space-y-3">
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-28 w-full rounded-xl" />)
          ) : props.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center">
              <Home className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-semibold">Todavía no publicaste propiedades</p>
              <Button asChild className="mt-4 gap-1.5"><Link to="/lin/propiedades/nueva"><Plus className="h-4 w-4" /> Publicar la primera</Link></Button>
            </div>
          ) : (
            props.map((p) => (
              <Card key={p.id}>
                <CardContent className="flex flex-col gap-4 p-4 sm:flex-row">
                  <div className="h-28 w-full shrink-0 overflow-hidden rounded-lg bg-secondary/40 sm:w-40">
                    {p.portada_url ? (
                      <img src={p.portada_url} alt={p.titulo} className="h-full w-full object-cover" />
                    ) : (
                      <div className="flex h-full items-center justify-center text-muted-foreground/40"><Box className="h-8 w-8" /></div>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Badge variant="outline">{labelOperacion(p.operacion)}</Badge>
                      <Badge variant={p.estado === "activa" ? "default" : "secondary"}>{labelEstado(p.estado)}</Badge>
                      {tourBadge(p.tour_estado)}
                    </div>
                    <Link to={`/lin/propiedades/${p.slug}`} className="mt-1 block truncate font-semibold hover:text-primary">{p.titulo}</Link>
                    <p className="truncate text-xs text-muted-foreground">{ubicacionCorta(p) || "Sin ubicación"}</p>
                    <p className="mt-1 font-bold text-primary">{formatPrecio(Number(p.precio), p.moneda, p.operacion)}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      <Eye className="mr-1 inline h-3 w-3" />{p.total_vistas} vistas · {p.total_consultas} consultas · {p.total_favoritos} guardados
                    </p>
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button asChild size="sm" variant="outline" className="gap-1.5">
                        <Link to={`/lin/propiedades/nueva?id=${p.id}`}><Pencil className="h-3.5 w-3.5" /> Editar</Link>
                      </Button>
                      {p.tour_estado === "procesando" && p.tour_job_id ? (
                        <Button size="sm" variant="outline" className="gap-1.5" disabled={procesando === p.id} onClick={() => revisarTour(p)}>
                          <RefreshCw className={`h-3.5 w-3.5 ${procesando === p.id ? "animate-spin" : ""}`} /> Revisar estado
                        </Button>
                      ) : (
                        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-medium transition hover:bg-secondary">
                          {procesando === p.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Upload className="h-3.5 w-3.5" />}
                          {p.tour_estado === "listo" ? "Regenerar tour 3D" : "Generar tour 3D"}
                          <input type="file" accept="video/*" hidden onChange={(e) => subirVideo(p, e.target.files?.[0] ?? null)} />
                        </label>
                      )}
                      <Button size="sm" variant="ghost" className="gap-1.5 text-destructive" onClick={() => eliminar(p.id)}>
                        <Trash2 className="h-3.5 w-3.5" /> Eliminar
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="consultas" className="mt-4 space-y-3">
          {consultas.length === 0 ? (
            <div className="rounded-2xl border bg-card p-12 text-center">
              <MessageCircle className="mx-auto h-10 w-10 text-muted-foreground/40" />
              <p className="mt-3 font-semibold">Sin consultas todavía</p>
              <p className="mt-1 text-sm text-muted-foreground">Cuando alguien consulte por una propiedad tuya, aparece acá.</p>
            </div>
          ) : (
            consultas.map((c) => (
              <Card key={c.id}>
                <CardContent className="flex gap-3 p-4">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={c.perfil?.avatar_url} />
                    <AvatarFallback>{(c.perfil?.nombre || "U").slice(0, 1)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <Link to={`/lin/perfil/${c.perfil?.username}`} className="font-semibold hover:text-primary">{c.perfil?.nombre}</Link>
                      <span className="text-xs text-muted-foreground">
                        sobre <Link to={`/lin/propiedades/${c.propiedad?.slug}`} className="underline">{c.propiedad?.titulo}</Link>
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-sm">{c.mensaje}</p>
                    {c.telefono && <p className="mt-1 text-xs text-muted-foreground">Tel: {c.telefono}</p>}
                    <Button asChild size="sm" variant="outline" className="mt-2 gap-1.5">
                      <Link to={`/lin/mensajes?to=${c.perfil_id}`}><MessageCircle className="h-3.5 w-3.5" /> Responder por chat</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        <TabsContent value="tours" className="mt-4">
          <Card>
            <CardContent className="space-y-4 p-5">
              <div>
                <h2 className="font-semibold">Servicio de reconstrucción 3D</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Pegá la URL pública de tu servicio de reconstrucción (el que expone <code>POST /jobs</code> y <code>GET /jobs/&#123;id&#125;</code>).
                  Desde cada propiedad vas a poder subir un video y generar el recorrido 3D.
                </p>
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1">
                  <Label>URL del servicio</Label>
                  <Input
                    value={serviceUrl}
                    onChange={(e) => setServiceUrlState(e.target.value)}
                    placeholder="https://mi-servicio-3d.ejemplo.com"
                  />
                </div>
                <Button onClick={guardarUrl} className="gap-1.5"><Check className="h-4 w-4" /> Guardar</Button>
              </div>
              <div className="rounded-lg border bg-secondary/30 p-3 text-xs text-muted-foreground">
                <p className="font-semibold text-foreground">Cómo grabar un buen video</p>
                <p className="mt-1">Caminá lento alrededor y dentro del ambiente, cubriendo cada pared. 60–120 segundos, luz uniforme, sin movimientos bruscos.</p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
