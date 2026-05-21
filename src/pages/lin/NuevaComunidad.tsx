import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { ImagePlus, X } from "lucide-react";
import { toast } from "sonner";
import { BackHeader } from "@/components/lin/BackHeader";

export default function NuevaComunidad() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ nombre: "", descripcion: "", tematica: "" });
  const [avatar, setAvatar] = useState<File | null>(null);
  const [portada, setPortada] = useState<File | null>(null);
  const [avatarPrev, setAvatarPrev] = useState("");
  const [portadaPrev, setPortadaPrev] = useState("");
  const [loading, setLoading] = useState(false);

  const pickAvatar = (file: File | null) => { setAvatar(file); setAvatarPrev(file ? URL.createObjectURL(file) : ""); };
  const pickPortada = (file: File | null) => { setPortada(file); setPortadaPrev(file ? URL.createObjectURL(file) : ""); };

  const subir = async (file: File) => {
    const path = `${user!.id}/${Date.now()}-${file.name}`;
    const { error } = await (supabase as any).storage.from("comunidades-media").upload(path, file);
    if (error) throw error;
    return (supabase as any).storage.from("comunidades-media").getPublicUrl(path).data.publicUrl as string;
  };

  const crear = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (!f.nombre.trim()) return toast.error("Falta el nombre");
    setLoading(true);
    try {
      const avatar_url = avatar ? await subir(avatar) : null;
      const portada_url = portada ? await subir(portada) : null;
      const slug = f.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
      const { data, error } = await (supabase as any).from("comunidades").insert({
        creador_id: user.id, nombre: f.nombre, slug,
        descripcion: f.descripcion || null, tematica: f.tematica || null,
        avatar_url, portada_url,
      }).select("id, slug").single();
      if (error) throw error;
      await (supabase as any).from("comunidad_miembros").insert({ comunidad_id: data.id, perfil_id: user.id, rol: "admin" });
      toast.success("Comunidad creada");
      navigate(`/lin/comunidades/${data.slug}`);
    } catch (e: any) {
      toast.error(e.message || "Error al crear la comunidad");
    } finally { setLoading(false); }
  };

  return (
    <>
      <BackHeader title="Nueva comunidad" />
      <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Crear comunidad</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Portada (opcional)</Label>
            {portadaPrev ? (
              <div className="relative">
                <img src={portadaPrev} alt="" className="h-32 w-full rounded-lg border object-cover" />
                <Button type="button" size="icon" variant="secondary" className="absolute right-2 top-2 h-7 w-7" onClick={() => pickPortada(null)}><X className="h-4 w-4" /></Button>
              </div>
            ) : (
              <label className="flex h-32 cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed text-sm text-muted-foreground hover:bg-secondary/50">
                <ImagePlus className="h-4 w-4" /><span>Subir portada</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickPortada(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>

          <div className="space-y-2">
            <Label>Avatar (opcional)</Label>
            {avatarPrev ? (
              <div className="flex items-center gap-3">
                <img src={avatarPrev} alt="" className="h-16 w-16 rounded-full border object-cover" />
                <Button type="button" variant="outline" size="sm" onClick={() => pickAvatar(null)}>Quitar</Button>
              </div>
            ) : (
              <label className="flex h-16 w-fit cursor-pointer items-center gap-2 rounded-full border border-dashed px-4 text-sm text-muted-foreground hover:bg-secondary/50">
                <ImagePlus className="h-4 w-4" /><span>Subir avatar</span>
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickAvatar(e.target.files?.[0] || null)} />
              </label>
            )}
          </div>

          <div className="space-y-2"><Label>Nombre</Label><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} placeholder="Ej: Founders LATAM" /></div>
          <div className="space-y-2"><Label>Descripción</Label><Textarea rows={4} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} placeholder="¿De qué trata esta comunidad?" /></div>
          <div className="space-y-2"><Label>Temática</Label><Input value={f.tematica} onChange={(e) => setF({ ...f, tematica: e.target.value })} placeholder="Startups, IA, marketing…" /></div>

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button onClick={crear} disabled={loading}>{loading ? "Creando…" : "Crear"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
