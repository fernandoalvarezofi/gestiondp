import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ArrowLeft, X, Plus, Image as ImageIcon, Video, Loader2 } from "lucide-react";
import { initials } from "@/lib/worefHelpers";
import { toast } from "sonner";

const TIPOS_VISUALES = [
  { key: "update", emoji: "💬", label: "Update", desc: "Contá qué estás haciendo" },
  { key: "lanzamiento", emoji: "🎯", label: "Lanzamiento", desc: "Mostrá algo nuevo" },
  { key: "logro", emoji: "🏆", label: "Logro", desc: "Compartí un éxito" },
  { key: "busco_socio", emoji: "🤝", label: "Busco socio", desc: "Encontrá tu partner" },
  { key: "oportunidad", emoji: "💰", label: "Oportunidad", desc: "Inversión o negocio" },
  { key: "hiring", emoji: "💼", label: "Hiring", desc: "Buscás alguien para tu equipo" },
  { key: "recurso", emoji: "📦", label: "Recurso", desc: "Herramienta o tutorial útil" },
  { key: "contenido_largo", emoji: "📝", label: "Artículo", desc: "Escribí algo largo" },
  { key: "video_corto", emoji: "🎬", label: "Video corto", desc: "Menos de 60 segundos" },
  { key: "encuesta", emoji: "📊", label: "Encuesta", desc: "Preguntale a la red" },
  { key: "proyecto", emoji: "🚀", label: "Proyecto", desc: "Mostrá en qué trabajás" },
  { key: "idea", emoji: "💡", label: "Idea", desc: "Lanzá una idea al mundo" },
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

export default function Publicar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [paso, setPaso] = useState(1);
  const [tipo, setTipo] = useState("update");
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [cuerpoLargo, setCuerpoLargo] = useState("");
  const [tags, setTags] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [imagenPreview, setImagenPreview] = useState<string | null>(null);
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

  const submit = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (!cuerpo && !titulo) return toast.error("Escribí algo");
    const { data: miPerfilCheck } = await (supabase as any)
      .from("perfiles").select("id").eq("id", user.id).maybeSingle();
    if (!miPerfilCheck) return toast.error("Completá tu perfil antes de publicar");
    setLoading(true);
    try {
      let imagen_url: string | null = null;
      let video_url: string | null = null;

      if (imagen) {
        const path = `${user.id}/${Date.now()}-${imagen.name}`;
        const { error } = await (supabase as any).storage.from("publicaciones").upload(path, imagen);
        if (error) throw error;
        imagen_url = (supabase as any).storage.from("publicaciones").getPublicUrl(path).data.publicUrl;
      }
      if (video) {
        const path = `${user.id}/${Date.now()}-${video.name}`;
        const { error } = await (supabase as any).storage.from("videos").upload(path, video);
        if (error) throw error;
        video_url = (supabase as any).storage.from("videos").getPublicUrl(path).data.publicUrl;
      }

      const formato = video ? (tipo === "video_largo" ? "video_largo" : "video_corto")
        : imagen ? "imagen"
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
      toast.success("Publicado");
      navigate(`/lin/publicacion/${data.id}`);
    } catch (e: any) {
      toast.error(e.message || "Error al publicar");
    } finally { setLoading(false); }
  };

  if (paso === 1) {
    return (
      <div className="mx-auto max-w-2xl">
        <div className="mb-6 flex items-center gap-3">
          <button onClick={() => navigate(-1)} className="rounded-full p-2 hover:bg-secondary" aria-label="Volver">
            <ArrowLeft className="h-5 w-5" />
          </button>
          <h1 className="text-2xl font-bold tracking-tight">¿Qué querés compartir?</h1>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {TIPOS_VISUALES.map((t) => (
            <button
              key={t.key}
              onClick={() => { setTipo(t.key); setPaso(2); }}
              className="flex flex-col items-center gap-2 rounded-2xl border-2 border-transparent bg-secondary/50 p-4 text-center transition-all hover:border-primary hover:bg-primary/5 active:scale-95"
            >
              <span className="text-3xl">{t.emoji}</span>
              <p className="text-sm font-semibold">{t.label}</p>
              <p className="text-xs text-muted-foreground">{t.desc}</p>
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl">
      <div className="sticky top-0 z-10 -mx-4 mb-4 flex items-center gap-3 border-b bg-background/95 px-4 py-3 backdrop-blur md:-mx-6 md:px-6">
        <button onClick={() => setPaso(1)} className="rounded-full p-1.5 hover:bg-secondary" aria-label="Volver">
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="flex items-center gap-1.5">
          <span className="text-xl">{tipoActual.emoji}</span>
          <span className="text-sm font-semibold">{tipoActual.label}</span>
        </div>
        <Button onClick={submit} disabled={loading} size="sm" className="ml-auto rounded-full px-5">
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Publicar"}
        </Button>
      </div>

      <div className="space-y-4">
        <div className="flex gap-3">
          <Avatar className="h-10 w-10 shrink-0">
            <AvatarImage src={miPerfil?.avatar_url || ""} className="object-cover" />
            <AvatarFallback>{initials(miPerfil?.nombre)}</AvatarFallback>
          </Avatar>
          <div className="flex-1 space-y-3">
            <Textarea
              value={cuerpo}
              onChange={(e) => setCuerpo(e.target.value)}
              placeholder={placeholders[tipo] || "¿Qué querés compartir?"}
              className="min-h-[120px] resize-none border-none bg-transparent p-0 text-base shadow-none focus-visible:ring-0 placeholder:text-muted-foreground/60"
            />
            {["lanzamiento", "hiring", "oportunidad", "proyecto", "recurso", "contenido_largo"].includes(tipo) && (
              <Input
                value={titulo}
                onChange={(e) => setTitulo(e.target.value)}
                placeholder="Título (opcional)"
                className="rounded-xl border-none bg-secondary/40 px-3"
              />
            )}
            {tipo === "contenido_largo" && (
              <Textarea
                value={cuerpoLargo}
                onChange={(e) => setCuerpoLargo(e.target.value)}
                rows={8}
                placeholder="Escribí tu artículo…"
                className="rounded-xl border-none bg-secondary/40 px-3"
              />
            )}
          </div>
        </div>

        {imagenPreview && (
          <div className="relative overflow-hidden rounded-2xl border">
            <img src={imagenPreview} alt="preview" className="max-h-80 w-full object-cover" />
            <button
              onClick={() => { setImagen(null); setImagenPreview(null); }}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
              aria-label="Quitar imagen"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {video && (
          <div className="relative overflow-hidden rounded-2xl border">
            <video src={URL.createObjectURL(video)} controls className="max-h-80 w-full" />
            <button
              onClick={() => setVideo(null)}
              className="absolute right-2 top-2 rounded-full bg-black/60 p-1 text-white"
              aria-label="Quitar video"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        )}

        {tipo === "encuesta" && (
          <div className="space-y-2 rounded-2xl border bg-secondary/30 p-4">
            <p className="text-sm font-medium text-muted-foreground">Opciones de encuesta</p>
            {encuesta.map((op, i) => (
              <Input
                key={i} value={op}
                onChange={(e) => { const n = [...encuesta]; n[i] = e.target.value; setEncuesta(n); }}
                placeholder={`Opción ${i + 1}`}
                className="rounded-xl bg-background"
              />
            ))}
            {encuesta.length < 4 && (
              <Button type="button" variant="ghost" size="sm" onClick={() => setEncuesta([...encuesta, ""])}>
                <Plus className="mr-1 h-4 w-4" /> Agregar opción
              </Button>
            )}
          </div>
        )}

        {(tipo === "hiring" || tipo === "oportunidad") && (
          <div className="space-y-3 rounded-2xl border bg-secondary/30 p-4">
            <p className="text-sm font-medium text-muted-foreground">Detalles</p>
            <Input value={rolBuscado} onChange={(e) => setRolBuscado(e.target.value)} placeholder="Rol o perfil buscado" className="rounded-xl bg-background" />
            <div className="grid grid-cols-2 gap-2">
              <Input value={modalidad} onChange={(e) => setModalidad(e.target.value)} placeholder="Remoto / Híbrido" className="rounded-xl bg-background" />
              <Input value={pais} onChange={(e) => setPais(e.target.value)} placeholder="País" className="rounded-xl bg-background" />
            </div>
          </div>
        )}

        <div className="rounded-2xl border bg-secondary/30 px-4 py-3">
          <Input
            value={tags}
            onChange={(e) => setTags(e.target.value)}
            placeholder="# Tags separados por coma: ia, fintech, marketing"
            className="border-none bg-transparent p-0 shadow-none focus-visible:ring-0"
          />
        </div>

        <div className="flex items-center gap-1 border-t pt-3">
          <label className="cursor-pointer rounded-full p-2 transition-colors hover:bg-secondary" aria-label="Agregar imagen">
            <ImageIcon className="h-5 w-5 text-primary" />
            <input type="file" accept="image/*" className="hidden" onChange={(e) => {
              const f = e.target.files?.[0] || null;
              setImagen(f);
              setImagenPreview(f ? URL.createObjectURL(f) : null);
            }} />
          </label>
          <label className="cursor-pointer rounded-full p-2 transition-colors hover:bg-secondary" aria-label="Agregar video">
            <Video className="h-5 w-5 text-primary" />
            <input type="file" accept="video/*" className="hidden" onChange={(e) => setVideo(e.target.files?.[0] || null)} />
          </label>
          <span className="ml-auto text-xs text-muted-foreground">{cuerpo.length}/500</span>
        </div>
      </div>
    </div>
  );
}
