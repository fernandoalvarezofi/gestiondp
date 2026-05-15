import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";

export default function ComunidadDetalle() {
  const { slug } = useParams();
  const { user } = useAuth();
  const [c, setC] = useState<any>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [esMiembro, setEsMiembro] = useState(false);
  const [txt, setTxt] = useState("");

  const load = async () => {
    const { data } = await (supabase as any).from("comunidades").select("*").eq("slug", slug).single();
    if (!data) return;
    setC(data);
    const { data: ps } = await (supabase as any).from("comunidad_posts").select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url)").eq("comunidad_id", data.id).order("created_at", { ascending: false });
    setPosts(ps || []);
    if (user) {
      const { data: m } = await (supabase as any).from("comunidad_miembros").select("id").eq("comunidad_id", data.id).eq("perfil_id", user.id).maybeSingle();
      setEsMiembro(!!m);
    }
  };
  useEffect(() => { load(); }, [slug, user]);

  const toggleUnirme = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (esMiembro) await (supabase as any).from("comunidad_miembros").delete().eq("comunidad_id", c.id).eq("perfil_id", user.id);
    else await (supabase as any).from("comunidad_miembros").insert({ comunidad_id: c.id, perfil_id: user.id });
    setEsMiembro(!esMiembro);
  };

  const postear = async () => {
    if (!txt.trim()) return;
    const { error } = await (supabase as any).from("comunidad_posts").insert({ comunidad_id: c.id, perfil_id: user!.id, contenido: txt });
    if (error) return toast.error(error.message);
    setTxt(""); load();
  };

  if (!c) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      {c.portada_url && <img src={c.portada_url} className="h-40 w-full rounded-2xl object-cover" alt="" />}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {c.avatar_url ? <img src={c.avatar_url} className="h-14 w-14 rounded-full object-cover" alt="" /> : <div className="h-14 w-14 rounded-full bg-secondary" />}
          <div><h1 className="text-2xl font-bold tracking-tight">{c.nombre}</h1><p className="text-sm text-muted-foreground">{c.total_miembros} miembros</p></div>
        </div>
        <Button onClick={toggleUnirme} variant={esMiembro ? "outline" : "default"}>{esMiembro ? "Salir" : "Unirme"}</Button>
      </div>
      {c.descripcion && <p className="text-sm">{c.descripcion}</p>}

      {esMiembro && (
        <Card><CardContent className="space-y-2 p-4">
          <Textarea value={txt} onChange={(e) => setTxt(e.target.value)} placeholder="Escribí algo a la comunidad…" rows={3} />
          <div className="flex justify-end"><Button onClick={postear} size="sm">Publicar</Button></div>
        </CardContent></Card>
      )}

      <div className="space-y-3">
        {posts.length === 0 ? <p className="text-center text-sm text-muted-foreground">Aún no hay posts.</p>
          : posts.map((p) => (
            <Card key={p.id}><CardContent className="space-y-2 p-4">
              <div className="flex items-center gap-2">
                <Avatar className="h-7 w-7"><AvatarImage src={p.perfil.avatar_url || ""} /><AvatarFallback>{initials(p.perfil.nombre)}</AvatarFallback></Avatar>
                <p className="text-xs"><span className="font-medium">{p.perfil.nombre}</span> · {formatTime(p.created_at)}</p>
              </div>
              {p.titulo && <p className="font-semibold">{p.titulo}</p>}
              <p className="whitespace-pre-wrap text-sm">{p.contenido}</p>
            </CardContent></Card>
          ))}
      </div>
    </div>
  );
}
