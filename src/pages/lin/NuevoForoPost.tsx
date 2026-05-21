import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { BackHeader } from "@/components/lin/BackHeader";

export default function NuevoForoPost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cats, setCats] = useState<any[]>([]);
  const [f, setF] = useState({ titulo: "", contenido: "", categoria_id: "", tags: "" });
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [loading, setLoading] = useState(false);

  useEffect(() => { (async () => {
    const { data } = await (supabase as any).from("foro_categorias").select("*").order("orden");
    setCats(data || []);
    if (data?.[0]) setF((s) => ({ ...s, categoria_id: data[0].id }));
  })(); }, []);

  const onPickImage = (file: File | null) => {
    setImagen(file);
    setPreview(file ? URL.createObjectURL(file) : "");
  };

  const crear = async () => {
    if (!user || !f.titulo.trim() || !f.contenido.trim() || !f.categoria_id) return toast.error("Faltan campos");
    setLoading(true);
    try {
      let imagen_url: string | null = null;
      if (imagen) {
        const path = `${user.id}/${Date.now()}-${imagen.name}`;
        const { error: upErr } = await (supabase as any).storage.from("publicaciones").upload(path, imagen);
        if (upErr) throw upErr;
        imagen_url = (supabase as any).storage.from("publicaciones").getPublicUrl(path).data.publicUrl;
      }
      const tags = f.tags ? f.tags.split(",").map((t) => t.trim().replace(/^#/, "")).filter(Boolean) : null;
      const { data, error } = await (supabase as any).from("foro_posts").insert({
        perfil_id: user.id,
        titulo: f.titulo, contenido: f.contenido,
        categoria_id: f.categoria_id, tags, imagen_url,
      }).select("id").single();
      if (error) throw error;
      toast.success("Post creado");
      navigate(`/lin/foro/post/${data.id}`);
    } catch (e: any) {
      toast.error(e.message || "Error al publicar");
    } finally { setLoading(false); }
  };

  return (
    <>
      <BackHeader title="Nueva pregunta" />
      <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Nuevo post en el foro</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Categoría</Label>
            <Select value={f.categoria_id} onValueChange={(v) => setF({ ...f, categoria_id: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-2"><Label>Título</Label><Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} placeholder="¿Sobre qué querés hablar?" /></div>
          <div className="space-y-2"><Label>Contenido</Label><Textarea rows={8} value={f.contenido} onChange={(e) => setF({ ...f, contenido: e.target.value })} placeholder="Detallá tu pregunta o aporte…" /></div>

          <div className="space-y-2">
            <Label>Imagen (opcional)</Label>
            {preview ? (
              <div className="relative">
                <img src={preview} alt="" className="max-h-60 w-full rounded-lg border object-cover" />
                <Button type="button" size="icon" variant="secondary" className="absolute right-2 top-2 h-7 w-7" onClick={() => onPickImage(null)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <label className="flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed py-6 text-sm text-muted-foreground hover:bg-secondary/50">
                <ImagePlus className="h-4 w-4" /><span>Subir imagen</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => onPickImage(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>

          <div className="space-y-2"><Label>Tags (separados por coma)</Label><Input value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} placeholder="ia, marketing, ventas" /></div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button onClick={crear} disabled={loading}>{loading ? "Publicando…" : "Publicar"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
