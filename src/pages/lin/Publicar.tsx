import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, X, Plus, Image as ImageIcon, Video, Loader2 } from "lucide-react";
import { initials } from "@/lib/worefHelpers";
import { toast } from "sonner";

const TIPOS_VISUALES = [
  { key: "update", emoji: "💬", label: "Update" },
  { key: "lanzamiento", emoji: "🎯", label: "Lanzamiento" },
  { key: "logro", emoji: "🏆", label: "Logro" },
  { key: "busco_socio", emoji: "🤝", label: "Busco socio" },
  { key: "oportunidad", emoji: "💰", label: "Oportunidad" },
  { key: "hiring", emoji: "💼", label: "Hiring" },
  { key: "recurso", emoji: "📦", label: "Recurso" },
  { key: "contenido_largo", emoji: "📝", label: "Artículo" },
  { key: "video_corto", emoji: "🎬", label: "Video corto" },
  { key: "encuesta", emoji: "📊", label: "Encuesta" },
  { key: "proyecto", emoji: "🚀", label: "Proyecto" },
  { key: "idea", emoji: "💡", label: "Idea" },
];

const placeholders: Record<string, string> = {
  update: "¿Qué estás construyendo hoy?",
  lanzamiento: "Contá qué lanzaste y por qué importa…",
  logro: "¿Qué lograste? Compartilo con la red…",
  busco_socio: "Describí el proyecto y qué tipo de socio buscás…",
  oportunidad: "Describí la oportunidad de negocio…",
  hiring: "¿Qué rol buscás? Describí el puesto…",
  recurso: "¿Qué herramienta o recurso querés compartir?",
  contenido_largo: "Empezá a escribir tu artículo…",
  encuesta: "¿Cuál es tu pregunta para la red?",
  proyecto: "Contá en qué estás trabajando…",
  idea: "Lanzá tu idea al mundo…",
  video_corto: "Describí brevemente tu video…",
};

type Img = { file: File; preview: string };

