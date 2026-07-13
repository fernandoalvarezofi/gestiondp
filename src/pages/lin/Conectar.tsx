import { useEffect, useMemo, useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  Search, Users2, UserSearch, UserPlus, Users, Calendar, MessageCircleMore, MoreHorizontal,
  Clock, UserCheck, BadgeCheck, ChevronRight, Mail, X,
} from "lucide-react";
import { TIPO_USUARIO, initials } from "@/lib/worefHelpers";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/lin/ConfirmDialog";

type Tab = "conexiones" | "descubrir" | "solicitudes";
type Estado = "conectado" | "enviada" | "recibida" | "nada";

const TIPOS = [
  { id: null as string | null, label: "Todos" },
  { id: "emprendedor", label: "Emprendedores" },
  { id: "inversor", label: "Inversores" },
  { id: "freelancer", label: "Freelancers" },
  { id: "mentor", label: "Mentores" },
  { id: "empresa", label: "Empresas" },
  { id: "creador", label: "Creadores" },
];

function timeAgo(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const days = Math.floor(diff / 86400000);
  if (days < 1) return "hoy";
  if (days < 7) return `hace ${days}d`;
  if (days < 30) return `hace ${Math.floor(days / 7)}sem`;
  if (days < 365) return `hace ${Math.floor(days / 30)}mes`;
  return `hace ${Math.floor(days / 365)}a`;
}

