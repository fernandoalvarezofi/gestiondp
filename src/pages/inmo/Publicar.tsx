import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { TIPO_OPERACION_LABEL, TIPO_PROPIEDAD_LABEL } from "@/lib/inmoImages";
import { toast } from "sonner";
import { Upload, X } from "lucide-react";

export default function InmoPublicar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [barrios, setBarrios] = useState<any[]>([]);
  const [files, setFiles] = useState<File[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState<any>({
    titulo: "",
    descripcion: "",
    tipo_operacion: "venta",
    tipo_propiedad: "casa",
    precio: "",
    moneda: "ARS",
    barrio_id: "",
    ambientes: "",
    dormitorios: "",
    banos: "",
    superficie_total: "",
    superficie_cubierta: "",
    hectareas: "",
    cochera: false,
    gas_natural: false,
    agua_corriente: false,
    referencia: "",
  });

  useEffect(() => {
    (async () => {
      const { data } = await (supabase as any).from("barrios").select("id,nombre,zona").order("nombre");
      setBarrios(data || []);
    })();
  }, []);

  const update = (k: string, v: any) => setForm((f: any) => ({ ...f, [k]: v }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    try {
      const { data: ciudad } = await (supabase as any).from("ciudades").select("id").eq("nombre", "Lincoln").single();

      const payload: any = {
        perfil_id: user.id,
        ciudad_id: ciudad.id,
        barrio_id: form.barrio_id || null,
        titulo: form.titulo,
        descripcion: form.descripcion || null,
        tipo_operacion: form.tipo_operacion,
        tipo_propiedad: form.tipo_propiedad,
        moneda: form.moneda,
        precio: form.precio ? Number(form.precio) : null,
        ambientes: form.ambientes ? Number(form.ambientes) : null,
        dormitorios: form.dormitorios ? Number(form.dormitorios) : null,
        banos: form.banos ? Number(form.banos) : null,
        superficie_total: form.superficie_total ? Number(form.superficie_total) : null,
        superficie_cubierta: form.superficie_cubierta ? Number(form.superficie_cubierta) : null,
        hectareas: form.hectareas ? Number(form.hectareas) : null,
        cochera: form.cochera,
        gas_natural: form.gas_natural,
        agua_corriente: form.agua_corriente,
        referencia: form.referencia || null,
      };

      const { data: pub, error } = await (supabase as any).from("publicaciones").insert(payload).select().single();
      if (error) throw error;

      // Upload images
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const path = `${user.id}/${pub.id}/${Date.now()}-${i}-${file.name}`;
        const { error: upErr } = await supabase.storage.from("propiedades").upload(path, file);
        if (upErr) continue;
        const { data: urlData } = supabase.storage.from("propiedades").getPublicUrl(path);
        await (supabase as any).from("imagenes_publicacion").insert({
          publicacion_id: pub.id,
          url: urlData.publicUrl,
          orden: i,
          es_portada: i === 0,
        });
      }

      toast.success("Publicación creada");
      navigate(`/inmo/publicacion/${pub.id}`);
    } catch (err: any) {
      toast.error(err.message || "No se pudo crear");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Nueva publicación</h1>
        <p className="text-sm text-muted-foreground">Compartila con la comunidad de Lincoln.</p>
      </div>

      <Card>
        <CardHeader><CardTitle className="text-base">Datos principales</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Título</Label>
            <Input required value={form.titulo} onChange={(e) => update("titulo", e.target.value)} placeholder="Ej: Casa 3 dorm en Barrio Norte" />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <Label>Operación</Label>
              <Select value={form.tipo_operacion} onValueChange={(v) => update("tipo_operacion", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_OPERACION_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tipo de propiedad</Label>
              <Select value={form.tipo_propiedad} onValueChange={(v) => update("tipo_propiedad", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(TIPO_PROPIEDAD_LABEL).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Precio</Label>
              <Input type="number" value={form.precio} onChange={(e) => update("precio", e.target.value)} placeholder="0" />
            </div>
            <div>
              <Label>Moneda</Label>
              <Select value={form.moneda} onValueChange={(v) => update("moneda", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="ARS">Pesos (ARS)</SelectItem>
                  <SelectItem value="USD">Dólares (USD)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="sm:col-span-2">
              <Label>Barrio</Label>
              <Select value={form.barrio_id} onValueChange={(v) => update("barrio_id", v)}>
                <SelectTrigger><SelectValue placeholder="Elegir barrio" /></SelectTrigger>
                <SelectContent>
                  {barrios.map((b) => <SelectItem key={b.id} value={b.id}>{b.nombre}{b.zona ? ` · ${b.zona}` : ""}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          </div>
          <div>
            <Label>Descripción</Label>
            <Textarea rows={5} value={form.descripcion} onChange={(e) => update("descripcion", e.target.value)} />
          </div>
          <div>
            <Label>Referencia (sin dirección exacta)</Label>
            <Input value={form.referencia} onChange={(e) => update("referencia", e.target.value)} placeholder="Ej: A 2 cuadras de la plaza" />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Características</CardTitle></CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div><Label>Ambientes</Label><Input type="number" value={form.ambientes} onChange={(e) => update("ambientes", e.target.value)} /></div>
          <div><Label>Dormitorios</Label><Input type="number" value={form.dormitorios} onChange={(e) => update("dormitorios", e.target.value)} /></div>
          <div><Label>Baños</Label><Input type="number" value={form.banos} onChange={(e) => update("banos", e.target.value)} /></div>
          <div><Label>Sup. total (m²)</Label><Input type="number" value={form.superficie_total} onChange={(e) => update("superficie_total", e.target.value)} /></div>
          <div><Label>Sup. cubierta (m²)</Label><Input type="number" value={form.superficie_cubierta} onChange={(e) => update("superficie_cubierta", e.target.value)} /></div>
          <div><Label>Hectáreas</Label><Input type="number" value={form.hectareas} onChange={(e) => update("hectareas", e.target.value)} /></div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2"><Label className="m-0">Cochera</Label><Switch checked={form.cochera} onCheckedChange={(v) => update("cochera", v)} /></div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2"><Label className="m-0">Gas natural</Label><Switch checked={form.gas_natural} onCheckedChange={(v) => update("gas_natural", v)} /></div>
          <div className="flex items-center justify-between rounded-md border px-3 py-2"><Label className="m-0">Agua corriente</Label><Switch checked={form.agua_corriente} onCheckedChange={(v) => update("agua_corriente", v)} /></div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle className="text-base">Fotos y video</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border bg-secondary/40 p-6 hover:bg-secondary">
            <Upload className="h-6 w-6 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Subir imágenes (la primera será portada)</span>
            <input type="file" accept="image/*,video/*" multiple className="hidden"
              onChange={(e) => setFiles(Array.from(e.target.files || []))} />
          </label>
          {files.length > 0 && (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
              {files.map((f, i) => (
                <div key={i} className="relative aspect-square overflow-hidden rounded-md bg-muted">
                  <img src={URL.createObjectURL(f)} alt="" className="h-full w-full object-cover" />
                  <button type="button" className="absolute right-1 top-1 rounded-full bg-background/80 p-1"
                    onClick={() => setFiles(files.filter((_, j) => j !== i))}>
                    <X className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => navigate("/inmo")}>Cancelar</Button>
        <Button type="submit" disabled={saving}>{saving ? "Publicando..." : "Publicar"}</Button>
      </div>
    </form>
  );
}
