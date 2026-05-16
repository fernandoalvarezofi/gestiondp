import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPO_PUBLICACION } from "@/lib/worefHelpers";
import { toast } from "sonner";

export default function Publicar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tipo, setTipo] = useState("update");
  const [titulo, setTitulo] = useState("");
  const [cuerpo, setCuerpo] = useState("");
  const [cuerpoLargo, setCuerpoLargo] = useState("");
  const [tags, setTags] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [video, setVideo] = useState<File | null>(null);
  const [encuesta, setEncuesta] = useState(["", ""]);
  const [rolBuscado, setRolBuscado] = useState("");
  const [modalidad, setModalidad] = useState("");
  const [pais, setPais] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (!cuerpo && !titulo) return toast.error("Escribí algo");
    const { data: miPerfil } = await (supabase as any)
      .from("perfiles").select("id").eq("id", user.id).maybeSingle();
    if (!miPerfil) return toast.error("Completá tu perfil antes de publicar");
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

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Crear publicación</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={tipo} onValueChange={setTipo}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_PUBLICACION).map(([k, v]) => (
                  <SelectItem key={k} value={k}>{v.emoji} {v.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Título (opcional)</Label>
            <Input value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder="Un título corto y claro" />
          </div>

          <div className="space-y-2">
            <Label>Contenido</Label>
            <Textarea value={cuerpo} onChange={(e) => setCuerpo(e.target.value)} placeholder="¿Qué querés compartir?" rows={5} />
          </div>

          {tipo === "contenido_largo" && (
            <div className="space-y-2">
              <Label>Artículo (cuerpo largo)</Label>
              <Textarea value={cuerpoLargo} onChange={(e) => setCuerpoLargo(e.target.value)} rows={10} placeholder="Escribí tu artículo…" />
            </div>
          )}

          {tipo === "encuesta" && (
            <div className="space-y-2">
              <Label>Opciones de encuesta</Label>
              {encuesta.map((op, i) => (
                <Input key={i} value={op} onChange={(e) => {
                  const n = [...encuesta]; n[i] = e.target.value; setEncuesta(n);
                }} placeholder={`Opción ${i + 1}`} />
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => setEncuesta([...encuesta, ""])}>+ Agregar opción</Button>
            </div>
          )}

          {(tipo === "hiring" || tipo === "oportunidad") && (
            <div className="grid gap-3 sm:grid-cols-3">
              <div><Label>Rol</Label><Input value={rolBuscado} onChange={(e) => setRolBuscado(e.target.value)} /></div>
              <div><Label>Modalidad</Label><Input value={modalidad} onChange={(e) => setModalidad(e.target.value)} placeholder="Remoto / Híbrido" /></div>
              <div><Label>País</Label><Input value={pais} onChange={(e) => setPais(e.target.value)} /></div>
            </div>
          )}

          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Imagen</Label><Input type="file" accept="image/*" onChange={(e) => setImagen(e.target.files?.[0] || null)} /></div>
            <div><Label>Video</Label><Input type="file" accept="video/*" onChange={(e) => setVideo(e.target.files?.[0] || null)} /></div>
          </div>

          <div className="space-y-2">
            <Label>Tags (separados por coma)</Label>
            <Input value={tags} onChange={(e) => setTags(e.target.value)} placeholder="ia, fintech, marketing" />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button onClick={submit} disabled={loading}>{loading ? "Publicando…" : "Publicar"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