export default function Conectar() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const confirmDlg = useConfirm();
  const [params, setParams] = useSearchParams();
  const tab = (params.get("tab") as Tab) || "conexiones";
  const setTab = (t: Tab) => setParams({ tab: t });

  // CONEXIONES
  const [conexiones, setConexiones] = useState<any[]>([]);
  const [qConex, setQConex] = useState("");
  const [orden, setOrden] = useState("recientes");

  // SOLICITUDES
  const [recibidas, setRecibidas] = useState<any[]>([]);
  const [enviadas, setEnviadas] = useState<any[]>([]);
  const [seguirRecibidas, setSeguirRecibidas] = useState<any[]>([]);

  // DESCUBRIR
  const [tipoFiltro, setTipoFiltro] = useState<string | null>(null);
  const [qDesc, setQDesc] = useState("");
  const [perfiles, setPerfiles] = useState<any[]>([]);
  const [estadoMap, setEstadoMap] = useState<Record<string, Estado>>({});

  // Sugerencias sidebar
  const [sugerencias, setSugerencias] = useState<any[]>([]);
  const [ocultas, setOcultas] = useState<Set<string>>(new Set());

  // Conectar dialog
  const [conectarPerfil, setConectarPerfil] = useState<any | null>(null);
  const [nota, setNota] = useState("");

  const cargarConexiones = async () => {
    if (!user) return;
    const { data: ms } = await (supabase as any).from("matches")
      .select("id, perfil_a_id, perfil_b_id, created_at")
      .or(`perfil_a_id.eq.${user.id},perfil_b_id.eq.${user.id}`)
      .order("created_at", { ascending: false });
    const otros = (ms || []).map((m: any) => ({
      otroId: m.perfil_a_id === user.id ? m.perfil_b_id : m.perfil_a_id,
      created_at: m.created_at,
    }));
    if (otros.length === 0) { setConexiones([]); return; }
    const { data: perfs } = await (supabase as any).from("perfiles")
      .select("id, nombre, username, avatar_url, tipo, industria, actualmente, verificado")
      .in("id", otros.map((o: any) => o.otroId));
    const map = new Map<string, any>((perfs || []).map((p: any) => [p.id, p]));
    setConexiones(otros.map((o: any) => ({ ...(map.get(o.otroId) || {} as any), created_at: o.created_at })).filter((p: any) => p.id));
  };

  const cargarSolicitudes = async () => {
    if (!user) return;
    const [{ data: rec }, { data: env }, { data: segRec }] = await Promise.all([
      (supabase as any).from("match_acciones")
        .select("id, perfil_id, nota, created_at, perfil:perfiles!perfil_id(id,nombre,username,avatar_url,tipo,industria,verificado)")
        .eq("objetivo_id", user.id).eq("accion", "solicitud_enviada")
        .order("created_at", { ascending: false }),
      (supabase as any).from("match_acciones")
        .select("id, objetivo_id, created_at, perfil:perfiles!objetivo_id(id,nombre,username,avatar_url,tipo,industria)")
        .eq("perfil_id", user.id).eq("accion", "solicitud_enviada")
        .order("created_at", { ascending: false }),
      (supabase as any).from("seguidos_solicitudes")
        .select("id, solicitante_id, created_at, perfil:perfiles!solicitante_id(id,nombre,username,avatar_url,tipo,industria,verificado)")
        .eq("destinatario_id", user.id)
        .order("created_at", { ascending: false }),
    ]);
    setRecibidas(rec || []);
    setEnviadas(env || []);
    setSeguirRecibidas(segRec || []);
  };

  const aceptarSeguir = async (solicitanteId: string, nombre?: string) => {
    const { error } = await (supabase as any).rpc("aceptar_seguir", { _solicitante: solicitanteId });
    if (error) return toast.error(error.message);
    setSeguirRecibidas((s) => s.filter((x) => x.solicitante_id !== solicitanteId));
    toast.success(`${nombre || "Usuario"} ahora te sigue`);
  };
  const rechazarSeguir = async (solicitanteId: string) => {
    const { error } = await (supabase as any).rpc("rechazar_seguir", { _solicitante: solicitanteId });
    if (error) return toast.error(error.message);
    setSeguirRecibidas((s) => s.filter((x) => x.solicitante_id !== solicitanteId));
    toast.success("Solicitud rechazada");
  };


  const cargarDescubrir = async () => {
    if (!user) return;
    let qy = (supabase as any).from("perfiles")
      .select("id, nombre, username, avatar_url, tipo, industria, actualmente, skills, portada_url, verificado, score")
      .neq("id", user.id)
      .order("score", { ascending: false })
      .order("created_at", { ascending: false })
      .limit(24);
    if (tipoFiltro) qy = qy.eq("tipo", tipoFiltro);
    if (qDesc.trim()) qy = qy.or(`nombre.ilike.%${qDesc.trim()}%,industria.ilike.%${qDesc.trim()}%`);
    const { data: ps } = await qy;
    const arr = ps || [];
    setPerfiles(arr);
    if (arr.length === 0) { setEstadoMap({}); return; }
    const ids = arr.map((p: any) => p.id);
    const [{ data: ms }, { data: env }, { data: rec }] = await Promise.all([
      (supabase as any).from("matches").select("perfil_a_id, perfil_b_id")
        .or(`perfil_a_id.eq.${user.id},perfil_b_id.eq.${user.id}`),
      (supabase as any).from("match_acciones").select("objetivo_id")
        .eq("perfil_id", user.id).eq("accion", "solicitud_enviada").in("objetivo_id", ids),
      (supabase as any).from("match_acciones").select("perfil_id")
        .eq("objetivo_id", user.id).eq("accion", "solicitud_enviada").in("perfil_id", ids),
    ]);
    const map: Record<string, Estado> = {};
    for (const id of ids) map[id] = "nada";
    (ms || []).forEach((m: any) => {
      const otro = m.perfil_a_id === user.id ? m.perfil_b_id : m.perfil_a_id;
      if (ids.includes(otro)) map[otro] = "conectado";
    });
    (env || []).forEach((e: any) => { if (map[e.objetivo_id] === "nada") map[e.objetivo_id] = "enviada"; });
    (rec || []).forEach((r: any) => { if (map[r.perfil_id] === "nada") map[r.perfil_id] = "recibida"; });
    setEstadoMap(map);
  };

  const cargarSugerencias = async () => {
    if (!user) return;
    const { data: me } = await (supabase as any).from("perfiles").select("industria").eq("id", user.id).single();
    let qy = (supabase as any).from("perfiles")
      .select("id, nombre, username, avatar_url, tipo, industria, actualmente")
      .neq("id", user.id).order("score", { ascending: false }).limit(8);
    if (me?.industria) qy = qy.eq("industria", me.industria);
    const { data } = await qy;
    setSugerencias(data || []);
  };

  useEffect(() => { cargarConexiones(); cargarSolicitudes(); cargarSugerencias(); }, [user]);
  useEffect(() => { cargarDescubrir(); }, [user, tipoFiltro, qDesc]);

  useEffect(() => {
    if (!user) return;
    const ch = (supabase as any).channel("conectar-rt")
      .on("postgres_changes", { event: "*", schema: "public", table: "matches" }, () => { cargarConexiones(); cargarDescubrir(); })
      .on("postgres_changes", { event: "*", schema: "public", table: "match_acciones" }, () => { cargarSolicitudes(); cargarDescubrir(); })
      .subscribe();
    return () => { (supabase as any).removeChannel(ch); };
  }, [user]);

  const enviarSolicitud = async (destinoId: string, nombre: string) => {
    if (!user) return;
    const { error } = await (supabase as any).from("match_acciones").insert({
      perfil_id: user.id, objetivo_id: destinoId, accion: "solicitud_enviada",
      nota: nota.trim() || null,
    });
    if (error) { toast.error(error.message); return; }
    toast.success(`Solicitud enviada a ${nombre}`);
    setEstadoMap((m) => ({ ...m, [destinoId]: "enviada" }));
    setConectarPerfil(null); setNota("");
    cargarSolicitudes();
  };

  const aceptar = async (solicitanteId: string, nombre: string) => {
    const { error } = await (supabase as any).rpc("aceptar_conexion", { _solicitante_id: solicitanteId });
    if (error) { toast.error(error.message); return; }
    toast.success(`Conectado con ${nombre}`);
    setRecibidas((arr) => arr.filter((r) => r.perfil_id !== solicitanteId));
    cargarConexiones();
  };
  const rechazar = async (solicitanteId: string) => {
    const { error } = await (supabase as any).rpc("rechazar_conexion", { _solicitante_id: solicitanteId });
    if (error) { toast.error(error.message); return; }
    setRecibidas((arr) => arr.filter((r) => r.perfil_id !== solicitanteId));
    toast.info("Solicitud rechazada");
  };
  const cancelarEnviada = async (objetivoId: string) => {
    if (!user) return;
    await (supabase as any).from("match_acciones").delete()
      .eq("perfil_id", user.id).eq("objetivo_id", objetivoId).eq("accion", "solicitud_enviada");
    setEnviadas((arr) => arr.filter((e) => e.objetivo_id !== objetivoId));
    setEstadoMap((m) => ({ ...m, [objetivoId]: "nada" }));
    toast.info("Solicitud cancelada");
  };
  const desconectar = async (otroId: string, nombre: string) => {
    const ok = await confirmDlg({ title: `¿Desconectar de ${nombre}?`, description: "Vas a perder esta conexión.", destructive: true, confirmText: "Desconectar" });
    if (!ok) return;
    const { error } = await (supabase as any).rpc("cancelar_conexion", { _otro_id: otroId });
    if (error) { toast.error(error.message); return; }
    setConexiones((arr) => arr.filter((p) => p.id !== otroId));
    toast.success("Desconectado");
  };

  const abrirChat = async (otroId: string) => {
    if (!user) return;
    const { data } = await (supabase as any).rpc("get_or_create_conversacion", { user_a: user.id, user_b: otroId });
    navigate(`/lin/mensajes/${data}`);
  };

  const conexFiltradas = useMemo(() => {
    let arr = [...conexiones];
    if (qConex.trim()) {
      const t = qConex.toLowerCase();
      arr = arr.filter((p) => (p.nombre || "").toLowerCase().includes(t) || (p.industria || "").toLowerCase().includes(t) || (p.actualmente || "").toLowerCase().includes(t));
    }
    if (orden === "az") arr.sort((a, b) => (a.nombre || "").localeCompare(b.nombre || ""));
    else if (orden === "za") arr.sort((a, b) => (b.nombre || "").localeCompare(a.nombre || ""));
    return arr;
  }, [conexiones, qConex, orden]);

  const SidebarIzq = (
    <Card className="sticky top-20">
      <CardContent className="p-4">
        <p className="mb-3 text-sm font-semibold">Gestionar mi red</p>
        <nav className="space-y-0.5">
          {[
            { id: "conexiones" as Tab, icon: Users2, label: "Conexiones", count: conexiones.length },
            { id: "descubrir" as Tab, icon: UserSearch, label: "Descubrir personas" },
            { id: "solicitudes" as Tab, icon: UserPlus, label: "Solicitudes recibidas", badge: recibidas.length },
          ].map((it) => (
            <button key={it.id} onClick={() => setTab(it.id)}
              className={cn("flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary",
                tab === it.id && "bg-secondary font-medium text-primary")}>
              <it.icon className="h-4 w-4" />
              <span className="flex-1 text-left">{it.label}</span>
              {it.count !== undefined && <span className="text-xs text-muted-foreground">{it.count}</span>}
              {it.badge ? <Badge className="h-5 min-w-5 px-1.5 text-[10px]">{it.badge}</Badge> : null}
            </button>
          ))}
        </nav>
        <div className="my-3 h-px bg-border" />
        <nav className="space-y-0.5">
          <Link to="/lin/hub?tab=comunidades" className="flex items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary">
            <Users className="h-4 w-4" /> Grupos
          </Link>
          <button onClick={() => toast.info("Próximamente")} className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm hover:bg-secondary">
            <Calendar className="h-4 w-4" /> Eventos
          </button>
        </nav>
      </CardContent>
    </Card>
  );

  const SidebarDer = (
    <div className="space-y-4">
      <Card>
        <CardContent className="p-4">
          <p className="mb-3 text-sm font-semibold">Personas que podrías conocer</p>
          <div className="space-y-3">
            {sugerencias.filter((s) => !ocultas.has(s.id)).slice(0, 4).map((s) => (
              <div key={s.id} className="flex items-start gap-2">
                <div className="relative">
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={s.avatar_url || ""} className="object-cover" />
                    <AvatarFallback>{initials(s.nombre)}</AvatarFallback>
                  </Avatar>
                  <button onClick={() => setOcultas((o) => new Set(o).add(s.id))}
                    className="absolute -right-1 -top-1 rounded-full bg-background p-0.5 shadow ring-1 ring-border hover:bg-secondary">
                    <X className="h-2.5 w-2.5" />
                  </button>
                </div>
                <div className="min-w-0 flex-1">
                  <Link to={`/lin/perfil/${s.username}`} className="block truncate text-sm font-semibold hover:text-primary">{s.nombre}</Link>
                  <p className="truncate text-xs text-muted-foreground">{s.actualmente || TIPO_USUARIO[s.tipo] || s.industria}</p>
                </div>
                <Button size="sm" variant="outline" className="h-7 rounded-full text-xs" onClick={() => { setConectarPerfil(s); setNota(""); }}>
                  + Conectar
                </Button>
              </div>
            ))}
            {sugerencias.length === 0 && <p className="text-xs text-muted-foreground">Sin sugerencias por ahora.</p>}
          </div>
          <button onClick={() => setTab("descubrir")} className="mt-3 text-sm font-medium text-primary hover:underline">
            Ver todas las recomendaciones →
          </button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4">
          <p className="mb-1 text-sm font-semibold">Encontrá personas que ya conocés</p>
          <p className="mb-3 text-xs text-muted-foreground">Importá tus contactos a Woref.</p>
          <div className="space-y-1">
            {[
              { label: "Importar desde Gmail", icon: <Mail className="h-4 w-4 text-red-500" /> },
              { label: "Importar desde Outlook", icon: <div className="flex h-4 w-4 items-center justify-center rounded-sm bg-blue-600 text-[9px] font-bold text-white">M</div> },
              { label: "Importar desde otro correo", icon: <Mail className="h-4 w-4 text-muted-foreground" /> },
            ].map((it) => (
              <button key={it.label} onClick={() => toast.info("Próximamente")}
                className="flex w-full items-center gap-2 rounded-lg px-2 py-2 text-sm hover:bg-secondary">
                {it.icon}
                <span className="flex-1 text-left">{it.label}</span>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </button>
            ))}
          </div>
          <p className="mt-3 text-[10px] text-muted-foreground">🔒 No guardaremos tu contraseña y tus contactos están seguros.</p>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="mx-auto max-w-7xl px-4 py-6">
      <header className="mb-5">
        <h1 className="text-2xl font-bold">Mi red</h1>
        <p className="text-sm text-muted-foreground">Gestioná tus conexiones profesionales.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-[240px_1fr_300px]">
        <aside className="hidden lg:block">{SidebarIzq}</aside>

        <main className="min-w-0">
          {/* Tabs mobile */}
          <div className="mb-4 flex gap-2 overflow-x-auto lg:hidden">
            {[
              { id: "conexiones" as Tab, label: "Conexiones" },
              { id: "descubrir" as Tab, label: "Descubrir" },
              { id: "solicitudes" as Tab, label: `Solicitudes${recibidas.length ? ` (${recibidas.length})` : ""}` },
            ].map((t) => (
              <button key={t.id} onClick={() => setTab(t.id)}
                className={cn("shrink-0 rounded-full border px-4 py-1.5 text-sm",
                  tab === t.id ? "border-foreground bg-foreground text-background" : "text-muted-foreground")}>
                {t.label}
              </button>
            ))}
          </div>

          {tab === "conexiones" && (
            <div>
              <div className="mb-4 flex flex-wrap items-center gap-3">
                <div>
                  <h2 className="text-xl font-bold">Mis contactos</h2>
                  <p className="text-sm text-muted-foreground">{conexiones.length} contacto{conexiones.length === 1 ? "" : "s"}</p>
                </div>
                <Button variant="outline" size="sm" className="ml-auto rounded-full" onClick={() => setTab("descubrir")}>
                  + Agregar contactos
                </Button>
              </div>
              <div className="mb-4 flex flex-wrap gap-3">
                <div className="relative flex-1 min-w-[200px]">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input value={qConex} onChange={(e) => setQConex(e.target.value)} placeholder="Buscar por nombre, cargo o industria" className="pl-9" />
                </div>
                <Select value={orden} onValueChange={setOrden}>
                  <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="recientes">Más recientes</SelectItem>
                    <SelectItem value="az">Nombre A–Z</SelectItem>
                    <SelectItem value="za">Nombre Z–A</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {conexFiltradas.length === 0 ? (
                <Card><CardContent className="flex flex-col items-center py-12 text-center">
                  <div className="mb-4 rounded-full bg-secondary/40 p-6"><Users2 className="h-12 w-12 text-muted-foreground" /></div>
                  <p className="font-semibold">Todavía no tenés conexiones</p>
                  <p className="mb-4 text-sm text-muted-foreground">Descubrí profesionales para conectar.</p>
                  <Button onClick={() => setTab("descubrir")}>Descubrir personas</Button>
                </CardContent></Card>
              ) : (
                <div className="divide-y rounded-xl border bg-card">
                  {conexFiltradas.map((p) => (
                    <div key={p.id} className="flex items-center gap-3 p-4">
                      <Avatar className="h-14 w-14"><AvatarImage src={p.avatar_url || ""} className="object-cover" /><AvatarFallback>{initials(p.nombre)}</AvatarFallback></Avatar>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          <Link to={`/lin/perfil/${p.username}`} className="font-semibold hover:text-primary text-[15px]">{p.nombre}</Link>
                          {p.verificado && <BadgeCheck className="h-4 w-4 text-primary" />}
                          <span className="rounded-full bg-secondary px-1.5 py-0.5 text-[10px] text-muted-foreground">1.°</span>
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{p.actualmente || TIPO_USUARIO[p.tipo] || p.industria || ""}</p>
                        <p className="text-xs text-muted-foreground">Conectado {timeAgo(p.created_at)}</p>
                      </div>
                      <Button size="sm" variant="outline" className="rounded-full" onClick={() => abrirChat(p.id)}>
                        <MessageCircleMore className="h-4 w-4" /> Mensaje
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-9 w-9"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/lin/perfil/${p.username}`)}>Ver perfil</DropdownMenuItem>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem className="text-destructive" onClick={() => desconectar(p.id, p.nombre)}>Desconectar</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "solicitudes" && (
            <div className="space-y-6">
              <div>
                <h2 className="mb-3 text-xl font-bold">Recibidas {recibidas.length > 0 && <span className="text-sm font-normal text-muted-foreground">({recibidas.length})</span>}</h2>
                {recibidas.length === 0 ? (
                  <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">No tenés solicitudes pendientes.</p>
                ) : (
                  <div className="divide-y rounded-xl border bg-card">
                    {recibidas.map((s) => (
                      <div key={s.id} className="flex items-start gap-3 p-4">
                        <Avatar className="h-12 w-12"><AvatarImage src={s.perfil?.avatar_url || ""} className="object-cover" /><AvatarFallback>{initials(s.perfil?.nombre)}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <div className="flex items-center gap-1.5">
                            <Link to={`/lin/perfil/${s.perfil?.username}`} className="font-semibold hover:text-primary">{s.perfil?.nombre}</Link>
                            {s.perfil?.verificado && <BadgeCheck className="h-4 w-4 text-primary" />}
                            <Badge variant="outline" className="text-[10px]">{TIPO_USUARIO[s.perfil?.tipo] || s.perfil?.tipo}</Badge>
                          </div>
                          <p className="text-xs text-muted-foreground">Hace {timeAgo(s.created_at)}</p>
                          {s.nota && <p className="mt-1 text-sm italic text-muted-foreground">"{s.perfil?.nombre} dijo: {s.nota}"</p>}
                        </div>
                        <div className="flex gap-2">
                          <Button size="sm" className="rounded-full" onClick={() => aceptar(s.perfil_id, s.perfil?.nombre)}>Aceptar</Button>
                          <Button size="sm" variant="outline" className="rounded-full" onClick={() => rechazar(s.perfil_id)}>Rechazar</Button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <h2 className="mb-3 text-xl font-bold">Enviadas {enviadas.length > 0 && <span className="text-sm font-normal text-muted-foreground">({enviadas.length})</span>}</h2>
                {enviadas.length === 0 ? (
                  <p className="rounded-xl border bg-card p-6 text-sm text-muted-foreground">Sin solicitudes enviadas pendientes.</p>
                ) : (
                  <div className="divide-y rounded-xl border bg-card">
                    {enviadas.map((e) => (
                      <div key={e.id} className="flex items-center gap-3 p-4">
                        <Avatar className="h-10 w-10"><AvatarImage src={e.perfil?.avatar_url || ""} className="object-cover" /><AvatarFallback>{initials(e.perfil?.nombre)}</AvatarFallback></Avatar>
                        <div className="min-w-0 flex-1">
                          <Link to={`/lin/perfil/${e.perfil?.username}`} className="block truncate font-semibold hover:text-primary">{e.perfil?.nombre}</Link>
                          <p className="truncate text-xs text-muted-foreground">{TIPO_USUARIO[e.perfil?.tipo] || e.perfil?.industria}</p>
                        </div>
                        <Badge variant="outline">Pendiente</Badge>
                        <Button size="sm" variant="ghost" className="text-destructive" onClick={() => cancelarEnviada(e.objetivo_id)}>Cancelar</Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {tab === "descubrir" && (
            <div>
              <div className="mb-4 flex flex-wrap items-end gap-3">
                <div className="flex-1">
                  <h2 className="text-xl font-bold">Descubrí profesionales</h2>
                  <p className="text-sm text-muted-foreground">Conectá con emprendedores, inversores y creadores.</p>
                </div>
                <Button variant="outline" className="rounded-full" onClick={() => setTab("conexiones")}>Mis contactos</Button>
              </div>

              <div className="mb-3 flex flex-wrap gap-2">
                {TIPOS.map((t) => (
                  <button key={t.label} onClick={() => setTipoFiltro(t.id)}
                    className={cn("rounded-full px-4 py-1.5 text-sm transition",
                      tipoFiltro === t.id ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground")}>
                    {t.label}
                  </button>
                ))}
              </div>

              <div className="relative mb-4">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input value={qDesc} onChange={(e) => setQDesc(e.target.value)} placeholder="Buscar por nombre, industria o skills" className="pl-9" />
              </div>

              {perfiles.length === 0 ? (
                <Card><CardContent className="py-12 text-center">
                  <p className="text-sm text-muted-foreground">No encontramos profesionales con esos filtros.</p>
                  <Button variant="outline" className="mt-3" onClick={() => { setTipoFiltro(null); setQDesc(""); }}>Limpiar filtros</Button>
                </CardContent></Card>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {perfiles.map((p) => {
                    const est = estadoMap[p.id] || "nada";
                    return (
                      <Card key={p.id} className="overflow-hidden">
                        <div className="h-14 w-full bg-gradient-to-br from-primary/20 to-secondary"
                          style={p.portada_url ? { backgroundImage: `url(${p.portada_url})`, backgroundSize: "cover", backgroundPosition: "center" } : {}} />
                        <CardContent className="px-4 pb-4 pt-0">
                          <div className="flex items-end gap-2">
                            <Avatar className="-mt-10 h-16 w-16 ring-4 ring-card">
                              <AvatarImage src={p.avatar_url || ""} className="object-cover" />
                              <AvatarFallback>{initials(p.nombre)}</AvatarFallback>
                            </Avatar>
                            {p.verificado && <BadgeCheck className="mb-2 h-4 w-4 text-primary" />}
                          </div>
                          <Link to={`/lin/perfil/${p.username}`} className="mt-2 block font-bold text-[15px] hover:text-primary">{p.nombre}</Link>
                          <p className="text-xs text-muted-foreground">
                            @{p.username} · <span className="rounded-full bg-secondary px-2 py-0.5 text-[10px]">{TIPO_USUARIO[p.tipo] || p.tipo}</span>
                          </p>
                          {p.industria && <p className="mt-1 text-xs text-muted-foreground">{p.industria}</p>}
                          {p.actualmente && <p className="line-clamp-1 text-xs text-muted-foreground">{p.actualmente}</p>}
                          {p.skills?.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                              {p.skills.slice(0, 3).map((s: string) => (
                                <span key={s} className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{s}</span>
                              ))}
                              {p.skills.length > 3 && <span className="text-[10px] text-muted-foreground">+{p.skills.length - 3} más</span>}
                            </div>
                          )}
                          <div className="my-3 h-px bg-border" />
                          <div className="flex gap-2">
                            {est === "conectado" && (<>
                              <Button size="sm" variant="outline" className="flex-1 rounded-full" disabled><UserCheck className="h-4 w-4" /> Conectado</Button>
                              <Button size="sm" variant="ghost" onClick={() => abrirChat(p.id)}><MessageCircleMore className="h-4 w-4" /></Button>
                            </>)}
                            {est === "enviada" && (
                              <Button size="sm" variant="outline" className="flex-1 rounded-full" disabled><Clock className="h-4 w-4" /> Solicitud enviada</Button>
                            )}
                            {est === "recibida" && (<>
                              <Button size="sm" className="flex-1 rounded-full" onClick={() => aceptar(p.id, p.nombre)}>Aceptar</Button>
                              <Button size="sm" variant="outline" className="rounded-full text-destructive" onClick={() => rechazar(p.id)}>Rechazar</Button>
                            </>)}
                            {est === "nada" && (<>
                              <Button size="sm" variant="outline" className="flex-1 rounded-full" onClick={() => { setConectarPerfil(p); setNota(""); }}>＋ Conectar</Button>
                              <Button size="sm" variant="ghost" onClick={() => abrirChat(p.id)}><MessageCircleMore className="h-4 w-4" /></Button>
                            </>)}
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </main>

        <aside className="hidden lg:block">{SidebarDer}</aside>
      </div>

      <Dialog open={!!conectarPerfil} onOpenChange={(o) => { if (!o) { setConectarPerfil(null); setNota(""); } }}>
        <DialogContent>
          <DialogHeader><DialogTitle>Enviar solicitud de conexión</DialogTitle></DialogHeader>
          {conectarPerfil && (
            <div className="flex items-center gap-3 rounded-xl border p-3">
              <Avatar className="h-10 w-10"><AvatarImage src={conectarPerfil.avatar_url || ""} className="object-cover" /><AvatarFallback>{initials(conectarPerfil.nombre)}</AvatarFallback></Avatar>
              <div>
                <p className="font-semibold">{conectarPerfil.nombre}</p>
                <p className="text-xs text-muted-foreground">@{conectarPerfil.username}</p>
              </div>
            </div>
          )}
          <div>
            <label className="mb-1 block text-sm font-medium">Agregá una nota (opcional)</label>
            <Textarea value={nota} onChange={(e) => setNota(e.target.value)} maxLength={200} placeholder="Hola, me interesa conectar..." />
            <p className="mt-1 text-right text-[10px] text-muted-foreground">{nota.length}/200</p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setConectarPerfil(null); setNota(""); }}>Cancelar</Button>
            <Button onClick={() => conectarPerfil && enviarSolicitud(conectarPerfil.id, conectarPerfil.nombre)}>Enviar solicitud</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
