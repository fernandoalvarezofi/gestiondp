import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { TIPO_USUARIO } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { BackHeader } from "@/components/lin/BackHeader";

export default function EditarPerfil() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [p, setP] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("perfiles").select("*").eq("id", user.id).single();
      setP(data);
    })();
  }, [user]);

  const upd = (k: string, v: any) => setP((s: any) => ({ ...s, [k]: v }));

  const uploadFile = async (bucket: string, file: File) => {
    const path = `${user!.id}/${Date.now()}-${file.name}`;
    const { error } = await (supabase as any).storage.from(bucket).upload(path, file, { upsert: true });
    if (error) throw error;
    return (supabase as any).storage.from(bucket).getPublicUrl(path).data.publicUrl;
  };

  const onAvatar = async (f: File | null) => { if (!f) return; try { upd("avatar_url", await uploadFile("avatares", f)); } catch (e: any) { toast.error(e.message); } };
  const onPortada = async (f: File | null) => { if (!f) return; try { upd("portada_url", await uploadFile("portadas", f)); } catch (e: any) { toast.error(e.message); } };

  const save = async () => {
    setLoading(true);
    const { error } = await (supabase as any).from("perfiles").update({
      nombre: p.nombre, username: p.username, bio: p.bio, actualmente: p.actualmente,
      ubicacion: p.ubicacion, sitio_web: p.sitio_web, instagram: p.instagram, twitter: p.twitter,
      linkedin: p.linkedin, youtube: p.youtube, tipo: p.tipo, industria: p.industria,
      que_ofrece: p.que_ofrece, que_busca: p.que_busca,
      skills: typeof p.skills === "string" ? p.skills.split(",").map((s: string) => s.trim()).filter(Boolean) : p.skills,
      intereses: typeof p.intereses === "string" ? p.intereses.split(",").map((s: string) => s.trim()).filter(Boolean) : p.intereses,
      avatar_url: p.avatar_url, portada_url: p.portada_url,
      mensajes_privados: p.mensajes_privados, mostrar_ubicacion: p.mostrar_ubicacion,
    }).eq("id", user!.id);
    setLoading(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil actualizado");
    navigate(`/lin/perfil/${p.username}`);
  };

  if (!p) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <>
      <BackHeader title="Editar perfil" />
      <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Editar perfil</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Avatar</Label><Input type="file" accept="image/*" onChange={(e) => onAvatar(e.target.files?.[0] || null)} /></div>
            <div><Label>Portada</Label><Input type="file" accept="image/*" onChange={(e) => onPortada(e.target.files?.[0] || null)} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Nombre</Label><Input value={p.nombre || ""} onChange={(e) => upd("nombre", e.target.value)} /></div>
            <div><Label>Username</Label><Input value={p.username || ""} onChange={(e) => upd("username", e.target.value.toLowerCase().replace(/[^a-z0-9]/g, ""))} /></div>
          </div>
          <div className="space-y-2">
            <Label>Tipo</Label>
            <Select value={p.tipo} onValueChange={(v) => upd("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{Object.entries(TIPO_USUARIO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div><Label>Bio</Label><Textarea rows={3} value={p.bio || ""} onChange={(e) => upd("bio", e.target.value)} /></div>
          <div><Label>Actualmente</Label><Input value={p.actualmente || ""} onChange={(e) => upd("actualmente", e.target.value)} placeholder="Construyendo X / Disponible freelance" /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Industria</Label><Input value={p.industria || ""} onChange={(e) => upd("industria", e.target.value)} /></div>
            <div><Label>Ubicación</Label><Input value={p.ubicacion || ""} onChange={(e) => upd("ubicacion", e.target.value)} /></div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Qué ofrece</Label><Textarea rows={2} value={p.que_ofrece || ""} onChange={(e) => upd("que_ofrece", e.target.value)} /></div>
            <div><Label>Qué busca</Label><Textarea rows={2} value={p.que_busca || ""} onChange={(e) => upd("que_busca", e.target.value)} /></div>
          </div>
          <div><Label>Skills (coma)</Label><Input value={Array.isArray(p.skills) ? p.skills.join(", ") : p.skills || ""} onChange={(e) => upd("skills", e.target.value)} /></div>
          <div><Label>Intereses (coma)</Label><Input value={Array.isArray(p.intereses) ? p.intereses.join(", ") : p.intereses || ""} onChange={(e) => upd("intereses", e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Sitio web</Label><Input value={p.sitio_web || ""} onChange={(e) => upd("sitio_web", e.target.value)} /></div>
            <div><Label>Instagram</Label><Input value={p.instagram || ""} onChange={(e) => upd("instagram", e.target.value)} /></div>
            <div><Label>Twitter / X</Label><Input value={p.twitter || ""} onChange={(e) => upd("twitter", e.target.value)} /></div>
            <div><Label>LinkedIn (URL)</Label><Input value={p.linkedin || ""} onChange={(e) => upd("linkedin", e.target.value)} /></div>
            <div><Label>YouTube (URL)</Label><Input value={p.youtube || ""} onChange={(e) => upd("youtube", e.target.value)} /></div>
          </div>
          <div className="flex items-center justify-between"><Label>Permitir mensajes privados</Label><Switch checked={p.mensajes_privados} onCheckedChange={(v) => upd("mensajes_privados", v)} /></div>
          <div className="flex items-center justify-between"><Label>Mostrar ubicación</Label><Switch checked={p.mostrar_ubicacion} onCheckedChange={(v) => upd("mostrar_ubicacion", v)} /></div>
          <div className="flex justify-end gap-2 pt-2">
            <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
            <Button onClick={save} disabled={loading}>{loading ? "Guardando…" : "Guardar"}</Button>
          </div>
        </CardContent>
      </Card>
    </div>
    </>
  );
}
