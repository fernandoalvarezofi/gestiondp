import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { TIPO_USUARIO, initials } from "@/lib/linquenoHelpers";
import { toast } from "sonner";

export default function LinEditarPerfil() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState<any>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any).from("perfiles").select("*").eq("id", user.id).single();
      setForm(data);
    })();
  }, [user]);

  const upd = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const subirImg = async (bucket: string, file: File, campo: string) => {
    const path = `${user!.id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from(bucket).upload(path, file, { upsert: true });
    if (error) return toast.error(error.message);
    const { data } = supabase.storage.from(bucket).getPublicUrl(path);
    upd(campo, data.publicUrl);
  };

  const guardar = async () => {
    if (!form) return;
    setSaving(true);
    const { error } = await (supabase as any).from("perfiles").update({
      nombre: form.nombre,
      descripcion: form.descripcion,
      tipo: form.tipo,
      whatsapp: form.whatsapp,
      telefono: form.telefono,
      instagram: form.instagram,
      facebook: form.facebook,
      sitio_web: form.sitio_web,
      horario: form.horario,
      avatar_url: form.avatar_url,
      portada_url: form.portada_url,
      mensajes_privados: form.mensajes_privados,
      mostrar_telefono: form.mostrar_telefono,
    }).eq("id", user!.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Perfil actualizado");
    navigate(`/lin/perfil/${form.slug}`);
  };

  if (!form) return <p className="text-sm text-muted-foreground">Cargando...</p>;

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <h1 className="text-2xl font-bold tracking-tight">Editar perfil</h1>

      <Card>
        <CardHeader><CardTitle className="text-base">Imágenes</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16"><AvatarImage src={form.avatar_url || ""} className="object-cover" /><AvatarFallback>{initials(form.nombre)}</AvatarFallback></Avatar>
            <div>
              <Label>Avatar</Label>
              <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && subirImg("avatares", e.target.files[0], "avatar_url")} />
            </div>
          </div>
          <div>
            <Label>Portada</Label>
            <Input type="file" accept="image/*" onChange={(e) => e.target.files?.[0] && subirImg("portadas", e.target.files[0], "portada_url")} />
            {form.portada_url && <img src={form.portada_url} alt="" className="mt-2 h-24 w-full rounded-md object-cover" />}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Información</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div><Label>Nombre / Razón social</Label><Input value={form.nombre || ""} onChange={(e) => upd("nombre", e.target.value)} /></div>
          <div>
            <Label>Tipo de cuenta</Label>
            <Select value={form.tipo} onValueChange={(v) => upd("tipo", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {Object.entries(TIPO_USUARIO).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div><Label>Bio</Label><Textarea rows={3} value={form.descripcion || ""} onChange={(e) => upd("descripcion", e.target.value)} /></div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div><Label>WhatsApp</Label><Input value={form.whatsapp || ""} onChange={(e) => upd("whatsapp", e.target.value)} placeholder="5492477123456" /></div>
            <div><Label>Teléfono</Label><Input value={form.telefono || ""} onChange={(e) => upd("telefono", e.target.value)} /></div>
            <div><Label>Instagram</Label><Input value={form.instagram || ""} onChange={(e) => upd("instagram", e.target.value)} placeholder="usuario" /></div>
            <div><Label>Facebook</Label><Input value={form.facebook || ""} onChange={(e) => upd("facebook", e.target.value)} /></div>
            <div><Label>Sitio web</Label><Input value={form.sitio_web || ""} onChange={(e) => upd("sitio_web", e.target.value)} /></div>
            <div><Label>Horario</Label><Input value={form.horario || ""} onChange={(e) => upd("horario", e.target.value)} placeholder="Lun-Vie 9 a 18hs" /></div>
          </div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2"><Label className="m-0">Mostrar teléfono</Label><Switch checked={form.mostrar_telefono} onCheckedChange={(v) => upd("mostrar_telefono", v)} /></div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2"><Label className="m-0">Permitir mensajes privados</Label><Switch checked={form.mensajes_privados} onCheckedChange={(v) => upd("mensajes_privados", v)} /></div>
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button>
        <Button onClick={guardar} disabled={saving}>{saving ? "Guardando..." : "Guardar"}</Button>
      </div>
    </div>
  );
}
