import { useEffect, useState, useMemo } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { ChevronUp, ChevronDown, CheckCircle2, Pin, MessageSquare, Share2, ArrowLeft, Eye, MoreHorizontal, Pencil, Trash2, X, Check } from "lucide-react";
import { cn } from "@/lib/utils";

type Vote = { id: string; valor: number; post_id: string | null; resp_id: string | null };

export default function ForoPost() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();
  const [post, setPost] = useState<any>(null);
  const [resp, setResp] = useState<any[]>([]);
  const [votos, setVotos] = useState<Vote[]>([]);
  const [txt, setTxt] = useState("");
  const [orden, setOrden] = useState<"votos" | "recientes">("votos");
  const [editandoPost, setEditandoPost] = useState(false);
  const [editTitulo, setEditTitulo] = useState("");
  const [editCuerpo, setEditCuerpo] = useState("");
  const [editandoResp, setEditandoResp] = useState<string | null>(null);
  const [editRespTxt, setEditRespTxt] = useState("");

  const load = async () => {
    const { data } = await (supabase as any).from("foro_posts")
      .select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url,verificado), categoria:foro_categorias!categoria_id(nombre,color,slug)")
      .eq("id", id).single();
    setPost(data);
    const { data: r } = await (supabase as any).from("foro_respuestas")
      .select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url,verificado)")
      .eq("post_id", id);
    setResp(r || []);
    if (user) {
      const { data: v } = await (supabase as any).from("foro_votos")
        .select("id,valor,post_id,resp_id").eq("perfil_id", user.id)
        .or(`post_id.eq.${id},resp_id.in.(${(r || []).map((x: any) => x.id).join(",") || "00000000-0000-0000-0000-000000000000"})`);
      setVotos(v || []);
    }
    // Vista
    if (data) (supabase as any).from("foro_posts").update({ total_vistas: (data.total_vistas || 0) + 1 }).eq("id", id);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [id, user?.id]);

  useEffect(() => {
    const ch = (supabase as any).channel(`foro_post_${id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "foro_respuestas", filter: `post_id=eq.${id}` }, load)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "foro_posts", filter: `id=eq.${id}` }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
    // eslint-disable-next-line
  }, [id]);

  const respOrdenadas = useMemo(() => {
    const sorted = [...resp];
    if (orden === "votos") sorted.sort((a, b) => (b.total_votos || 0) - (a.total_votos || 0));
    else sorted.sort((a, b) => +new Date(a.created_at) - +new Date(b.created_at));
    // solución arriba
    sorted.sort((a, b) => (b.es_solucion ? 1 : 0) - (a.es_solucion ? 1 : 0));
    return sorted;
  }, [resp, orden]);

  const enviar = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (!txt.trim()) return;
    const { error } = await (supabase as any).from("foro_respuestas").insert({ post_id: id, perfil_id: user.id, contenido: txt });
    if (error) return toast.error(error.message);
    setTxt("");
  };

  const votar = async (target: { post_id?: string; resp_id?: string }, valor: 1 | -1) => {
    if (!user) return toast.error("Iniciá sesión");
    const existente = votos.find((v) => (target.post_id && v.post_id === target.post_id) || (target.resp_id && v.resp_id === target.resp_id));
    if (existente && existente.valor === valor) {
      await (supabase as any).from("foro_votos").delete().eq("id", existente.id);
    } else if (existente) {
      await (supabase as any).from("foro_votos").update({ valor }).eq("id", existente.id);
    } else {
      await (supabase as any).from("foro_votos").insert({ ...target, perfil_id: user.id, valor });
    }
    load();
  };

  const marcarSolucion = async (rid: string) => {
    if (!user || user.id !== post.perfil_id) return;
    // limpiar anterior
    await (supabase as any).from("foro_respuestas").update({ es_solucion: false }).eq("post_id", id);
    await (supabase as any).from("foro_respuestas").update({ es_solucion: true }).eq("id", rid);
    await (supabase as any).from("foro_posts").update({ resuelto: true }).eq("id", id);
    toast.success("Marcada como solución");
    load();
  };

  const compartir = () => {
    navigator.clipboard.writeText(window.location.href);
    toast.success("Link copiado");
  };

  const borrarPost = async () => {
    if (!post) return;
    const { error } = await (supabase as any).from("foro_posts").delete().eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Publicación eliminada");
    navigate("/lin/hub?tab=foro");
  };

  const iniciarEditPost = () => {
    setEditTitulo(post.titulo || "");
    setEditCuerpo(post.contenido || "");
    setEditandoPost(true);
  };

  const guardarEditPost = async () => {
    if (!editTitulo.trim()) return toast.error("El título no puede estar vacío");
    const { error } = await (supabase as any).from("foro_posts")
      .update({ titulo: editTitulo.trim(), contenido: editCuerpo, updated_at: new Date().toISOString() })
      .eq("id", post.id);
    if (error) return toast.error(error.message);
    toast.success("Publicación actualizada");
    setEditandoPost(false);
    load();
  };

  const borrarResp = async (rid: string) => {
    const { error } = await (supabase as any).from("foro_respuestas").delete().eq("id", rid);
    if (error) return toast.error(error.message);
    toast.success("Respuesta eliminada");
    load();
  };

  const guardarEditResp = async (rid: string) => {
    if (!editRespTxt.trim()) return;
    const { error } = await (supabase as any).from("foro_respuestas")
      .update({ contenido: editRespTxt }).eq("id", rid);
    if (error) return toast.error(error.message);
    setEditandoResp(null);
    setEditRespTxt("");
    load();
  };

  if (!post) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const miVotoPost = votos.find((v) => v.post_id === id)?.valor || 0;
  const esAutor = user?.id === post.perfil_id;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <Link to="/lin/foro" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-3 w-3" /> Volver al foro
      </Link>

      {/* Pregunta */}
      <Card className="overflow-hidden">
        <CardContent className="flex gap-4 p-5">
          {/* Voto */}
          <div className="flex w-10 shrink-0 flex-col items-center gap-1">
            <button onClick={() => votar({ post_id: id }, 1)}
              className={cn("rounded-md p-1 transition-colors hover:bg-secondary", miVotoPost === 1 && "text-emerald-600 bg-emerald-500/10")}>
              <ChevronUp className="h-5 w-5" />
            </button>
            <span className={cn("text-sm font-bold tabular-nums", post.total_votos > 0 ? "text-emerald-600" : post.total_votos < 0 ? "text-rose-600" : "")}>{post.total_votos || 0}</span>
            <button onClick={() => votar({ post_id: id }, -1)}
              className={cn("rounded-md p-1 transition-colors hover:bg-secondary", miVotoPost === -1 && "text-rose-600 bg-rose-500/10")}>
              <ChevronDown className="h-5 w-5" />
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {post.categoria && <Badge variant="outline" style={{ borderColor: post.categoria.color, color: post.categoria.color }}>#{post.categoria.slug}</Badge>}
              {post.fijado && <Badge variant="secondary"><Pin className="mr-1 h-3 w-3" />Fijado</Badge>}
              {post.resuelto && <Badge className="bg-emerald-500/15 text-emerald-700"><CheckCircle2 className="mr-1 h-3 w-3" />Resuelto</Badge>}
              {post.tags?.map((t: string) => <Badge key={t} variant="secondary" className="text-[10px]">{t}</Badge>)}
            </div>
            <h1 className="text-xl font-bold leading-tight tracking-tight sm:text-2xl">{post.titulo}</h1>
            <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
              <Avatar className="h-6 w-6"><AvatarImage src={post.perfil.avatar_url || ""} /><AvatarFallback className="text-[10px]">{initials(post.perfil.nombre)}</AvatarFallback></Avatar>
              <Link to={`/lin/perfil/${post.perfil.username}`} className="font-medium text-foreground hover:text-primary">{post.perfil.nombre}</Link>
              <span>·</span><span>{formatTime(post.created_at)}</span>
              <span>·</span><span className="flex items-center gap-1"><Eye className="h-3 w-3" />{post.total_vistas || 0}</span>
            </div>
            {post.imagen_url && <img src={post.imagen_url} alt="" className="mt-3 max-h-80 rounded-lg border object-cover" />}
            <div className="prose prose-sm mt-4 max-w-none whitespace-pre-wrap text-sm leading-relaxed">{post.contenido}</div>

            <div className="mt-4 flex items-center gap-2 border-t pt-3">
              <Button size="sm" variant="ghost" onClick={compartir} className="gap-1.5"><Share2 className="h-3.5 w-3.5" />Compartir</Button>
              <span className="ml-auto text-xs text-muted-foreground"><MessageSquare className="mr-1 inline h-3 w-3" />{resp.length} respuestas</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Composer */}
      {user && (
        <Card>
          <CardContent className="space-y-2 p-4">
            <Textarea value={txt} onChange={(e) => setTxt(e.target.value)} rows={4} placeholder="Aportá tu respuesta. Sé claro y específico…" className="resize-none" />
            <div className="flex justify-end">
              <Button size="sm" onClick={enviar} disabled={!txt.trim()}>Responder</Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Respuestas header */}
      <div className="flex items-center justify-between border-b pb-2">
        <h2 className="text-sm font-bold">{resp.length} {resp.length === 1 ? "respuesta" : "respuestas"}</h2>
        <div className="flex gap-1 rounded-full bg-secondary p-1 text-xs">
          <button onClick={() => setOrden("votos")} className={cn("rounded-full px-3 py-1 font-medium", orden === "votos" ? "bg-background shadow-sm" : "text-muted-foreground")}>Mejores</button>
          <button onClick={() => setOrden("recientes")} className={cn("rounded-full px-3 py-1 font-medium", orden === "recientes" ? "bg-background shadow-sm" : "text-muted-foreground")}>Recientes</button>
        </div>
      </div>

      <div className="space-y-3">
        {respOrdenadas.map((r) => {
          const miVoto = votos.find((v) => v.resp_id === r.id)?.valor || 0;
          return (
            <Card key={r.id} className={cn("overflow-hidden transition-colors", r.es_solucion && "border-emerald-500/40 bg-emerald-500/5")}>
              <CardContent className="flex gap-4 p-4">
                <div className="flex w-8 shrink-0 flex-col items-center gap-0.5">
                  <button onClick={() => votar({ resp_id: r.id }, 1)} className={cn("rounded p-0.5 hover:bg-secondary", miVoto === 1 && "text-emerald-600 bg-emerald-500/10")}>
                    <ChevronUp className="h-4 w-4" />
                  </button>
                  <span className="text-xs font-semibold tabular-nums">{r.total_votos || 0}</span>
                  <button onClick={() => votar({ resp_id: r.id }, -1)} className={cn("rounded p-0.5 hover:bg-secondary", miVoto === -1 && "text-rose-600 bg-rose-500/10")}>
                    <ChevronDown className="h-4 w-4" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  {r.es_solucion && (
                    <div className="mb-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-emerald-700">
                      <CheckCircle2 className="h-3 w-3" />Solución
                    </div>
                  )}
                  <div className="flex items-center gap-2 text-xs">
                    <Avatar className="h-6 w-6"><AvatarImage src={r.perfil.avatar_url || ""} /><AvatarFallback className="text-[10px]">{initials(r.perfil.nombre)}</AvatarFallback></Avatar>
                    <Link to={`/lin/perfil/${r.perfil.username}`} className="font-semibold hover:text-primary">{r.perfil.nombre}</Link>
                    <span className="text-muted-foreground">· {formatTime(r.created_at)}</span>
                  </div>
                  <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed">{r.contenido}</p>
                  {esAutor && !r.es_solucion && (
                    <Button size="sm" variant="ghost" className="mt-2 h-7 gap-1.5 text-xs text-emerald-700 hover:bg-emerald-500/10 hover:text-emerald-700"
                      onClick={() => marcarSolucion(r.id)}>
                      <CheckCircle2 className="h-3.5 w-3.5" />Marcar como solución
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
        {resp.length === 0 && (
          <Card><CardContent className="py-10 text-center text-sm text-muted-foreground">
            <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Aún no hay respuestas. Sé el primero en aportar.
          </CardContent></Card>
        )}
      </div>
    </div>
  );
}
