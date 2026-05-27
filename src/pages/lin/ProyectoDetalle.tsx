import { useEffect, useState, useMemo } from "react";
import { useParams, Link } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { ESTADO_PROYECTO, initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { Plus, Paperclip, Activity, Layers, Info, Upload, File as FileIcon, Calendar, Flag, Trash2, ExternalLink, Github, Globe, Sparkles, Triangle, MessageSquare, Send, Pencil, TrendingUp, ChevronLeft, ChevronRight, PlayCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { BackHeader } from "@/components/lin/BackHeader";
import { useConfirm } from "@/components/lin/ConfirmDialog";


const ESTADOS_TAREA = [
  { id: "backlog", label: "Backlog", color: "bg-slate-500/10 text-slate-700 border-slate-500/20" },
  { id: "en_progreso", label: "En progreso", color: "bg-blue-500/10 text-blue-700 border-blue-500/20" },
  { id: "revision", label: "Revisión", color: "bg-amber-500/10 text-amber-700 border-amber-500/20" },
  { id: "completada", label: "Completada", color: "bg-emerald-500/10 text-emerald-700 border-emerald-500/20" },
] as const;

const PRIORIDADES: Record<string, { label: string; color: string }> = {
  baja: { label: "Baja", color: "text-slate-500" },
  media: { label: "Media", color: "text-blue-500" },
  alta: { label: "Alta", color: "text-amber-500" },
  urgente: { label: "Urgente", color: "text-rose-500" },
};

export default function ProyectoDetalle() {
  const { slug } = useParams();
  const { user } = useAuth();
  const confirm = useConfirm();

  const [p, setP] = useState<any>(null);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [updates, setUpdates] = useState<any[]>([]);
  const [tareas, setTareas] = useState<any[]>([]);
  const [archivos, setArchivos] = useState<any[]>([]);
  const [actividad, setActividad] = useState<any[]>([]);
  const [comentarios, setComentarios] = useState<any[]>([]);
  const [mediaList, setMediaList] = useState<any[]>([]);
  const [mediaIdx, setMediaIdx] = useState(0);
  const [nuevoComent, setNuevoComent] = useState("");
  const [editandoComent, setEditandoComent] = useState<{ id: string; texto: string } | null>(null);
  const [siguiendo, setSiguiendo] = useState(false);
  const [voted, setVoted] = useState(false);
  const [esMiembro, setEsMiembro] = useState(false);
  const [tab, setTab] = useState("overview");
  const [nuevaTarea, setNuevaTarea] = useState({ open: false, titulo: "", descripcion: "", estado: "backlog", prioridad: "media", asignado_id: "", fecha_limite: "" });
  const [subiendo, setSubiendo] = useState(false);

  const load = async () => {
    const { data } = await (supabase as any).from("proyectos").select("*, perfil:perfiles!perfil_id(id,nombre,username,avatar_url)").or(`slug.eq.${slug},id.eq.${slug}`).single();
    if (!data) return;
    setP(data);
    const [{ data: m }, { data: u }, { data: t }, { data: a }, { data: act }, { data: cm }, { data: md }] = await Promise.all([
      (supabase as any).from("proyecto_miembros").select("*, perfil:perfiles!perfil_id(id,nombre,username,avatar_url)").eq("proyecto_id", data.id),
      (supabase as any).from("proyecto_updates").select("*").eq("proyecto_id", data.id).order("created_at", { ascending: false }),
      (supabase as any).from("proyecto_tareas").select("*, asignado:perfiles!asignado_id(id,nombre,username,avatar_url)").eq("proyecto_id", data.id).order("orden"),
      (supabase as any).from("proyecto_archivos").select("*, perfil:perfiles!subido_por(nombre,username,avatar_url)").eq("proyecto_id", data.id).order("created_at", { ascending: false }),
      (supabase as any).from("proyecto_actividad").select("*, perfil:perfiles!perfil_id(nombre,username,avatar_url)").eq("proyecto_id", data.id).order("created_at", { ascending: false }).limit(50),
      (supabase as any).from("proyecto_comentarios").select("*, perfil:perfiles!perfil_id(id,nombre,username,avatar_url,verificado)").eq("proyecto_id", data.id).order("created_at", { ascending: false }),
      (supabase as any).from("proyecto_media").select("*").eq("proyecto_id", data.id).order("orden"),
    ]);
    setMiembros(m || []); setUpdates(u || []); setTareas(t || []); setArchivos(a || []); setActividad(act || []); setComentarios(cm || []); setMediaList(md || []);
    if (user) {
      const [{ data: s }, { data: v }] = await Promise.all([
        (supabase as any).from("proyecto_seguidores").select("id").eq("proyecto_id", data.id).eq("perfil_id", user.id).maybeSingle(),
        (supabase as any).from("proyecto_upvotes").select("id").eq("proyecto_id", data.id).eq("perfil_id", user.id).maybeSingle(),
      ]);
      setSiguiendo(!!s);
      setVoted(!!v);
      setEsMiembro((m || []).some((x: any) => x.perfil_id === user.id) || data.perfil_id === user.id);
    }
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug, user]);

  useEffect(() => {
    if (!p) return;
    const ch = (supabase as any).channel(`proy_${p.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "proyecto_tareas", filter: `proyecto_id=eq.${p.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "proyecto_archivos", filter: `proyecto_id=eq.${p.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "proyecto_actividad", filter: `proyecto_id=eq.${p.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "proyecto_comentarios", filter: `proyecto_id=eq.${p.id}` }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
    // eslint-disable-next-line
  }, [p?.id]);

  const enviarComentario = async () => {
    if (!user) return toast.error("Iniciá sesión para comentar");
    const texto = nuevoComent.trim();
    if (!texto) return;
    const { error } = await (supabase as any).from("proyecto_comentarios").insert({
      proyecto_id: p.id, perfil_id: user.id, contenido: texto,
    });
    if (error) return toast.error(error.message);
    setNuevoComent("");
  };

  const guardarEdicionComent = async () => {
    if (!editandoComent) return;
    const texto = editandoComent.texto.trim();
    if (!texto) return;
    await (supabase as any).from("proyecto_comentarios").update({ contenido: texto, editado_at: new Date().toISOString() }).eq("id", editandoComent.id);
    setEditandoComent(null);
  };

  const eliminarComent = async (id: string) => {
    const ok = await confirm({ title: "¿Eliminar comentario?", confirmText: "Eliminar", destructive: true });
    if (!ok) return;
    await (supabase as any).from("proyecto_comentarios").delete().eq("id", id);
  };

  const registrarActividad = async (accion: string, meta: any = {}) => {
    if (!user || !p) return;
    await (supabase as any).from("proyecto_actividad").insert({ proyecto_id: p.id, perfil_id: user.id, accion, meta });
  };

  const toggleSeguir = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (siguiendo) await (supabase as any).from("proyecto_seguidores").delete().eq("proyecto_id", p.id).eq("perfil_id", user.id);
    else await (supabase as any).from("proyecto_seguidores").insert({ proyecto_id: p.id, perfil_id: user.id });
    setSiguiendo(!siguiendo);
  };

  const toggleUpvote = async () => {
    if (!user) return toast.error("Iniciá sesión para votar");
    if (voted) {
      await (supabase as any).from("proyecto_upvotes").delete().eq("proyecto_id", p.id).eq("perfil_id", user.id);
      setVoted(false);
      setP({ ...p, total_upvotes: Math.max(0, (p.total_upvotes || 0) - 1) });
    } else {
      const { error } = await (supabase as any).from("proyecto_upvotes").insert({ proyecto_id: p.id, perfil_id: user.id });
      if (error) return toast.error("No se pudo registrar el voto");
      setVoted(true);
      setP({ ...p, total_upvotes: (p.total_upvotes || 0) + 1 });
    }
  };

  const crearTarea = async () => {
    if (!user || !nuevaTarea.titulo.trim()) return;
    const { error } = await (supabase as any).from("proyecto_tareas").insert({
      proyecto_id: p.id, creado_por: user.id,
      titulo: nuevaTarea.titulo, descripcion: nuevaTarea.descripcion || null,
      estado: nuevaTarea.estado, prioridad: nuevaTarea.prioridad,
      asignado_id: nuevaTarea.asignado_id || null,
      fecha_limite: nuevaTarea.fecha_limite || null,
    });
    if (error) return toast.error(error.message);
    registrarActividad("creó la tarea", { titulo: nuevaTarea.titulo });
    setNuevaTarea({ open: false, titulo: "", descripcion: "", estado: "backlog", prioridad: "media", asignado_id: "", fecha_limite: "" });
    toast.success("Tarea creada");
  };

  const moverTarea = async (id: string, estado: string) => {
    const t = tareas.find((x) => x.id === id);
    if (!t) return;
    await (supabase as any).from("proyecto_tareas").update({ estado }).eq("id", id);
    registrarActividad(`movió "${t.titulo}" a ${ESTADOS_TAREA.find((e) => e.id === estado)?.label}`, {});
  };

  const eliminarTarea = async (id: string) => {
    const t = tareas.find((x) => x.id === id);
    const ok = await confirm({ title: "¿Eliminar tarea?", description: t ? `Se eliminará "${t.titulo}".` : undefined, confirmText: "Eliminar", destructive: true });
    if (!ok) return;
    await (supabase as any).from("proyecto_tareas").delete().eq("id", id);
    if (t) registrarActividad(`eliminó "${t.titulo}"`, {});
    toast.success("Tarea eliminada");
  };

  const subirArchivo = async (file: File) => {
    if (!user || !file) return;
    setSubiendo(true);
    try {
      const path = `${user.id}/${p.id}/${Date.now()}-${file.name}`;
      const { error } = await (supabase as any).storage.from("proyectos-archivos").upload(path, file);
      if (error) throw error;
      const url = (supabase as any).storage.from("proyectos-archivos").getPublicUrl(path).data.publicUrl;
      await (supabase as any).from("proyecto_archivos").insert({
        proyecto_id: p.id, subido_por: user.id, nombre: file.name, url, storage_path: path,
        mime_type: file.type, size_bytes: file.size,
      });
      registrarActividad(`subió ${file.name}`, {});
      toast.success("Archivo subido");
    } catch (e: any) { toast.error(e.message); }
    finally { setSubiendo(false); }
  };

  const eliminarArchivo = async (a: any) => {
    const ok = await confirm({ title: "¿Eliminar archivo?", description: `Se eliminará "${a.nombre}" permanentemente.`, confirmText: "Eliminar", destructive: true });
    if (!ok) return;
    if (a.storage_path) await (supabase as any).storage.from("proyectos-archivos").remove([a.storage_path]);
    await (supabase as any).from("proyecto_archivos").delete().eq("id", a.id);
    registrarActividad(`eliminó ${a.nombre}`, {});
    toast.success("Archivo eliminado");
  };


  const tareasPorEstado = useMemo(() => {
    return ESTADOS_TAREA.map((e) => ({ ...e, tareas: tareas.filter((t) => t.estado === e.id) }));
  }, [tareas]);

  const completadas = tareas.filter((t) => t.estado === "completada").length;
  const progreso = tareas.length > 0 ? Math.round((completadas / tareas.length) * 100) : p?.progreso || 0;

  if (!p) return <p className="text-sm text-muted-foreground">Cargando…</p>;
  const est = ESTADO_PROYECTO[p.estado];

  return (
    <>
      <BackHeader title="Proyecto" />
      <div className="mx-auto max-w-6xl space-y-5">
      {/* Hero */}
      <div className="overflow-hidden rounded-2xl border bg-card">
        {p.portada_url ? (
          <div className="h-40 w-full bg-cover bg-center sm:h-48" style={{ backgroundImage: `url(${p.portada_url})` }} />
        ) : (
          <div className="h-32 w-full bg-gradient-to-br from-primary/30 via-primary/10 to-secondary" />
        )}
        <div className="space-y-3 p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <h1 className="text-2xl font-bold leading-tight tracking-tight sm:text-3xl">{p.nombre}</h1>
              <p className="mt-1 text-sm text-muted-foreground">
                por <Link className="font-medium text-foreground hover:text-primary" to={`/lin/perfil/${p.perfil?.username}`}>{p.perfil?.nombre}</Link>
                {" · "}<span>{p.total_seguidores} seguidores</span>{" · "}<span>{miembros.length} miembros</span>
              </p>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {est && <Badge className={est.color}>{est.label}</Badge>}
                {p.categoria && <Badge variant="outline">{p.categoria}</Badge>}
                {p.tags?.map((t: string) => <Badge key={t} variant="secondary">{t}</Badge>)}
              </div>
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                onClick={toggleUpvote}
                aria-pressed={voted}
                className={cn(
                  "flex h-14 w-16 flex-col items-center justify-center rounded-xl border-2 font-bold tabular-nums transition-all",
                  voted
                    ? "border-primary bg-primary text-primary-foreground shadow-ember"
                    : "border-border bg-background text-foreground hover:border-primary hover:bg-primary/5 hover:text-primary"
                )}
              >
                <Triangle className={cn("h-3.5 w-3.5", voted ? "fill-current" : "fill-none")} strokeWidth={2.5} />
                <span className="text-[13px] leading-none mt-0.5">{p.total_upvotes || 0}</span>
              </button>
              <Button variant={siguiendo ? "outline" : "default"} onClick={toggleSeguir} size="sm">
                {siguiendo ? "Siguiendo" : "Seguir"}
              </Button>
            </div>
          </div>

          {/* Progreso */}
          {(tareas.length > 0 || p.progreso > 0) && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-xs">
                <span className="font-medium">Progreso</span>
                <span className="text-muted-foreground tabular-nums">{progreso}%</span>
              </div>
              <div className="h-2 overflow-hidden rounded-full bg-secondary">
                <div className="h-full bg-gradient-to-r from-primary to-primary/60 transition-all" style={{ width: `${progreso}%` }} />
              </div>
            </div>
          )}

          {/* Links rápidos */}
          {(p.sitio_web || p.demo_url || p.repo_url) && (
            <div className="flex flex-wrap gap-2 pt-1">
              {p.sitio_web && <LinkChip href={p.sitio_web} icon={Globe} label="Sitio" />}
              {p.demo_url && <LinkChip href={p.demo_url} icon={ExternalLink} label="Demo" />}
              {p.repo_url && <LinkChip href={p.repo_url} icon={Github} label="Repo" />}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={tab} onValueChange={setTab}>
        <TabsList className="w-full justify-start gap-1 overflow-x-auto rounded-xl bg-secondary/60 p-1">
          <TabsTrigger value="overview" className="gap-1.5 rounded-lg"><Info className="h-3.5 w-3.5" />Resumen</TabsTrigger>
          <TabsTrigger value="comentarios" className="gap-1.5 rounded-lg"><MessageSquare className="h-3.5 w-3.5" />Comentarios {comentarios.length > 0 && <span className="rounded-full bg-background px-1.5 text-[10px]">{comentarios.length}</span>}</TabsTrigger>
          <TabsTrigger value="tareas" className="gap-1.5 rounded-lg"><Layers className="h-3.5 w-3.5" />Tareas {tareas.length > 0 && <span className="rounded-full bg-background px-1.5 text-[10px]">{tareas.length}</span>}</TabsTrigger>
          <TabsTrigger value="archivos" className="gap-1.5 rounded-lg"><Paperclip className="h-3.5 w-3.5" />Archivos {archivos.length > 0 && <span className="rounded-full bg-background px-1.5 text-[10px]">{archivos.length}</span>}</TabsTrigger>
          <TabsTrigger value="actividad" className="gap-1.5 rounded-lg"><Activity className="h-3.5 w-3.5" />Actividad</TabsTrigger>
        </TabsList>

        {/* OVERVIEW */}
        <TabsContent value="overview" className="space-y-4">
          {p.descripcion && (
            <Card><CardContent className="whitespace-pre-wrap p-5 text-sm leading-relaxed">{p.descripcion}</CardContent></Card>
          )}
          {p.buscando?.length > 0 && (
            <Card><CardContent className="space-y-2 p-4">
              <p className="flex items-center gap-1.5 text-sm font-semibold"><Sparkles className="h-4 w-4 text-primary" />Buscando</p>
              <div className="flex flex-wrap gap-1.5">{p.buscando.map((b: string) => <Badge key={b} variant="secondary">{b}</Badge>)}</div>
            </CardContent></Card>
          )}
          <Card><CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Equipo ({miembros.length})</h2>
            {miembros.length === 0 ? <p className="text-xs text-muted-foreground">Aún sin miembros.</p>
              : <div className="flex flex-wrap gap-2">{miembros.map((m) => (
                <Link key={m.id} to={`/lin/perfil/${m.perfil.username}`} className="flex items-center gap-2 rounded-full border bg-secondary/40 px-2 py-1 hover:border-primary/50">
                  <Avatar className="h-6 w-6"><AvatarImage src={m.perfil.avatar_url || ""} /><AvatarFallback className="text-[10px]">{initials(m.perfil.nombre)}</AvatarFallback></Avatar>
                  <span className="text-xs">{m.perfil.nombre}</span>
                  {m.es_fundador && <Badge variant="outline" className="h-4 px-1 text-[9px]">Fundador</Badge>}
                </Link>
              ))}</div>}
          </CardContent></Card>
          <Card><CardContent className="space-y-3 p-4">
            <h2 className="text-sm font-semibold">Updates ({updates.length})</h2>
            {updates.length === 0 ? <p className="text-xs text-muted-foreground">Sin updates aún.</p>
              : updates.map((u) => <div key={u.id} className="border-t pt-2 first:border-0 first:pt-0"><p className="text-sm font-medium">{u.titulo}</p><p className="text-sm text-muted-foreground">{u.contenido}</p></div>)}
          </CardContent></Card>
        </TabsContent>

        {/* COMENTARIOS */}
        <TabsContent value="comentarios" className="space-y-4">
          <Card>
            <CardContent className="space-y-3 p-4">
              <div className="flex items-start gap-2">
                <Avatar className="h-8 w-8 shrink-0">
                  <AvatarImage src={user?.user_metadata?.avatar_url || ""} />
                  <AvatarFallback className="text-xs">{initials((user?.user_metadata as any)?.nombre || "Yo")}</AvatarFallback>
                </Avatar>
                <div className="flex-1 space-y-2">
                  <Textarea
                    placeholder={user ? "Compartí tu opinión, feedback o pregunta…" : "Iniciá sesión para comentar"}
                    rows={3}
                    value={nuevoComent}
                    onChange={(e) => setNuevoComent(e.target.value)}
                    disabled={!user}
                    className="resize-none"
                  />
                  <div className="flex items-center justify-between">
                    <p className="text-[11px] text-muted-foreground">{nuevoComent.length}/4000</p>
                    <Button size="sm" onClick={enviarComentario} disabled={!user || !nuevoComent.trim()}>
                      <Send className="h-3.5 w-3.5" />Publicar
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {comentarios.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              <MessageSquare className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Sé el primero en comentar este proyecto.
            </CardContent></Card>
          ) : (
            <ul className="space-y-3">
              {comentarios.map((c) => {
                const esAutor = user?.id === c.perfil_id;
                const enEdicion = editandoComent?.id === c.id;
                return (
                  <li key={c.id} className="rounded-xl border bg-card p-3">
                    <div className="flex items-start gap-2.5">
                      <Link to={`/lin/perfil/${c.perfil?.username}`} className="shrink-0">
                        <Avatar className="h-8 w-8"><AvatarImage src={c.perfil?.avatar_url || ""} /><AvatarFallback className="text-[10px]">{initials(c.perfil?.nombre)}</AvatarFallback></Avatar>
                      </Link>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Link to={`/lin/perfil/${c.perfil?.username}`} className="text-sm font-semibold hover:text-primary">{c.perfil?.nombre}</Link>
                          {c.perfil?.verificado && <span className="text-xs text-primary">✓</span>}
                          <span className="text-[11px] text-muted-foreground">· {formatTime(c.created_at)}{c.editado_at && " · editado"}</span>
                          {esAutor && !enEdicion && (
                            <div className="ml-auto flex items-center gap-1">
                              <button onClick={() => setEditandoComent({ id: c.id, texto: c.contenido })} className="text-muted-foreground hover:text-foreground" aria-label="Editar">
                                <Pencil className="h-3.5 w-3.5" />
                              </button>
                              <button onClick={() => eliminarComent(c.id)} className="text-muted-foreground hover:text-rose-500" aria-label="Eliminar">
                                <Trash2 className="h-3.5 w-3.5" />
                              </button>
                            </div>
                          )}
                        </div>
                        {enEdicion ? (
                          <div className="mt-1.5 space-y-2">
                            <Textarea
                              rows={3} value={editandoComent.texto}
                              onChange={(e) => setEditandoComent({ ...editandoComent, texto: e.target.value })}
                              className="resize-none"
                            />
                            <div className="flex justify-end gap-2">
                              <Button size="sm" variant="ghost" onClick={() => setEditandoComent(null)}>Cancelar</Button>
                              <Button size="sm" onClick={guardarEdicionComent}>Guardar</Button>
                            </div>
                          </div>
                        ) : (
                          <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed">{c.contenido}</p>
                        )}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </TabsContent>

        {/* TAREAS — Kanban */}
        <TabsContent value="tareas">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Tablero de tareas</h2>
              <p className="text-xs text-muted-foreground">{completadas}/{tareas.length} completadas</p>
            </div>
            {esMiembro && (
              <Dialog open={nuevaTarea.open} onOpenChange={(o) => setNuevaTarea({ ...nuevaTarea, open: o })}>
                <DialogTrigger asChild>
                  <Button size="sm"><Plus className="h-4 w-4" />Nueva tarea</Button>
                </DialogTrigger>
                <DialogContent className="max-w-md">
                  <DialogHeader><DialogTitle>Nueva tarea</DialogTitle></DialogHeader>
                  <div className="space-y-3">
                    <Input placeholder="Título" value={nuevaTarea.titulo} onChange={(e) => setNuevaTarea({ ...nuevaTarea, titulo: e.target.value })} />
                    <Textarea placeholder="Descripción (opcional)" rows={3} value={nuevaTarea.descripcion} onChange={(e) => setNuevaTarea({ ...nuevaTarea, descripcion: e.target.value })} />
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={nuevaTarea.estado} onValueChange={(v) => setNuevaTarea({ ...nuevaTarea, estado: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{ESTADOS_TAREA.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}</SelectContent>
                      </Select>
                      <Select value={nuevaTarea.prioridad} onValueChange={(v) => setNuevaTarea({ ...nuevaTarea, prioridad: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(PRIORIDADES).map(([k, v]) => <SelectItem key={k} value={k}>{v.label}</SelectItem>)}</SelectContent>
                      </Select>
                    </div>
                    <Select value={nuevaTarea.asignado_id || "none"} onValueChange={(v) => setNuevaTarea({ ...nuevaTarea, asignado_id: v === "none" ? "" : v })}>
                      <SelectTrigger><SelectValue placeholder="Asignar a…" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">Sin asignar</SelectItem>
                        {miembros.map((m) => <SelectItem key={m.perfil.id} value={m.perfil.id}>{m.perfil.nombre}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    <Input type="date" value={nuevaTarea.fecha_limite} onChange={(e) => setNuevaTarea({ ...nuevaTarea, fecha_limite: e.target.value })} />
                  </div>
                  <DialogFooter><Button onClick={crearTarea}>Crear tarea</Button></DialogFooter>
                </DialogContent>
              </Dialog>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            {tareasPorEstado.map((col) => (
              <div key={col.id} className="rounded-xl bg-secondary/40 p-2">
                <div className="mb-2 flex items-center justify-between px-2 pt-1">
                  <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-semibold", col.color)}>
                    {col.label}
                    <span className="rounded-full bg-background/60 px-1.5 text-[10px]">{col.tareas.length}</span>
                  </span>
                </div>
                <div className="space-y-2">
                  {col.tareas.length === 0 ? (
                    <div className="rounded-lg border border-dashed py-6 text-center text-[11px] text-muted-foreground">Vacío</div>
                  ) : col.tareas.map((t) => {
                    const pri = PRIORIDADES[t.prioridad] || PRIORIDADES.media;
                    return (
                      <div key={t.id} className="group rounded-lg border bg-background p-3 shadow-sm transition-all hover:border-primary/40 hover:shadow-md">
                        <div className="flex items-start justify-between gap-2">
                          <p className="flex-1 text-sm font-medium leading-snug">{t.titulo}</p>
                          {esMiembro && (
                            <button onClick={() => eliminarTarea(t.id)} className="opacity-0 transition-opacity group-hover:opacity-100">
                              <Trash2 className="h-3 w-3 text-muted-foreground hover:text-rose-500" />
                            </button>
                          )}
                        </div>
                        {t.descripcion && <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{t.descripcion}</p>}
                        <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px]">
                          <span className={cn("inline-flex items-center gap-0.5", pri.color)}><Flag className="h-3 w-3" />{pri.label}</span>
                          {t.fecha_limite && <span className="inline-flex items-center gap-0.5 text-muted-foreground"><Calendar className="h-3 w-3" />{new Date(t.fecha_limite).toLocaleDateString()}</span>}
                          {t.asignado && (
                            <Avatar className="ml-auto h-5 w-5"><AvatarImage src={t.asignado.avatar_url || ""} /><AvatarFallback className="text-[8px]">{initials(t.asignado.nombre)}</AvatarFallback></Avatar>
                          )}
                        </div>
                        {esMiembro && (
                          <Select value={t.estado} onValueChange={(v) => moverTarea(t.id, v)}>
                            <SelectTrigger className="mt-2 h-7 text-[11px]"><SelectValue /></SelectTrigger>
                            <SelectContent>{ESTADOS_TAREA.map((e) => <SelectItem key={e.id} value={e.id}>{e.label}</SelectItem>)}</SelectContent>
                          </Select>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </TabsContent>

        {/* ARCHIVOS */}
        <TabsContent value="archivos">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h2 className="font-semibold">Archivos del proyecto</h2>
              <p className="text-xs text-muted-foreground">{archivos.length} {archivos.length === 1 ? "archivo" : "archivos"}</p>
            </div>
            {esMiembro && (
              <label className={cn("inline-flex cursor-pointer items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90", subiendo && "opacity-60")}>
                <Upload className="h-3.5 w-3.5" />{subiendo ? "Subiendo…" : "Subir archivo"}
                <input type="file" className="hidden" disabled={subiendo} onChange={(e) => e.target.files?.[0] && subirArchivo(e.target.files[0])} />
              </label>
            )}
          </div>
          {archivos.length === 0 ? (
            <Card><CardContent className="py-12 text-center text-sm text-muted-foreground">
              <Paperclip className="mx-auto mb-2 h-8 w-8 opacity-40" />
              Aún no hay archivos subidos.
            </CardContent></Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {archivos.map((a) => (
                <div key={a.id} className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <FileIcon className="h-5 w-5" />
                  </div>
                  <a href={a.url} target="_blank" rel="noreferrer" className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium hover:text-primary">{a.nombre}</p>
                    <p className="text-[11px] text-muted-foreground">
                      {a.size_bytes ? `${(a.size_bytes / 1024).toFixed(0)} KB · ` : ""}{a.perfil?.nombre} · {formatTime(a.created_at)}
                    </p>
                  </a>
                  {(user?.id === a.subido_por || user?.id === p.perfil_id) && (
                    <button onClick={() => eliminarArchivo(a)} className="opacity-0 transition-opacity group-hover:opacity-100">
                      <Trash2 className="h-3.5 w-3.5 text-muted-foreground hover:text-rose-500" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </TabsContent>

        {/* ACTIVIDAD */}
        <TabsContent value="actividad">
          <Card><CardContent className="p-0">
            {actividad.length === 0 ? (
              <div className="py-12 text-center text-sm text-muted-foreground">
                <Activity className="mx-auto mb-2 h-8 w-8 opacity-40" />
                Sin actividad todavía.
              </div>
            ) : (
              <ul className="divide-y">
                {actividad.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 px-4 py-3">
                    <Avatar className="h-7 w-7"><AvatarImage src={a.perfil?.avatar_url || ""} /><AvatarFallback className="text-[10px]">{initials(a.perfil?.nombre || "??")}</AvatarFallback></Avatar>
                    <p className="flex-1 text-sm">
                      <Link to={`/lin/perfil/${a.perfil?.username}`} className="font-semibold hover:text-primary">{a.perfil?.nombre}</Link>{" "}
                      <span className="text-muted-foreground">{a.accion}</span>
                    </p>
                    <span className="text-[11px] text-muted-foreground">{formatTime(a.created_at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent></Card>
        </TabsContent>
      </Tabs>
    </div>
    </>
  );
}

function LinkChip({ href, icon: Icon, label }: any) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1.5 rounded-full border bg-secondary/40 px-3 py-1 text-xs font-medium transition-colors hover:border-primary hover:text-primary">
      <Icon className="h-3.5 w-3.5" />{label}
    </a>
  );
}
