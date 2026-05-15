import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ESTADO_PROYECTO } from "@/lib/worefHelpers";
import { toast } from "sonner";

export default function NuevoProyecto() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ nombre: "", descripcion: "", categoria: "", estado: "en_desarrollo", sitio_web: "", buscando: "" });
  const upd = (k: string, v: any) => setF({ ...f, [k]: v });

  const submit = async () => {
    if (!user || !f.nombre.trim()) return toast.error("Falta el nombre");
    const slug = f.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    const { data, error } = await (supabase as any).from("proyectos").insert({
      perfil_id: user.id, nombre: f.nombre, slug, descripcion: f.descripcion, categoria: f.categoria || null,
      estado: f.estado, sitio_web: f.sitio_web || null,
      buscando: f.buscando ? f.buscando.split(",").map((s) => s.trim()).filter(Boolean) : null,
    }).select("slug").single();
    if (error) return toast.error(error.message);
    await (supabase as any).from("proyecto_miembros").insert({ proyecto_id: (data as any).id ?? undefined, perfil_id: user.id, es_fundador: true, rol: "fundador" });
    toast.success("Proyecto creado");
    navigate(`/lin/proyectos/${data.slug}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Nuevo proyecto</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nombre</Label><Input value={f.nombre} onChange={(e) => upd("nombre", e.target.value)} /></div>
          <div><Label>Descripción</Label><Textarea rows={4} value={f.descripcion} onChange={(e) => upd("descripcion", e.target.value)} /></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div><Label>Categoría</Label><Input value={f.categoria} onChange={(e) => upd("categoria", e.target.value)} /></div>
            <div><Label>Estado</Label><Select value={f.estado} onValueChange={(v) => upd("estado", v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(ESTADO_PROYECTO).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent></Select></div>
          </div>
          <div><Label>Sitio web</Label><Input value={f.sitio_web} onChange={(e) => upd("sitio_web", e.target.value)} /></div>
          <div><Label>Buscando (coma)</Label><Input value={f.buscando} onChange={(e) => upd("buscando", e.target.value)} placeholder="diseñador, inversor" /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button><Button onClick={submit}>Crear</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
