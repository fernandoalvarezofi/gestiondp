import { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { PostCard } from "@/components/lin/PostCard";
import { initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { sanitizarErrorEs } from "@/lib/sanitize";
import { BackHeader } from "@/components/lin/BackHeader";
import { useConfirm } from "@/components/lin/ConfirmDialog";
import { Trash2, Pencil, Check, X } from "lucide-react";


const SELECT = `id,tipo,formato,titulo,cuerpo,cuerpo_largo,imagen_url,video_url,encuesta_opciones,
  rol_buscado,modalidad,pais,tags,vistas,total_likes,total_comentarios,total_repostes,destacada,created_at,
  perfil:perfiles!perfil_id(id,nombre,username,avatar_url,tipo,verificado),
  media:media_publicacion(url,es_portada,orden)`;

export default function PublicacionDetalle() {
  const { id } = useParams();
  const { user } = useAuth();
  const confirm = useConfirm();
  const [pub, setPub] = useState<any>(null);
  const [coms, setComs] = useState<any[]>([]);
  const [nuevo, setNuevo] = useState("");
  const [editId, setEditId] = useState<string | null>(null);
  const [editTxt, setEditTxt] = useState("");


  const load = async () => {
    if (!id) return;
    const { data } = await (supabase as any).from("publicaciones").select(SELECT).eq("id", id).single();
    setPub(data);
    const { data: c } = await (supabase as any).from("comentarios")
      .select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url)")
      .eq("publicacion_id", id).order("created_at", { ascending: true });
    setComs(c || []);
    (supabase as any).rpc("registrar_vista", { p_publicacion_id: id });
  };

  useEffect(() => { load(); }, [id]);

  const enviar = async () => {
    if (!user || !nuevo.trim()) return;
    const { error } = await (supabase as any).from("comentarios").insert({ publicacion_id: id, perfil_id: user.id, contenido: nuevo });
    if (error) return toast.error(error.message);
    setNuevo(""); load();
  };

  const eliminarComentario = async (cid: string) => {
    const ok = await confirm({ title: "¿Eliminar comentario?", description: "Esta acción no se puede deshacer.", confirmText: "Eliminar", destructive: true });
    if (!ok) return;
    await (supabase as any).from("comentarios").delete().eq("id", cid).eq("perfil_id", user!.id);
    toast.success("Comentario eliminado"); load();
  };

  const guardarEdicion = async (cid: string) => {
    if (!editTxt.trim()) return;
    await (supabase as any).from("comentarios").update({ contenido: editTxt }).eq("id", cid).eq("perfil_id", user!.id);
    setEditId(null); setEditTxt(""); toast.success("Comentario actualizado"); load();
  };


  if (!pub) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  return (
    <>
      <BackHeader title="Publicación" />
      <div className="mx-auto max-w-2xl space-y-5">
      <PostCard pub={pub} />
      {pub.cuerpo_largo && <Card><CardContent className="prose prose-sm max-w-none whitespace-pre-wrap p-5">{pub.cuerpo_largo}</CardContent></Card>}

      <Card>
        <CardContent className="space-y-3 p-4">
          <h2 className="text-sm font-semibold">Comentarios ({coms.length})</h2>
          {user && (
            <div className="space-y-2">
              <Textarea value={nuevo} onChange={(e) => setNuevo(e.target.value)} placeholder="Escribí un comentario…" rows={2} />
              <div className="flex justify-end"><Button size="sm" onClick={enviar}>Comentar</Button></div>
            </div>
          )}
          {coms.length === 0 ? <p className="text-sm text-muted-foreground">Sé el primero en comentar.</p>
            : coms.map((c) => (
              <div key={c.id} className="group flex gap-2 border-t pt-3">
                <Link to={`/lin/perfil/${c.perfil.username}`}>
                  <Avatar className="h-8 w-8"><AvatarImage src={c.perfil.avatar_url || ""} /><AvatarFallback>{initials(c.perfil.nombre)}</AvatarFallback></Avatar>
                </Link>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-muted-foreground"><span className="font-medium text-foreground">{c.perfil.nombre}</span> · {formatTime(c.created_at)}</p>
                  {editId === c.id ? (
                    <div className="mt-1 space-y-1.5">
                      <Textarea value={editTxt} onChange={(e) => setEditTxt(e.target.value)} rows={2} />
                      <div className="flex gap-1.5">
                        <Button size="sm" className="h-7 gap-1.5" onClick={() => guardarEdicion(c.id)}><Check className="h-3.5 w-3.5" />Guardar</Button>
                        <Button size="sm" variant="ghost" className="h-7 gap-1.5" onClick={() => { setEditId(null); setEditTxt(""); }}><X className="h-3.5 w-3.5" />Cancelar</Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-sm whitespace-pre-wrap break-words">{c.contenido}</p>
                  )}
                </div>
                {user?.id === c.perfil_id && editId !== c.id && (
                  <div className="flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                    <button onClick={() => { setEditId(c.id); setEditTxt(c.contenido); }} className="rounded-md p-1.5 text-muted-foreground hover:bg-secondary hover:text-foreground"><Pencil className="h-3.5 w-3.5" /></button>
                    <button onClick={() => eliminarComentario(c.id)} className="rounded-md p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 className="h-3.5 w-3.5" /></button>
                  </div>
                )}
              </div>
            ))}

        </CardContent>
      </Card>
    </div>
    </>
  );
}