export default function Publicar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tipo, setTipo] = useState("update");
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [cuerpoLargo, setCuerpoLargo] = useState("");
  const [tags, setTags] = useState("");
  const [imagenes, setImagenes] = useState<Img[]>([]);
  const [video, setVideo] = useState<File | null>(null);
  const [encuesta, setEncuesta] = useState(["", ""]);
  const [rolBuscado, setRolBuscado] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [pais, setPais] = useState("");
  const [loading, setLoading] = useState(false);
  const [miPerfil, setMiPerfil] = useState<any>(null);

  useEffect(() => {
    if (!user) return;
    (supabase as any).from("perfiles").select("nombre,avatar_url").eq("id", user.id).single()
      .then(({ data }: any) => setMiPerfil(data));
  }, [user]);

  const tipoActual = TIPOS_VISUALES.find((t) => t.key === tipo) || TIPOS_VISUALES[0];

  const addImagenes = (files: FileList | null) => {
    if (!files) return;
    const restantes = 4 - imagenes.length;
    const arr = Array.from(files).slice(0, restantes).map((f) => ({ file: f, preview: URL.createObjectURL(f) }));
    setImagenes((s) => [...s, ...arr]);
  };

  const quitarImagen = (i: number) => {
    setImagenes((s) => {
      URL.revokeObjectURL(s[i].preview);
      return s.filter((_, k) => k !== i);
    });
  };

  const submit = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (!cuerpo && !titulo) return toast.error("Escribí algo");
    const { data: miPerfilCheck } = await (supabase as any)
      .from("perfiles").select("id").eq("id", user.id).maybeSingle();
    if (!miPerfilCheck) return toast.error("Completá tu perfil antes de publicar");
    setLoading(true);
    try {
      const urls: string[] = [];
      for (const img of imagenes) {
        const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}-${img.file.name}`;
        const { error } = await (supabase as any).storage.from("publicaciones").upload(path, img.file);
        if (error) throw error;
        urls.push((supabase as any).storage.from("publicaciones").getPublicUrl(path).data.publicUrl);
      }
      let video_url: string | null = null;
      if (video) {
        const path = `${user.id}/${Date.now()}-${video.name}`;
        const { error } = await (supabase as any).storage.from("videos").upload(path, video);
        if (error) throw error;
        video_url = (supabase as any).storage.from("videos").getPublicUrl(path).data.publicUrl;
      }

      const imagen_url = urls[0] || null;
      const formato = video ? (tipo === "video_largo" ? "video_largo" : "video_corto")
        : imagen_url ? "imagen"
        : tipo === "encuesta" ? "encuesta"
        : tipo === "contenido_largo" ? "articulo"
        : "texto";

      const payload: any = {
        perfil_id: user.id,
        tipo, formato, estado: "activa",
        titulo: titulo || null,
        cuerpo: cuerpo || null,
        cuerpo_largo: cuerpoLargo || null,
        imagen_url, video_url,
        es_reel: !!video_url && tipo === "video_corto",
        tags: tags ? tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean) : null,
      };
      if (tipo === "encuesta") payload.encuesta_opciones = encuesta.filter((o) => o.trim());
      if (tipo === "hiring" || tipo === "oportunidad") {
        payload.rol_buscado = rolBuscado || null;
        payload.modalidad = modalidad || null;
        payload.pais = pais || null;
      }

      const { data, error } = await (supabase as any).from("publicaciones").insert(payload).select("id").single();
      if (error) throw error;

      if (urls.length > 1) {
        const rows = urls.map((url, i) => ({
          publicacion_id: data.id, url, tipo: "imagen", orden: i, es_portada: i === 0,
        }));
        await (supabase as any).from("media_publicacion").insert(rows);
      }

      toast.success("Publicado");
      navigate(`/lin/publicacion/${data.id}`);
    } catch (e: any) {
      toast.error(e.message || "Error al publicar");
    } finally { setLoading(false); }
  };

  return (
    <div className="mx-auto max-w-2xl">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <button onClick={() => navigate(-1)} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <Select value={tipo} onValueChange={setTipo}>
          <SelectTrigger className="h-9 w-auto gap-2 rounded-full border-none bg-secondary px-3 text-xs font-semibold hover:bg-secondary/70 focus:ring-0">
            <SelectValue>
              <span className="flex items-center gap-1.5">
                <span className="text-base leading-none">{tipoActual.emoji}</span>
                <span>{tipoActual.label}</span>
              </span>
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {TIPOS_VISUALES.map((t) => (
              <SelectItem key={t.key} value={t.key}>
                <span className="flex items-center gap-2">
                  <span className="text-base">{t.emoji}</span>
                  <span>{t.label}</span>
                </span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button onClick={submit} disabled={loading || (!cuerpo && !titulo)} size="sm" className="ml-auto h-9 rounded-full px-5 font-semibold">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
        </Button>
      </div>

      <div className="space-y-4 px-1">
        <div className="flex gap-3">
          <Avatar className="h-11 w-11 shrink-0">
            <AvatarImage src={miPerfil?.avatar_url || ""} className="object-cover" />
            <AvatarFallback>{initials(miPerfil?.nombre)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            {["lanzamiento", "hiring", "oportunidad", "proyecto", "recurso", "contenido_largo"].includes(tipo) && (
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título"
                className="h-auto border-none bg-transparent px-0 text-lg font-semibold shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
              />
            )}
            <Textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder={placeholders[tipo] || "¿Qué querés compartir?"}
              className="min-h-[140px] resize-none border-none bg-transparent p-0 text-[17px] leading-relaxed shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/50"
            />
            {tipo === "contenido_largo" && (
              <Textarea
                value={cuerpoLargo}
                onChange={(e) => setCuerpoLargo(e.target.value)}
                rows={8}
                placeholder="Escribí tu artículo…"
                className="rounded-2xl border bg-background px-4 py-3 text-[15px] leading-relaxed"
              />
            )}
          </div>
        </div>

        {imagenes.length > 0 && (
          <div className={`ml-14 grid gap-2 ${imagenes.length === 1 ? "grid-cols-1" : "grid-cols-2"}`}>
            {imagenes.map((img, i) => (
              <div key={i} className="relative aspect-square overflow-hidden rounded-2xl border">
                <img src={img.preview} alt="" className="h-full w-full object-cover" />
                <button
                  onClick={() => quitarImagen(i)}
                  className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-black"
                  aria-label="Quitar imagen"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        {video && (
          <div className="relative ml-14 overflow-hidden rounded-2xl border bg-black">
            <video src={URL.createObjectURL(video)} controls className="max-h-80 w-full" />
            <button
              onClick={() => setVideo(null)}
              className="absolute right-2 top-2 rounded-full bg-black/70 p-1.5 text-white transition-colors hover:bg-black"
              aria-label="Quitar video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {tipo === "encuesta" && (
          <div className="ml-14 space-y-2 rounded-2xl border bg-secondary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Opciones</p>
            {encuesta.map((op, i) => (
              <Input
                key={i} value={op}
                onChange={(e) => { const n = [...encuesta]; n[i] = e.target.value; setEncuesta(n); }}
                placeholder={`Opción ${i + 1}`}
                className="rounded-xl bg-background"
              />
            ))}
            {encuesta.length < 4 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEncuesta([...encuesta, ""])} className="text-primary">
                <Plus className="h-4 w-4" /> Agregar opción
              </Button>
            )}
          </div>
        )}

        {(tipo === "hiring" || tipo === "oportunidad") && (
          <div className="ml-14 space-y-3 rounded-2xl border bg-secondary/30 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Detalles</p>
            <Input value={rolBuscado} onChange={(e) => setRolBuscado(e.target.value)} placeholder="Rol o perfil buscado" className="rounded-xl bg-background" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={modalidad} onChange={(e) => setModalidad(e.target.value)} placeholder="Remoto / Híbrido" className="rounded-xl bg-background" />
              <Input value={pais} onChange={(e) => setPais(e.target.value)} placeholder="País" className="rounded-xl bg-background" />
            </div>
          </div>
        )}

        <div className="ml-14 flex items-center gap-1 border-t pt-3">
          <label className={`cursor-pointer rounded-full p-2 text-primary transition-colors hover:bg-primary/10 ${imagenes.length >= 4 ? "pointer-events-none opacity-40" : ""}`} aria-label="Agregar imágenes">
            <ImageIcon className="h-5 w-5" />
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              onChange={(e) => { addImagenes(e.target.files); e.target.value = ""; }}
            />
          </label>
          <label className="cursor-pointer rounded-full p-2 text-primary transition-colors hover:bg-primary/10" aria-label="Agregar video">
            <Video className="h-5 w-5" />
            <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideo(e.target.files?.[0] || null)} />
          </label>
          {imagenes.length > 0 && (
            <span className="text-xs text-muted-foreground">{imagenes.length}/4</span>
          )}
          <span className={`ml-auto text-xs ${cuerpo.length > 480 ? "text-amber-600" : "text-muted-foreground"}`}>{cuerpo.length}/500</span>
        </div>

        <div className="ml-14">
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="Tags: ia, fintech, marketing"
            className="h-9 rounded-full border-none bg-secondary/40 px-4 text-sm"
          />
        </div>
      </div>
    </div>
  );
}
