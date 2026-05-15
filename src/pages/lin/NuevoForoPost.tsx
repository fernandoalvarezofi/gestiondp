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
import { toast } from "sonner";

export default function NuevoForoPost() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [cats, setCats] = useState<any[]>([]);
  const [f, setF] = useState({ titulo: "", contenido: "", categoria_id: "" });
  useEffect(() => { (async () => {
    const { data } = await (supabase as any).from("foro_categorias").select("*").order("orden");
    setCats(data || []);
    if (data?.[0]) setF((s) => ({ ...s, categoria_id: data[0].id }));
  })(); }, []);

  const crear = async () => {
    if (!user || !f.titulo.trim() || !f.contenido.trim()) return toast.error("Faltan campos");
    const { data, error } = await (supabase as any).from("foro_posts").insert({ perfil_id: user.id, ...f }).select("id").single();
    if (error) return toast.error(error.message);
    navigate(`/lin/foro/post/${data.id}`);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <Card>
        <CardHeader><CardTitle>Nuevo post en el foro</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div><Label>Categoría</Label><Select value={f.categoria_id} onValueChange={(v) => setF({ ...f, categoria_id: v })}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{cats.map((c) => <SelectItem key={c.id} value={c.id}>{c.nombre}</SelectItem>)}</SelectContent></Select></div>
          <div><Label>Título</Label><Input value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></div>
          <div><Label>Contenido</Label><Textarea rows={8} value={f.contenido} onChange={(e) => setF({ ...f, contenido: e.target.value })} /></div>
          <div className="flex justify-end gap-2"><Button variant="outline" onClick={() => navigate(-1)}>Cancelar</Button><Button onClick={crear}>Publicar</Button></div>
        </CardContent>
      </Card>
    </div>
  );
}
