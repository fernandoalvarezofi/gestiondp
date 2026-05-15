import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export default function NuevaComunidad() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [f, setF] = useState({ nombre: "", descripcion: "", tematica: "" });

  const crear = async () => {
    if (!user || !f.nombre.trim()) return toast.error("Falta el nombre");
    const slug = f.nombre.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") + "-" + Date.now().toString(36);
    const { data, error } = await (supabase as any).from("comunidades").insert({
      creador_id: user.id, nombre: f.nombre, slug, descripcion: f.descripcion || null, tematica: f.tematica || null,
    }).select("id, slug").single();
    if (error) return toast.error(error.message);
    await (supabase as any).from("comunidad_miembros").insert({ comunidad_id: data.id, perfil_id: user.id, rol: "admin" });
    toast.success("Comunidad creada");
    navigate(`/lin/comunidades/${data.slug}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Crear comunidad</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Nombre</Label><Input value={f.nombre} onChange={(e) => setF({ ...f, nombre: e.target.value })} /></div>
          <div><Label>Descripción</Label><Textarea rows={4} value={f.descripcion} onChange={(e) => setF({ ...f, descripcion: e.target.value })} /></div>
          <div><Label>Temática</Label><Input value={f.tematica} onChange={(e) => setF({ ...f, tematica: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button><Button onClick={crear}>Crear</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
