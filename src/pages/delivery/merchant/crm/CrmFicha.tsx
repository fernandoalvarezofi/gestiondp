import { FormEvent, ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import {
  AlarmClock, ArrowLeft, CalendarCheck, CalendarPlus, Check, ClipboardList, Loader2, Mail, MessageCircle, MoreHorizontal, NotebookPen, Pencil, Phone,
  Plus, ShieldAlert, Trash2, Undo2, UsersRound,
} from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { confirmar } from "@/components/ui/dialogos";
import { errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import {
  ACTIVIDADES, EventoLinea, eliminarActividad, Ficha, fichaCliente, fusionarContactos, guardarActividad, guardarContacto, iniciales, marcarTarea, relativo,
  SEGMENTOS, TipoActividad, whatsappUrl,
} from "@/services/crm";
import { useMerchant } from "../context";

type FiltroLinea = "todo" | "compras" | "turnos" | "conversaciones" | "equipo";
const FILTROS: { id: FiltroLinea; texto: string; tipos: EventoLinea["tipo"][] }[] = [
  { id: "todo", texto: "Todo", tipos: [] },
  { id: "compras", texto: "Compras", tipos: ["pedido"] },
  { id: "turnos", texto: "Turnos", tipos: ["turno"] },
  { id: "conversaciones", texto: "Conversaciones y reclamos", tipos: ["mensaje", "reclamo"] },
  { id: "equipo", texto: "Actividad del equipo", tipos: ["nota", "llamada", "whatsapp", "email", "reunion", "tarea"] },
];
const ICONO: Record<EventoLinea["tipo"], { icono: ReactNode; clase: string }> = {
  pedido: { icono: <ClipboardList className="h-4 w-4" />, clase: "bg-primary/10 text-primary" },
  turno: { icono: <CalendarCheck className="h-4 w-4" />, clase: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  mensaje: { icono: <MessageCircle className="h-4 w-4" />, clase: "bg-violet-500/15 text-violet-700 dark:text-violet-300" },
  reclamo: { icono: <ShieldAlert className="h-4 w-4" />, clase: "bg-destructive/10 text-destructive" },
  nota: { icono: <NotebookPen className="h-4 w-4" />, clase: "bg-muted text-foreground" },
  llamada: { icono: <Phone className="h-4 w-4" />, clase: "bg-success/15 text-success" },
  whatsapp: { icono: <MessageCircle className="h-4 w-4" />, clase: "bg-success/15 text-success" },
  email: { icono: <Mail className="h-4 w-4" />, clase: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  reunion: { icono: <UsersRound className="h-4 w-4" />, clase: "bg-brand-yellow/25 text-brand-yellow-foreground" },
  tarea: { icono: <AlarmClock className="h-4 w-4" />, clase: "bg-brand-yellow/25 text-brand-yellow-foreground" },
};
const ESTADOS: Record<string, string> = {
  pendiente: "Pendiente", confirmado: "Confirmado", preparando: "En preparación", listo: "Listo", en_camino: "En camino", entregado: "Entregado", cancelado: "Cancelado",
  en_curso: "En curso", completado: "Realizado", ausente: "No vino", esperando: "Espera respuesta", respondida: "Respondida", abierto: "Abierto", resuelto: "Resuelto",
  cerrado: "Cerrado", completada: "Completada", vencida: "Vencida",
};
const hora = (iso: string) => new Intl.DateTimeFormat("es-AR", { hour: "2-digit", minute: "2-digit", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));
const dia = (iso: string) => new Intl.DateTimeFormat("es-AR", { day: "numeric", month: "short", year: "numeric", timeZone: "America/Argentina/Buenos_Aires" }).format(new Date(iso));

/** Ficha del cliente: la relación completa con el local en una sola pantalla. */
export default function CrmFicha() {
  const { id } = useParams();
  const { store } = useMerchant();
  const navigate = useNavigate();
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [redirigir, setRedirigir] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filtro, setFiltro] = useState<FiltroLinea>("todo");
  const [actividad, setActividad] = useState<{ tipo: TipoActividad; editar?: EventoLinea } | null>(null);
  const [editando, setEditando] = useState(false);

  const cargar = useCallback(async () => {
    if (!id) return;
    setError(null);
    try {
      const r = await fichaCliente(id);
      if ("fusionado_en" in r && !("nombre" in r)) { setRedirigir(r.fusionado_en); return; }
      setFicha(r as Ficha);
    } catch (e) { setError(new Error(errorMessage(e))); }
  }, [id]);
  useEffect(() => { setFicha(null); cargar(); }, [cargar]);

  const linea = useMemo(() => {
    const tipos = FILTROS.find((f) => f.id === filtro)?.tipos ?? [];
    return (ficha?.linea ?? []).filter((e) => !tipos.length || tipos.includes(e.tipo));
  }, [ficha, filtro]);
  // Lo próximo (tareas pendientes y turnos que vienen) arriba, separado de lo que ya pasó.
  const ahora = Date.now();
  const proximos = linea.filter((e) => new Date(e.fecha).getTime() > ahora && e.estado !== "cancelado" && e.estado !== "completada");
  const pasados = linea.filter((e) => !proximos.includes(e));

  if (redirigir) return <Navigate to={`/app/comercio/clientes/${redirigir}`} replace />;
  if (error && !ficha) return <ErrorState title="No pudimos abrir la ficha" error={error} onRetry={cargar} />;
  if (!ficha) return <div className="grid gap-5 lg:grid-cols-[1fr_360px]"><Skeleton className="h-96 rounded-2xl" /><Skeleton className="h-96 rounded-2xl" /></div>;

  const seg = SEGMENTOS[ficha.segmento];
  const wa = whatsappUrl(ficha.telefono);

  const tarea = async (e: EventoLinea, hecha: boolean) => {
    try { await marcarTarea(e.id, hecha); toast.success(hecha ? "Seguimiento completado" : "Seguimiento reabierto"); cargar(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const borrar = async (e: EventoLinea) => {
    if (!(await confirmar({ titulo: "¿Borrar esta actividad?", descripcion: "Se quita de la ficha. No se puede deshacer.", confirmar: "Borrar", peligro: true }))) return;
    try { await eliminarActividad(e.id); toast.success("Actividad borrada"); cargar(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const unificar = async (otro: Ficha["duplicados"][number]) => {
    // Se conserva la ficha con cuenta de Woref (si hay una); si no, la que se está viendo.
    const destino = otro.con_cuenta && !ficha.con_cuenta ? otro.id : ficha.id;
    const origen = destino === ficha.id ? otro.id : ficha.id;
    if (!(await confirmar({ titulo: `¿Unificar con «${otro.nombre}»?`, descripcion: "Los turnos, actividades, etiquetas y notas quedan en una sola ficha. Usalo cuando sean la misma persona.", confirmar: "Unificar" }))) return;
    try { const id2 = await fusionarContactos(origen, destino); toast.success("Fichas unificadas"); if (id2 !== ficha.id) navigate(`/app/comercio/clientes/${id2}`, { replace: true }); else cargar(); }
    catch (err) { toast.error(errorMessage(err)); }
  };
  const toggleMarketing = async () => {
    try {
      await guardarContacto(store.id, ficha.id, { nombre: ficha.nombre, telefono: ficha.telefono, email: ficha.email, etiquetas: ficha.etiquetas, notas: ficha.notas, acepta_marketing: !ficha.acepta_marketing });
      toast.success(ficha.acepta_marketing ? "Ya no recibe novedades" : "Registramos que acepta novedades");
      cargar();
    } catch (err) { toast.error(errorMessage(err)); }
  };

  return (
    <div className="space-y-4">
      <Link to="/app/comercio/clientes" className="inline-flex items-center gap-1 text-sm font-bold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" />Clientes</Link>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Línea de tiempo */}
        <section className="order-2 min-w-0 lg:order-1">
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <h2 className="mr-auto text-xl font-extrabold">Actividad</h2>
            <RegistrarActividad onElegir={(tipo) => setActividad({ tipo })} />
          </div>
          <div className="scrollbar-none -mx-1 mb-4 flex gap-1.5 overflow-x-auto px-1" role="group" aria-label="Filtrar actividad">
            {FILTROS.map((f) => <button key={f.id} type="button" aria-pressed={filtro === f.id} onClick={() => setFiltro(f.id)} className={cn("h-8 shrink-0 rounded-full border px-3 text-[13px] font-bold", filtro === f.id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{f.texto}</button>)}
          </div>
          {linea.length === 0 ? (
            <p className="rounded-2xl border border-dashed bg-card p-8 text-center text-sm text-muted-foreground">Todavía no hay nada acá. Registrá una llamada, una nota o un seguimiento.</p>
          ) : (
            <div className="space-y-6">
              {proximos.length > 0 && <Linea titulo="Próximo" eventos={[...proximos].reverse()} onTarea={tarea} onBorrar={borrar} onEditar={(e) => setActividad({ tipo: e.tipo as TipoActividad, editar: e })} />}
              {pasados.length > 0 && <Linea titulo={proximos.length ? "Historial" : undefined} eventos={pasados} onTarea={tarea} onBorrar={borrar} onEditar={(e) => setActividad({ tipo: e.tipo as TipoActividad, editar: e })} />}
            </div>
          )}
        </section>

        {/* Ficha */}
        <aside className="order-1 space-y-4 lg:sticky lg:top-20 lg:order-2">
          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-start gap-3">
              <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-primary text-lg font-black text-primary-foreground">{iniciales(ficha.nombre)}</span>
              <div className="min-w-0 flex-1">
                <h1 className="truncate text-xl font-extrabold leading-tight">{ficha.nombre}</h1>
                <p className="mt-1 flex flex-wrap items-center gap-1.5 text-xs">
                  <span className={cn("rounded-full px-2 py-0.5 font-bold", seg.clase)} title={seg.ayuda}>{seg.texto}</span>
                  <span className="text-muted-foreground">{ficha.con_cuenta ? "Con cuenta de Woref" : "Sin cuenta"}</span>
                </p>
              </div>
              <Button size="icon" variant="ghost" className="rounded-full" aria-label="Editar datos" onClick={() => setEditando(true)}><Pencil className="h-4 w-4" /></Button>
            </div>
            <dl className="mt-4 grid grid-cols-2 gap-x-4 gap-y-3 text-sm">
              <Dato titulo="Teléfono">{ficha.telefono ? <a href={`tel:${ficha.telefono.replace(/\s/g, "")}`} className="font-semibold hover:underline">{ficha.telefono}</a> : "—"}</Dato>
              <Dato titulo="Email">{ficha.email ? <a href={`mailto:${ficha.email}`} className="break-all font-semibold hover:underline">{ficha.email}</a> : "—"}</Dato>
              <Dato titulo="Cliente desde">{ficha.primera ? dia(ficha.primera) : dia(ficha.creado)}</Dato>
              <Dato titulo="Última interacción">{relativo(ficha.ultima_interaccion)}</Dato>
              <Dato titulo="Gastado">{money(ficha.gastado)}</Dato>
              <Dato titulo="Ticket promedio">{ficha.operaciones ? money(ficha.ticket_promedio) : "—"}</Dato>
              <Dato titulo="Compras">{ficha.pedidos}</Dato>
              <Dato titulo="Turnos">{ficha.turnos}{ficha.ausentes > 0 && <span className="ml-1 text-xs font-bold text-destructive">({ficha.ausentes} sin venir)</span>}</Dato>
              {ficha.proximo_turno && <Dato titulo="Próximo turno" ancho>{formatDateTime(ficha.proximo_turno)}</Dato>}
            </dl>
            <div className="mt-4 grid grid-cols-2 gap-2">
              {wa && <Button asChild variant="outline" size="sm" className="rounded-full"><a href={wa} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a></Button>}
              <Button asChild variant="outline" size="sm" className="rounded-full"><Link to={`/app/comercio/turnos/calendario?nuevo=1&contacto=${ficha.id}`}><CalendarPlus className="h-4 w-4" />Nuevo turno</Link></Button>
              {ficha.con_cuenta && <Button asChild variant="outline" size="sm" className="rounded-full"><Link to="/app/comercio/mensajes"><MessageCircle className="h-4 w-4" />Conversaciones</Link></Button>}
              <Button variant="outline" size="sm" className="rounded-full" onClick={() => setActividad({ tipo: "tarea" })}><AlarmClock className="h-4 w-4" />Seguimiento</Button>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-4">
            <div className="flex items-center justify-between"><h3 className="text-sm font-extrabold">Etiquetas y notas</h3><Button size="sm" variant="ghost" className="h-7 rounded-full px-2 text-xs" onClick={() => setEditando(true)}>Editar</Button></div>
            <div className="mt-2 flex flex-wrap gap-1.5">{ficha.etiquetas.length ? ficha.etiquetas.map((t) => <Link key={t} to={`/app/comercio/clientes?etiqueta=${encodeURIComponent(t)}`} className="rounded-full bg-muted px-2 py-0.5 text-xs font-semibold hover:bg-muted/70">{t}</Link>) : <span className="text-xs text-muted-foreground">Sin etiquetas</span>}</div>
            <p className={cn("mt-3 whitespace-pre-line text-sm", !ficha.notas && "text-muted-foreground")}>{ficha.notas || "Sin notas internas. Anotá preferencias, alergias o lo que el equipo tenga que saber."}</p>
            <label className="mt-3 flex items-start gap-2 border-t pt-3 text-sm">
              <input type="checkbox" checked={ficha.acepta_marketing} onChange={toggleMarketing} className="mt-0.5 h-4 w-4 accent-primary" />
              <span><span className="font-semibold">Acepta recibir novedades</span>{ficha.marketing_at && <span className="block text-xs text-muted-foreground">Desde el {dia(ficha.marketing_at)}</span>}</span>
            </label>
          </div>

          {ficha.duplicados.length > 0 && (
            <div className="rounded-2xl border border-warning/40 bg-warning/10 p-4">
              <h3 className="text-sm font-extrabold">¿Es la misma persona?</h3>
              <p className="mt-0.5 text-xs text-muted-foreground">Encontramos fichas parecidas. Unificalas si corresponde; las cuentas distintas de Woref no se pueden unir.</p>
              <ul className="mt-2 space-y-2">
                {ficha.duplicados.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 rounded-xl bg-card p-2 text-sm">
                    <Link to={`/app/comercio/clientes/${d.id}`} className="min-w-0 flex-1"><span className="block truncate font-bold">{d.nombre}</span><span className="block truncate text-xs text-muted-foreground">{d.motivo}{d.telefono ? ` · ${d.telefono}` : ""}</span></Link>
                    <Button size="sm" variant="outline" className="rounded-full" onClick={() => unificar(d)}>Unificar</Button>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <ActividadDialog estado={actividad} contactoId={ficha.id} onClose={() => setActividad(null)} onGuardado={() => { setActividad(null); cargar(); }} />
      <EditarContactoDialog open={editando} onOpenChange={setEditando} storeId={store.id} ficha={ficha} onGuardado={() => { setEditando(false); cargar(); }} />
    </div>
  );
}

function Dato({ titulo, children, ancho }: { titulo: string; children: ReactNode; ancho?: boolean }) {
  return <div className={cn("min-w-0", ancho && "col-span-2")}><dt className="text-xs text-muted-foreground">{titulo}</dt><dd className="mt-0.5 truncate font-semibold tabular-nums">{children}</dd></div>;
}

function RegistrarActividad({ onElegir }: { onElegir: (t: TipoActividad) => void }) {
  return (
    <div className="flex">
      <Button size="sm" className="rounded-l-full rounded-r-none" onClick={() => onElegir("nota")}><Plus className="h-4 w-4" />Registrar actividad</Button>
      <DropdownMenu>
        <DropdownMenuTrigger asChild><Button size="sm" className="rounded-l-none rounded-r-full border-l border-primary-foreground/30 px-2" aria-label="Elegir tipo de actividad"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {(Object.keys(ACTIVIDADES) as TipoActividad[]).map((t) => <DropdownMenuItem key={t} onClick={() => onElegir(t)}><span className={cn("grid h-6 w-6 place-items-center rounded-md", ICONO[t].clase)}>{ICONO[t].icono}</span>{ACTIVIDADES[t]}</DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}

/** Lista con línea vertical: hora y fecha a la izquierda, ícono en la línea y la tarjeta del evento. */
function Linea({ titulo, eventos, onTarea, onBorrar, onEditar }: { titulo?: string; eventos: EventoLinea[]; onTarea: (e: EventoLinea, hecha: boolean) => void; onBorrar: (e: EventoLinea) => void; onEditar: (e: EventoLinea) => void }) {
  return (
    <div>
      {titulo && <h3 className="mb-2 text-xs font-extrabold uppercase tracking-wide text-muted-foreground">{titulo}</h3>}
      <ol className="relative space-y-3 before:absolute before:bottom-2 before:left-[83px] before:top-2 before:w-px before:bg-border">
        {eventos.map((e) => {
          const ic = ICONO[e.tipo];
          const vencida = e.tipo === "tarea" && e.estado === "vencida";
          const enlace = e.tipo === "turno" ? `/app/comercio/turnos/calendario?turno=${e.id}` : e.tipo === "pedido" ? "/app/comercio/pedidos" : e.tipo === "mensaje" ? "/app/comercio/mensajes" : null;
          return (
            <li key={`${e.tipo}-${e.id}`} className="relative grid grid-cols-[64px_40px_minmax(0,1fr)] items-start gap-x-2">
              <div className="pt-2 text-right text-xs leading-tight text-muted-foreground"><span className={cn("block font-bold tabular-nums", vencida ? "text-destructive" : "text-foreground")}>{hora(e.fecha)}</span>{dia(e.fecha)}</div>
              <span className={cn("relative z-10 mt-1 grid h-9 w-9 place-items-center rounded-xl border bg-card shadow-sm", ic.clase)}>{ic.icono}</span>
              <div className={cn("rounded-2xl border bg-card p-3", vencida && "border-destructive/40", e.tipo === "tarea" && e.estado === "completada" && "opacity-70")}>
                <div className="flex items-start gap-2">
                  {e.tipo === "tarea" && (
                    <button type="button" aria-label={e.completada_at ? "Reabrir seguimiento" : "Marcar como hecho"} onClick={() => onTarea(e, !e.completada_at)}
                      className={cn("mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border-2", e.completada_at ? "border-success bg-success text-white" : "border-muted-foreground/40 hover:border-primary")}>
                      {e.completada_at && <Check className="h-3.5 w-3.5" />}
                    </button>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className={cn("font-bold leading-snug", e.tipo === "tarea" && e.completada_at && "line-through")}>
                      {enlace ? <Link to={enlace} className="hover:underline">{e.titulo}</Link> : e.titulo}
                      {e.estado && <span className={cn("ml-2 rounded-full px-1.5 py-0.5 align-middle text-[11px] font-bold", vencida ? "bg-destructive/10 text-destructive" : "bg-muted text-muted-foreground")}>{ESTADOS[e.estado] ?? e.estado}</span>}
                    </p>
                    {e.detalle && <p className="mt-0.5 whitespace-pre-line text-sm text-muted-foreground">{e.detalle}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {e.tipo !== "tarea" && e.actividad ? `${ACTIVIDADES[e.tipo as TipoActividad]} · ` : ""}
                      {e.monto != null && Number(e.monto) > 0 && <span className="font-bold text-foreground">{money(e.monto)} · </span>}
                      {e.actividad && e.autor ? `Registró ${e.autor}` : ""}
                      {e.tipo === "tarea" && e.vence_at && !e.completada_at && ` · vence ${relativo(e.vence_at)}`}
                    </p>
                  </div>
                  {e.actividad && (
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild><Button size="icon" variant="ghost" className="h-7 w-7 rounded-full" aria-label="Opciones"><MoreHorizontal className="h-4 w-4" /></Button></DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => onEditar(e)}><Pencil className="h-4 w-4" />Editar</DropdownMenuItem>
                        {e.tipo === "tarea" && <DropdownMenuItem onClick={() => onTarea(e, !e.completada_at)}>{e.completada_at ? <Undo2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}{e.completada_at ? "Reabrir" : "Marcar hecho"}</DropdownMenuItem>}
                        <DropdownMenuItem className="text-destructive" onClick={() => onBorrar(e)}><Trash2 className="h-4 w-4" />Borrar</DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

/** "YYYY-MM-DDTHH:mm" local de Argentina a ISO. */
const localIso = (v: string) => (v ? `${v}:00-03:00` : null);
const isoLocal = (iso: string) => new Intl.DateTimeFormat("sv-SE", { timeZone: "America/Argentina/Buenos_Aires", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(iso)).replace(" ", "T");
const manana10 = () => { const d = new Date(Date.now() + 86_400_000); return `${isoLocal(d.toISOString()).slice(0, 10)}T10:00`; };

function ActividadDialog({ estado, contactoId, onClose, onGuardado }: { estado: { tipo: TipoActividad; editar?: EventoLinea } | null; contactoId: string; onClose: () => void; onGuardado: () => void }) {
  const [tipo, setTipo] = useState<TipoActividad>("nota");
  const [titulo, setTitulo] = useState("");
  const [detalle, setDetalle] = useState("");
  const [vence, setVence] = useState("");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    if (!estado) return;
    const e = estado.editar;
    setTipo(e ? (e.tipo as TipoActividad) : estado.tipo);
    setTitulo(e?.titulo ?? "");
    setDetalle(e?.detalle ?? "");
    setVence(e?.vence_at ? isoLocal(e.vence_at) : estado.tipo === "tarea" ? manana10() : "");
  }, [estado]);

  const enviar = async (ev: FormEvent) => {
    ev.preventDefault();
    if (!titulo.trim()) return toast.error("Escribí un título");
    if (tipo === "tarea" && !vence) return toast.error("Elegí para cuándo es el seguimiento");
    setGuardando(true);
    try {
      await guardarActividad(contactoId, estado?.editar?.id ?? null, { tipo, titulo, detalle: detalle || null, vence_at: tipo === "tarea" ? localIso(vence) : null });
      toast.success(estado?.editar ? "Actividad actualizada" : tipo === "tarea" ? "Seguimiento agendado" : "Actividad registrada");
      onGuardado();
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setGuardando(false); }
  };

  return (
    <Dialog open={Boolean(estado)} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-xl font-extrabold">{estado?.editar ? "Editar actividad" : "Registrar actividad"}</DialogTitle>
        <DialogDescription>Queda en la ficha para todo el equipo.</DialogDescription>
        <form onSubmit={enviar} className="space-y-3">
          <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label="Tipo">
            {(Object.keys(ACTIVIDADES) as TipoActividad[]).map((t) => (
              <button key={t} type="button" role="radio" aria-checked={tipo === t} onClick={() => { setTipo(t); if (t === "tarea" && !vence) setVence(manana10()); }}
                className={cn("flex h-8 items-center gap-1.5 rounded-full border px-3 text-[13px] font-bold", tipo === t ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>
                {ICONO[t].icono}{ACTIVIDADES[t]}
              </button>
            ))}
          </div>
          <div className="space-y-1.5"><Label htmlFor="act-titulo">{tipo === "tarea" ? "¿Qué hay que hacer?" : "Resumen"}</Label><Input id="act-titulo" required maxLength={140} value={titulo} onChange={(e) => setTitulo(e.target.value)} placeholder={tipo === "tarea" ? "Ej.: Llamar para ofrecer el combo de verano" : "Ej.: Preguntó por precios mayoristas"} /></div>
          {tipo === "tarea" && <div className="space-y-1.5"><Label htmlFor="act-vence">Para cuándo</Label><Input id="act-vence" type="datetime-local" required value={vence} onChange={(e) => setVence(e.target.value)} /></div>}
          <div className="space-y-1.5"><Label htmlFor="act-detalle">Detalle (opcional)</Label><Textarea id="act-detalle" maxLength={4000} value={detalle} onChange={(e) => setDetalle(e.target.value)} className="min-h-[88px]" /></div>
          <Button type="submit" className="w-full rounded-full" disabled={guardando}>{guardando && <Loader2 className="h-4 w-4 animate-spin" />}Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function EditarContactoDialog({ open, onOpenChange, storeId, ficha, onGuardado }: { open: boolean; onOpenChange: (v: boolean) => void; storeId: string; ficha: Ficha; onGuardado: () => void }) {
  const [nombre, setNombre] = useState(ficha.nombre);
  const [telefono, setTelefono] = useState(ficha.telefono ?? "");
  const [email, setEmail] = useState(ficha.email ?? "");
  const [etiquetas, setEtiquetas] = useState(ficha.etiquetas.join(", "));
  const [notas, setNotas] = useState(ficha.notas ?? "");
  const [guardando, setGuardando] = useState(false);
  useEffect(() => { if (open) { setNombre(ficha.nombre); setTelefono(ficha.telefono ?? ""); setEmail(ficha.email ?? ""); setEtiquetas(ficha.etiquetas.join(", ")); setNotas(ficha.notas ?? ""); } }, [open, ficha]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    try {
      await guardarContacto(storeId, ficha.id, { nombre, telefono: telefono || null, email: email || null, notas: notas || null, acepta_marketing: ficha.acepta_marketing, etiquetas: etiquetas.split(",").map((t) => t.trim()).filter(Boolean) });
      toast.success("Datos guardados");
      onGuardado();
    } catch (err) { toast.error(errorMessage(err)); }
    finally { setGuardando(false); }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogTitle className="text-xl font-extrabold">Datos del cliente</DialogTitle>
        <DialogDescription>{ficha.con_cuenta ? "Tiene cuenta de Woref: estos datos son los de tu local (por ejemplo, cómo lo llaman en el negocio); no cambian su cuenta." : "Datos que administra tu local."}</DialogDescription>
        <form onSubmit={enviar} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ed-nombre">Nombre</Label><Input id="ed-nombre" required maxLength={120} value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ed-tel">Teléfono</Label><Input id="ed-tel" type="tel" inputMode="tel" maxLength={30} value={telefono} onChange={(e) => setTelefono(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="ed-mail">Email</Label><Input id="ed-mail" type="email" maxLength={160} value={email} onChange={(e) => setEmail(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ed-tags">Etiquetas (separadas por coma)</Label><Input id="ed-tags" maxLength={300} value={etiquetas} onChange={(e) => setEtiquetas(e.target.value)} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="ed-notas">Notas internas</Label><Textarea id="ed-notas" maxLength={4000} value={notas} onChange={(e) => setNotas(e.target.value)} className="min-h-[96px]" /></div>
          <Button type="submit" className="rounded-full sm:col-span-2" disabled={guardando}>{guardando && <Loader2 className="h-4 w-4 animate-spin" />}Guardar</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
