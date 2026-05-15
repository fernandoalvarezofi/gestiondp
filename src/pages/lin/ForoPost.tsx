import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";

export default function ForoPost() {
  const { id } = useParams();
  const { user } = useAuth();
  const [post, setPost] = useState<any>(null);
  const [resp, setResp] = useState<any[]>([]);
  const [txt, setTxt] = useState("");

  const load = async () => {
    const { data } = await (supabase as any).from("foro_posts").select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url), categoria:foro_categorias!categoria_id(nombre,color)").eq("id", id).single();
    setPost(data);
    const { data: r } = await (supabase as any).from("foro_respuestas").select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url)").eq("post_id", id).order("created_at");
    setResp(r || []);
  };
  useEffect(() => { load(); }, [id]);

  const enviar = async () => {
    if (!user || !txt.trim()) return;
    const { error } = await (supabase as any).from("foro_respuestas").insert({ post_id: id, perfil_id: user.id, contenido: txt });
    if (error) return toast.error(error.message);
    setTxt(""); load();
  };

  if (!post) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <Card><CardContent className="space-y-2 p-5">
        <p className="text-xs" style={{ color: post.categoria?.color }}>{post.categoria?.nombre}</p>
        <h1 className="text-xl font-bold tracking-tight">{post.titulo}</h1>
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Avatar className="h-6 w-6"><AvatarImage src={post.perfil.avatar_url || ""} /><AvatarFallback>{initials(post.perfil.nombre)}</AvatarFallback></Avatar>
          {post.perfil.nombre} · {formatTime(post.created_at)}
        </div>
        <p className="whitespace-pre-wrap pt-2 text-sm">{post.contenido}</p>
      </CardContent></Card>

      <Card><CardContent className="space-y-3 p-4">
        <h2 className="text-sm font-semibold">Respuestas ({resp.length})</h2>
        {user && (<>
          <Textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={3} placeholder="Tu respuesta…" />
          <div className="flex justify-end"><Button size="sm" onClick={enviar}>Responder</Button></div>
        </>)}
        {resp.map((r) => (
          <div key={r.id} className="flex gap-2 border-t pt-3">
            <Avatar className="h-7 w-7"><AvatarImage src={r.perfil.avatar_url || ""} /><AvatarFallback>{initials(r.perfil.nombre)}</AvatarFallback></Avatar>
            <div className="flex-1"><p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{r.perfil.nombre}</span> · {formatTime(r.created_at)}</p>
              <p className="whitespace-pre-wrap text-sm">{r.contenido}</p></div>
          </div>
        ))}
      </CardContent></Card>
    </div>
  );
}
