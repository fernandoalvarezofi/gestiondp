import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useParams, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { ImagePlus, X, Users, Hash, Plus, Send, Settings, Crown, ChevronDown, ChevronRight, Volume2, SmilePlus, Pin, Reply, Megaphone, Shield, Pencil, Trash2, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetTrigger, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { initials, formatTime } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { useConfirm } from "@/components/lin/ConfirmDialog";
import { cn } from "@/lib/utils";

const QUICK_EMOJI = ["👍", "❤️", "🔥", "🎉", "😂", "😮", "😢", "🙏"];

export default function ComunidadDetalle() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const confirm = useConfirm();
  const { user } = useAuth();
  const [c, setC] = useState<any>(null);
  const [categorias, setCategorias] = useState<any[]>([]);
  const [canales, setCanales] = useState<any[]>([]);
  const [canalActivo, setCanalActivo] = useState<string | null>(null);
  const [posts, setPosts] = useState<any[]>([]);
  const [miembros, setMiembros] = useState<any[]>([]);
  const [roles, setRoles] = useState<any[]>([]);
  const [reacciones, setReacciones] = useState<any[]>([]);
  const [esMiembro, setEsMiembro] = useState(false);
  const [txt, setTxt] = useState("");
  const [imagen, setImagen] = useState<File | null>(null);
  const [preview, setPreview] = useState("");
  const [posting, setPosting] = useState(false);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [respondiendoA, setRespondiendoA] = useState<any | null>(null);
  const [nuevoCanal, setNuevoCanal] = useState({ open: false, nombre: "", topic: "", categoria_id: "" });
  const [editandoMsg, setEditandoMsg] = useState<string | null>(null);
  const [editMsgTxt, setEditMsgTxt] = useState("");
  const [adminOpen, setAdminOpen] = useState(false);
  const [adminForm, setAdminForm] = useState({ nombre: "", descripcion: "", tematica: "otro", privada: false });
  const [savingAdmin, setSavingAdmin] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const editarMsg = async (postId: string) => {
    if (!editMsgTxt.trim()) return;
    const { error } = await (supabase as any).from("comunidad_posts")
      .update({ contenido: editMsgTxt, editado_at: new Date().toISOString() })
      .eq("id", postId);
    if (error) return toast.error(error.message);
    setEditandoMsg(null);
    setEditMsgTxt("");
  };

  const borrarMsg = async (postId: string) => {
    const { error } = await (supabase as any).from("comunidad_posts").delete().eq("id", postId).eq("perfil_id", user?.id);
    if (error) return toast.error(error.message);
    toast.success("Mensaje eliminado");
  };

  const esCreador = user?.id === c?.creador_id;

  const eliminarComunidad = async () => {
    if (!esCreador) return;
    const ok = await confirm({
      title: `¿Eliminar "${c.nombre}"?`,
      description: "Se eliminarán todos los canales, posts y miembros. Esta acción no se puede deshacer.",
      confirmText: "Eliminar comunidad",
      destructive: true,
    });
    if (!ok) return;
    const { error } = await (supabase as any).rpc("delete_community_as_owner", { _community_id: c.id });
    if (error) return toast.error(error.message);
    toast.success("Comunidad eliminada");
    navigate("/lin/hub?tab=comunidades");
  };

  const abrirAdmin = () => {
    setAdminForm({
      nombre: c.nombre || "",
      descripcion: c.descripcion || "",
      tematica: c.tematica || "otro",
      privada: !!c.privada,
    });
    setAdminOpen(true);
  };

  const guardarAdmin = async () => {
    if (!esCreador) return;
    setSavingAdmin(true);
    const { error } = await (supabase as any).from("comunidades")
      .update({
        nombre: adminForm.nombre,
        descripcion: adminForm.descripcion,
        tematica: adminForm.tematica,
        privada: adminForm.privada,
      })
      .eq("id", c.id)
      .eq("creador_id", user!.id);
    setSavingAdmin(false);
    if (error) return toast.error(error.message);
    setC({ ...c, ...adminForm });
    toast.success("Cambios guardados");
  };

  const load = async () => {
    const { data } = await (supabase as any).from("comunidades").select("*").eq("slug", slug).single();
    if (!data) return;
    setC(data);
    const [{ data: cats }, { data: cans }, { data: ms }, { data: rs }] = await Promise.all([
      (supabase as any).from("comunidad_categorias").select("*").eq("comunidad_id", data.id).order("orden"),
      (supabase as any).from("comunidad_canales").select("*").eq("comunidad_id", data.id).order("orden"),
      (supabase as any).from("comunidad_miembros")
        .select("rol, nickname, rol_id, perfil:perfiles!perfil_id(id,nombre,username,avatar_url,verificado)")
        .eq("comunidad_id", data.id).limit(120),
      (supabase as any).from("comunidad_roles").select("*").eq("comunidad_id", data.id).order("orden"),
    ]);
    setCategorias(cats || []);
    setCanales(cans || []);
    setMiembros(ms || []);
    setRoles(rs || []);
    if (cans?.length && !canalActivo) setCanalActivo(cans[0].id);
    if (user) {
      const { data: m } = await (supabase as any).from("comunidad_miembros").select("id").eq("comunidad_id", data.id).eq("perfil_id", user.id).maybeSingle();
      setEsMiembro(!!m);
    }
  };

  const loadPosts = async () => {
    if (!c || !canalActivo) return;
    const { data } = await (supabase as any).from("comunidad_posts")
      .select("*, perfil:perfiles!perfil_id(id,nombre,username,avatar_url,verificado)")
      .eq("comunidad_id", c.id).eq("canal_id", canalActivo)
      .order("created_at", { ascending: true }).limit(200);
    setPosts(data || []);
    const ids = (data || []).map((p: any) => p.id);
    if (ids.length) {
      const { data: r } = await (supabase as any).from("comunidad_post_reacciones").select("*").in("post_id", ids);
      setReacciones(r || []);
    } else setReacciones([]);
    setTimeout(() => endRef.current?.scrollIntoView({ behavior: "smooth" }), 50);
  };

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [slug, user]);
  useEffect(() => { loadPosts(); /* eslint-disable-next-line */ }, [c?.id, canalActivo]);

  useEffect(() => {
    if (!c) return;
    const ch = (supabase as any).channel(`com_${c.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "comunidad_posts", filter: `comunidad_id=eq.${c.id}` }, loadPosts)
      .on("postgres_changes", { event: "*", schema: "public", table: "comunidad_post_reacciones" }, loadPosts)
      .on("postgres_changes", { event: "*", schema: "public", table: "comunidad_miembros", filter: `comunidad_id=eq.${c.id}` }, load)
      .on("postgres_changes", { event: "*", schema: "public", table: "comunidad_canales", filter: `comunidad_id=eq.${c.id}` }, load)
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
    // eslint-disable-next-line
  }, [c?.id, canalActivo]);

  const toggleUnirme = async () => {
    if (!user) return toast.error("Iniciá sesión");
    if (esMiembro) await (supabase as any).from("comunidad_miembros").delete().eq("comunidad_id", c.id).eq("perfil_id", user.id);
    else await (supabase as any).from("comunidad_miembros").insert({ comunidad_id: c.id, perfil_id: user.id });
    setEsMiembro(!esMiembro);
  };

  const pickImage = (file: File | null) => { setImagen(file); setPreview(file ? URL.createObjectURL(file) : ""); };

  const postear = async () => {
    if (!txt.trim() && !imagen) return;
    setPosting(true);
    try {
      let imagen_url: string | null = null;
      if (imagen) {
        const path = `${user!.id}/${Date.now()}-${imagen.name}`;
        const { error } = await (supabase as any).storage.from("publicaciones").upload(path, imagen);
        if (error) throw error;
        imagen_url = (supabase as any).storage.from("publicaciones").getPublicUrl(path).data.publicUrl;
      }
      const { error } = await (supabase as any).from("comunidad_posts").insert({
        comunidad_id: c.id, perfil_id: user!.id, canal_id: canalActivo,
        contenido: txt || "", imagen_url, respuesta_a: respondiendoA?.id || null,
      });
      if (error) throw error;
      setTxt(""); pickImage(null); setRespondiendoA(null);
    } catch (e: any) { toast.error(e.message || "Error al postear"); }
    finally { setPosting(false); }
  };

  const toggleReact = async (postId: string, emoji: string) => {
    if (!user) return toast.error("Iniciá sesión");
    const existente = reacciones.find((r) => r.post_id === postId && r.perfil_id === user.id && r.emoji === emoji);
    if (existente) await (supabase as any).from("comunidad_post_reacciones").delete().eq("id", existente.id);
    else await (supabase as any).from("comunidad_post_reacciones").insert({ post_id: postId, perfil_id: user.id, emoji });
  };

  const crearCanal = async () => {
    if (!nuevoCanal.nombre.trim() || !esCreador) return;
    const orden = canales.length;
    await (supabase as any).from("comunidad_canales").insert({
      comunidad_id: c.id, nombre: nuevoCanal.nombre.toLowerCase().replace(/\s+/g, "-"),
      topic: nuevoCanal.topic || null, categoria_id: nuevoCanal.categoria_id || null, orden,
    });
    setNuevoCanal({ open: false, nombre: "", topic: "", categoria_id: "" });
    toast.success("Canal creado");
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postear(); }
  };

  // Agrupar canales por categoría
  const canalesAgrupados = useMemo(() => {
    const sinCat = canales.filter((x) => !x.categoria_id);
    const conCat = categorias.map((cat) => ({
      ...cat, canales: canales.filter((x) => x.categoria_id === cat.id),
    }));
    return { sinCat, conCat };
  }, [canales, categorias]);

  // Miembros por rol
  const miembrosAgrupados = useMemo(() => {
    const conRol = roles.map((r) => ({
      rol: r, miembros: miembros.filter((m) => m.rol_id === r.id),
    })).filter((g) => g.miembros.length > 0);
    const sinRol = miembros.filter((m) => !m.rol_id);
    const admins = miembros.filter((m) => m.rol === "admin");
    return { admins, conRol, sinRol };
  }, [miembros, roles]);

  if (!c) return <p className="text-sm text-muted-foreground">Cargando…</p>;

  const canalActual = canales.find((x) => x.id === canalActivo);
  const canalNombre = canalActual?.nombre || "general";

  // Reacciones agrupadas por post+emoji
  const reaccionesPorPost = (postId: string) => {
    const r = reacciones.filter((x) => x.post_id === postId);
    const grouped: Record<string, { count: number; mine: boolean }> = {};
    r.forEach((x) => {
      if (!grouped[x.emoji]) grouped[x.emoji] = { count: 0, mine: false };
      grouped[x.emoji].count++;
      if (user?.id === x.perfil_id) grouped[x.emoji].mine = true;
    });
    return Object.entries(grouped);
  };

  const Sidebar = () => (
    <>
      {/* Header comunidad */}
      <div className="border-b bg-background/60 p-3 backdrop-blur">
        <Link to="/lin/comunidades" className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">← Comunidades</Link>
        <div className="mt-2 flex items-center gap-2">
          {c.avatar_url
            ? <img src={c.avatar_url} className="h-9 w-9 rounded-xl object-cover" alt="" />
            : <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-sm font-bold text-primary">{c.nombre?.[0]}</div>}
          <div className="min-w-0 flex-1">
            <h2 className="truncate text-sm font-bold leading-tight">{c.nombre}</h2>
            <p className="truncate text-[10px] text-muted-foreground">{c.total_miembros} miembros</p>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-2">
        {/* Canales sin categoría */}
        {canalesAgrupados.sinCat.map((ch) => (
          <CanalBtn key={ch.id} ch={ch} active={canalActivo === ch.id} onClick={() => setCanalActivo(ch.id)} />
        ))}

        {/* Categorías */}
        {canalesAgrupados.conCat.map((cat) => (
          <div key={cat.id} className="mt-3">
            <button onClick={() => setCollapsed({ ...collapsed, [cat.id]: !collapsed[cat.id] })}
              className="flex w-full items-center gap-1 px-1 py-1 text-[10px] font-bold uppercase tracking-wider text-muted-foreground hover:text-foreground">
              {collapsed[cat.id] ? <ChevronRight className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              <span className="flex-1 truncate text-left">{cat.nombre}</span>
            </button>
            {!collapsed[cat.id] && cat.canales.map((ch: any) => (
              <CanalBtn key={ch.id} ch={ch} active={canalActivo === ch.id} onClick={() => setCanalActivo(ch.id)} />
            ))}
          </div>
        ))}

        {esCreador && (
          <Dialog open={nuevoCanal.open} onOpenChange={(o) => setNuevoCanal({ ...nuevoCanal, open: o })}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="sm" className="mt-2 w-full justify-start text-xs text-muted-foreground"><Plus className="h-3.5 w-3.5" />Crear canal</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>Nuevo canal</DialogTitle></DialogHeader>
              <div className="space-y-3">
                <Input placeholder="nombre-canal" value={nuevoCanal.nombre} onChange={(e) => setNuevoCanal({ ...nuevoCanal, nombre: e.target.value })} />
                <Input placeholder="Topic (opcional)" value={nuevoCanal.topic} onChange={(e) => setNuevoCanal({ ...nuevoCanal, topic: e.target.value })} />
              </div>
              <DialogFooter><Button onClick={crearCanal}>Crear</Button></DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      <div className="border-t bg-background/60 p-2 backdrop-blur">
        <Button onClick={toggleUnirme} size="sm" variant={esMiembro ? "outline" : "default"} className="w-full">
          {esMiembro ? "Salir de la comunidad" : "Unirme"}
        </Button>
      </div>
    </>
  );

  const Roster = () => (
    <>
      <div className="border-b p-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Miembros — {miembros.length}</p>
      </div>
      <div className="flex-1 space-y-3 overflow-y-auto p-2">
        {miembrosAgrupados.admins.length > 0 && (
          <RosterGroup label="Admin" color="#f59e0b" miembros={miembrosAgrupados.admins} adminIcon />
        )}
        {miembrosAgrupados.conRol.map((g) => (
          <RosterGroup key={g.rol.id} label={g.rol.nombre} color={g.rol.color} miembros={g.miembros} />
        ))}
        {miembrosAgrupados.sinRol.filter((m) => m.rol !== "admin").length > 0 && (
          <RosterGroup label="Miembros" color="#94a3b8" miembros={miembrosAgrupados.sinRol.filter((m) => m.rol !== "admin")} />
        )}
      </div>
    </>
  );

  return (
    <>
    <div className="-mx-4 -my-4 md:-mx-6 md:-my-6">
    <div className="mx-auto grid h-[calc(100vh-3.5rem)] max-w-[1600px] grid-cols-1 gap-0 overflow-hidden border-y bg-background lg:h-[calc(100vh-3.5rem)] lg:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-[240px_minmax(0,1fr)_260px]">
      {/* Sidebar canales — visible desde lg */}
      <aside className="hidden flex-col border-r bg-secondary/40 lg:flex">
        <Sidebar />
      </aside>

      {/* Chat principal */}
      <main className="flex min-h-0 flex-col">
        <header className="flex items-center justify-between gap-2 border-b bg-background/60 px-4 py-2.5 backdrop-blur">
          <div className="flex min-w-0 items-center gap-2">
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 lg:hidden" aria-label="Canales"><Hash className="h-4 w-4" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 p-0"><div className="flex h-full flex-col"><Sidebar /></div></SheetContent>
            </Sheet>
            <Hash className="hidden h-5 w-5 shrink-0 text-muted-foreground lg:block" />
            <div className="min-w-0">
              <h1 className="truncate font-bold leading-tight">{canalNombre}</h1>
              {canalActual?.topic && <p className="truncate text-[11px] text-muted-foreground">{canalActual.topic}</p>}
            </div>
          </div>
          <div className="flex items-center gap-1">
            {esCreador && (
              <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2 text-muted-foreground hover:text-foreground" onClick={abrirAdmin} aria-label="Administrar comunidad">
                <Settings className="h-4 w-4" /><span className="hidden sm:inline">Administrar</span>
              </Button>
            )}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="h-8 w-8 xl:hidden" aria-label="Miembros"><Users className="h-4 w-4" /></Button>
              </SheetTrigger>
              <SheetContent side="right" className="w-72 p-0"><div className="flex h-full flex-col"><Roster /></div></SheetContent>
            </Sheet>
          </div>
        </header>

        <div className="flex-1 space-y-0.5 overflow-y-auto px-3 py-3">
          {posts.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center text-center text-muted-foreground">
              <div className="mb-3 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10">
                <Hash className="h-8 w-8 text-primary" />
              </div>
              <p className="font-bold text-foreground">Bienvenido a #{canalNombre}</p>
              <p className="mt-1 text-xs">Este es el comienzo de la conversación.</p>
              {canalActual?.topic && <p className="mt-2 max-w-sm text-xs italic">{canalActual.topic}</p>}
            </div>
          ) : posts.map((p, i) => {
            const prev = posts[i - 1];
            const grouped = prev && prev.perfil?.id === p.perfil?.id && !p.respuesta_a &&
              (new Date(p.created_at).getTime() - new Date(prev.created_at).getTime() < 5 * 60_000);
            const padre = p.respuesta_a ? posts.find((x) => x.id === p.respuesta_a) : null;
            const reacts = reaccionesPorPost(p.id);
            return (
              <div key={p.id} className={cn("group relative flex gap-3 rounded-md px-2 py-0.5 hover:bg-secondary/40", grouped ? "" : "mt-3", p.fijado && "border-l-2 border-amber-500 bg-amber-500/5")}>
                {/* Quick actions */}
                <div className="absolute -top-3 right-3 hidden gap-0.5 rounded-md border bg-background p-0.5 shadow-sm group-hover:flex">
                  <Popover>
                    <PopoverTrigger asChild>
                      <button className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"><SmilePlus className="h-3.5 w-3.5" /></button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-1.5">
                      <div className="flex gap-0.5">
                        {QUICK_EMOJI.map((e) => (
                          <button key={e} onClick={() => toggleReact(p.id, e)} className="rounded p-1 text-lg hover:bg-secondary">{e}</button>
                        ))}
                      </div>
                    </PopoverContent>
                  </Popover>
                  <button onClick={() => setRespondiendoA(p)} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Responder">
                    <Reply className="h-3.5 w-3.5" />
                  </button>
                  {user?.id === p.perfil_id && (
                    <>
                      <button onClick={() => { setEditandoMsg(p.id); setEditMsgTxt(p.contenido || ""); }} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" title="Editar">
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button onClick={() => borrarMsg(p.id)} className="rounded p-1 text-muted-foreground hover:bg-rose-500/10 hover:text-rose-600" title="Eliminar">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>

                <div className="w-10 shrink-0">
                  {!grouped && (
                    <Avatar className="h-10 w-10">
                      <AvatarImage src={p.perfil?.avatar_url || ""} />
                      <AvatarFallback className="text-xs">{initials(p.perfil?.nombre || "??")}</AvatarFallback>
                    </Avatar>
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  {padre && (
                    <div className="mb-0.5 flex items-center gap-1 truncate text-[11px] text-muted-foreground">
                      <Reply className="h-3 w-3 rotate-180" />
                      <span className="font-semibold">{padre.perfil?.nombre}</span>
                      <span className="truncate opacity-70">{padre.contenido}</span>
                    </div>
                  )}
                  {!grouped && (
                    <div className="flex items-baseline gap-2">
                      <Link to={`/lin/perfil/${p.perfil?.username}`} className="text-sm font-semibold hover:underline">{p.perfil?.nombre}</Link>
                      <span className="text-[10px] text-muted-foreground">{formatTime(p.created_at)}</span>
                      {p.fijado && <Pin className="h-3 w-3 text-amber-600" />}
                    </div>
                  )}
                  {editandoMsg === p.id ? (
                    <div className="mt-1 space-y-1.5">
                      <Textarea value={editMsgTxt} onChange={(e) => setEditMsgTxt(e.target.value)} rows={2} className="resize-none text-sm" autoFocus />
                      <div className="flex gap-1">
                        <Button size="sm" variant="ghost" className="h-6 px-2 text-xs" onClick={() => setEditandoMsg(null)}><X className="h-3 w-3" /></Button>
                        <Button size="sm" className="h-6 px-2 text-xs" onClick={() => editarMsg(p.id)}><Check className="h-3 w-3" /></Button>
                      </div>
                    </div>
                  ) : (
                    p.contenido && (
                      <p className="whitespace-pre-wrap text-sm leading-relaxed">
                        {p.contenido}
                        {p.editado_at && <span className="ml-1 text-[10px] text-muted-foreground/70">(editado)</span>}
                      </p>
                    )
                  )}
                  {p.imagen_url && (
                    <a href={p.imagen_url} target="_blank" rel="noreferrer" className="mt-1 block w-fit">
                      <img src={p.imagen_url} alt="" loading="lazy" className="max-h-64 rounded-lg border object-cover" />
                    </a>
                  )}
                  {reacts.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1">
                      {reacts.map(([emoji, info]) => (
                        <button key={emoji} onClick={() => toggleReact(p.id, emoji)}
                          className={cn("flex items-center gap-1 rounded-full border px-1.5 py-0.5 text-xs transition-colors",
                            info.mine ? "border-primary bg-primary/10 text-primary" : "border-border bg-secondary hover:bg-secondary/80")}>
                          <span>{emoji}</span>
                          <span className="font-semibold tabular-nums">{info.count}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>

        {/* Composer */}
        {esMiembro ? (
          <div className="border-t bg-background p-3">
            {respondiendoA && (
              <div className="mb-2 flex items-center gap-2 rounded-md border-l-2 border-primary bg-secondary/60 px-2 py-1 text-xs">
                <Reply className="h-3 w-3 text-primary" />
                Respondiendo a <span className="font-semibold">{respondiendoA.perfil?.nombre}</span>
                <span className="truncate text-muted-foreground">{respondiendoA.contenido}</span>
                <button onClick={() => setRespondiendoA(null)} className="ml-auto text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
              </div>
            )}
            {preview && (
              <div className="relative mb-2 inline-block">
                <img src={preview} alt="" className="max-h-32 rounded-lg border object-cover" />
                <Button size="icon" variant="secondary" className="absolute -right-2 -top-2 h-6 w-6 rounded-full" onClick={() => pickImage(null)}>
                  <X className="h-3 w-3" />
                </Button>
              </div>
            )}
            <div className="flex items-end gap-2 rounded-2xl border bg-secondary/40 px-3 py-2">
              <label className="cursor-pointer text-muted-foreground hover:text-foreground">
                <ImagePlus className="h-5 w-5" />
                <input type="file" accept="image/*" className="hidden" onChange={(e) => pickImage(e.target.files?.[0] || null)} />
              </label>
              <Textarea
                value={txt} onChange={(e) => setTxt(e.target.value)} onKeyDown={handleKey}
                placeholder={`Mensaje en #${canalNombre}`} rows={1}
                className="min-h-[36px] flex-1 resize-none border-0 bg-transparent p-0 text-sm shadow-none focus-visible:ring-0"
              />
              <Popover>
                <PopoverTrigger asChild>
                  <button className="text-muted-foreground hover:text-foreground"><SmilePlus className="h-5 w-5" /></button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-1.5" align="end">
                  <div className="flex gap-0.5">
                    {QUICK_EMOJI.map((e) => (
                      <button key={e} onClick={() => setTxt(txt + e)} className="rounded p-1 text-lg hover:bg-secondary">{e}</button>
                    ))}
                  </div>
                </PopoverContent>
              </Popover>
              <Button onClick={postear} size="icon" disabled={posting || (!txt.trim() && !imagen)} className="h-8 w-8 shrink-0 rounded-full">
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div className="border-t bg-secondary/40 p-4 text-center">
            <p className="text-sm text-muted-foreground">Unite a la comunidad para participar</p>
            <Button onClick={toggleUnirme} size="sm" className="mt-2">Unirme</Button>
          </div>
        )}
      </main>

      {/* Roster — visible solo desde xl */}
      <aside className="hidden flex-col border-l bg-secondary/40 xl:flex">
        <Roster />
      </aside>
    </div>
    </div>

    {/* Sheet de administración (solo creador) */}
    <Sheet open={adminOpen} onOpenChange={setAdminOpen}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader><SheetTitle>Administrar comunidad</SheetTitle></SheetHeader>
        <div className="mt-4 space-y-5">
          <section className="space-y-3">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Información</p>
            <div className="space-y-1.5">
              <Label htmlFor="adm-nombre" className="text-xs">Nombre</Label>
              <Input id="adm-nombre" value={adminForm.nombre} onChange={(e) => setAdminForm({ ...adminForm, nombre: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="adm-desc" className="text-xs">Descripción</Label>
              <Textarea id="adm-desc" rows={3} value={adminForm.descripcion} onChange={(e) => setAdminForm({ ...adminForm, descripcion: e.target.value })} />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Temática</Label>
              <Select value={adminForm.tematica} onValueChange={(v) => setAdminForm({ ...adminForm, tematica: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {["tecnologia","emprendimiento","diseño","marketing","finanzas","salud","educacion","entretenimiento","otro"].map((t) => (
                    <SelectItem key={t} value={t}>{t}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between rounded-lg border p-3">
              <div>
                <Label htmlFor="adm-priv" className="text-sm">Comunidad privada</Label>
                <p className="text-xs text-muted-foreground">Solo miembros aprobados pueden ver el contenido.</p>
              </div>
              <Switch id="adm-priv" checked={adminForm.privada} onCheckedChange={(v) => setAdminForm({ ...adminForm, privada: v })} />
            </div>
            <Button onClick={guardarAdmin} disabled={savingAdmin} className="w-full">
              {savingAdmin ? "Guardando…" : "Guardar cambios"}
            </Button>
          </section>

          <div className="h-px bg-border" />

          <section className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-destructive">Zona de peligro</p>
            <div className="space-y-3 rounded-xl border border-destructive/30 p-4">
              <div>
                <p className="text-sm font-semibold">Eliminar comunidad</p>
                <p className="text-xs text-muted-foreground">Se eliminarán todos los canales, posts y miembros permanentemente.</p>
              </div>
              <Button variant="destructive" className="w-full" onClick={eliminarComunidad}>
                <Trash2 className="h-4 w-4" />Eliminar comunidad
              </Button>
            </div>
          </section>
        </div>
      </SheetContent>
    </Sheet>
    </>
  );
}

function CanalBtn({ ch, active, onClick }: any) {
  const Icon = ch.tipo === "voz" ? Volume2 : ch.tipo === "anuncios" ? Megaphone : Hash;
  return (
    <button onClick={onClick}
      className={cn("group flex w-full items-center gap-1.5 rounded-md px-2 py-1.5 text-sm transition-colors",
        active ? "bg-primary/15 font-semibold text-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground")}>
      <Icon className="h-4 w-4 shrink-0" />
      <span className="truncate">{ch.nombre}</span>
    </button>
  );
}

function RosterGroup({ label, color, miembros, adminIcon }: any) {
  return (
    <div>
      <p className="px-2 pb-1 text-[10px] font-bold uppercase tracking-wider" style={{ color }}>
        {label} — {miembros.length}
      </p>
      {miembros.map((m: any) => (
        <Link key={m.perfil?.id} to={`/lin/perfil/${m.perfil?.username}`}
          className="group flex items-center gap-2 rounded-md px-2 py-1 transition-colors hover:bg-secondary">
          <Avatar className="h-7 w-7">
            <AvatarImage src={m.perfil?.avatar_url || ""} />
            <AvatarFallback className="text-[10px]">{initials(m.perfil?.nombre || "??")}</AvatarFallback>
          </Avatar>
          <span className="min-w-0 flex-1 truncate text-sm" style={{ color }}>{m.nickname || m.perfil?.nombre}</span>
          {adminIcon && <Crown className="h-3.5 w-3.5 text-amber-500" />}
        </Link>
      ))}
    </div>
  );
}
