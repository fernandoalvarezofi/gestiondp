import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft, CalendarClock, Copy, ExternalLink, Loader2, MessageSquareWarning, Package, Plus, Printer, Search, Truck, X } from "lucide-react";
import { toast } from "sonner";
import { PageIntro, Metric, MetricStrip } from "@/components/panel/kit";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { confirmar, pedirTexto } from "@/components/ui/dialogos";
import { db, errorMessage, formatDateTime, money, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import {
  abrirIncidencia, BultoLog, cancelarEnvio, Cuenta, cuentaDeComercio, diasRetiro, enlaceSeguimiento, EnvioLog, esFinal, estadoCuenta, EstadoCuenta,
  EventoLog, fechaCorta, FRANJA, Incidencia, paraEtiquetas, Retiro, solicitarRetiro, actualizarRetiro, TIPOS_INCIDENCIA,
} from "@/services/logistica";
import { EstadoEnvio, eventosVista, imprimirEtiquetas, LineaTiempo, ProgresoEnvio, useSucursales } from "@/components/logistica/comun";
import { FormularioEnvio } from "@/components/logistica/FormularioEnvio";
import { useMerchant } from "./context";

/**
 * Envíos de paquetes del comercio (Woref Logística): crear con cotización al instante, imprimir etiquetas, programar retiros,
 * seguir cada envío y ver la cuenta (saldo, cobros contra reembolso y rendiciones). Todo se valida en el servidor.
 */
export default function MerchantEnvios() {
  const { id } = useParams();
  if (id === "nuevo") return <NuevoEnvio />;
  if (id) return <DetalleEnvio id={id} />;
  return <EnviosInicio />;
}

type Vista = "envios" | "retiros" | "cuenta";
const FILTROS = {
  curso: { texto: "En curso", f: (e: EnvioLog) => !esFinal(e.estado) && e.estado !== "creado" },
  despachar: { texto: "Para despachar", f: (e: EnvioLog) => e.estado === "creado" },
  problemas: { texto: "Con problemas", f: (e: EnvioLog) => ["visita_fallida", "en_devolucion", "siniestrado"].includes(e.estado) || (!esFinal(e.estado) && !!e.fecha_estimada && e.fecha_estimada < hoyIso()) },
  entregados: { texto: "Entregados", f: (e: EnvioLog) => e.estado === "entregado" },
  todos: { texto: "Todos", f: () => true },
} as const;
type Filtro = keyof typeof FILTROS;
const hoyIso = () => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());

function useCuenta() {
  const { store } = useMerchant();
  const [cuenta, setCuenta] = useState<Cuenta | null>(null);
  const [error, setError] = useState<unknown>(null);
  const cargar = useCallback(async () => {
    try {
      const idCuenta = await cuentaDeComercio(store.id);
      const { data, error: e } = await db.from("log_cuentas").select("*").eq("id", idCuenta).maybeSingle();
      if (e) throw e;
      setCuenta(data); setError(null);
    } catch (e) { setError(e); }
  }, [store.id]);
  useEffect(() => { cargar(); }, [cargar]);
  return { cuenta, error, cargar };
}

function EnviosInicio() {
  const { store } = useMerchant();
  const [params, setParams] = useSearchParams();
  const vista = (["envios", "retiros", "cuenta"].includes(params.get("vista") ?? "") ? params.get("vista") : "envios") as Vista;
  const { cuenta, error, cargar } = useCuenta();
  return (
    <div className="space-y-5">
      <PageIntro description="Mandá paquetes a cualquier punto del país: cotizás al instante, imprimís la etiqueta y pasamos a retirarlo o lo dejás en una sucursal."
        actions={<Button asChild className="rounded-full"><Link to="/app/comercio/envios/nuevo"><Plus className="mr-1.5 h-4 w-4" /> Nuevo envío</Link></Button>} />
      <div role="tablist" aria-label="Vista" className="flex gap-2">
        {([["envios", "Envíos"], ["retiros", "Retiros"], ["cuenta", "Mi cuenta"]] as const).map(([v, t]) => (
          <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setParams(v === "envios" ? {} : { vista: v }, { replace: true })}
            className={cn("h-9 rounded-full border px-4 text-sm font-bold", vista === v ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{t}</button>
        ))}
      </div>
      {error && !cuenta ? <ErrorState title="No pudimos abrir tu cuenta de envíos" error={error} onRetry={cargar} />
        : !cuenta ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : vista === "envios" ? <ListaEnvios comercio={store.id} cuenta={cuenta} />
        : vista === "retiros" ? <Retiros comercio={store.id} cuenta={cuenta} />
        : <MiCuenta comercio={store.id} cuenta={cuenta} onGuardado={cargar} />}
    </div>
  );
}

// ───────────────────────── Lista ─────────────────────────

function ListaEnvios({ comercio, cuenta }: { comercio: string; cuenta: Cuenta }) {
  const [rows, setRows] = useState<EnvioLog[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [filtro, setFiltro] = useState<Filtro>("curso");
  const [q, setQ] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [retiroAbierto, setRetiroAbierto] = useState(false);
  const { porId } = useSucursales();

  const cargar = useCallback(async () => {
    const { data, error: e } = await db.from("log_envios").select("*").eq("comercio_id", comercio).order("created_at", { ascending: false }).limit(500);
    if (e) { setError(e); return; }
    setError(null); setRows(data ?? []);
  }, [comercio]);
  useEffect(() => {
    cargar();
    const canal = db.channel(`log-envios-${comercio}`).on("postgres_changes", { event: "*", schema: "public", table: "log_envios", filter: `comercio_id=eq.${comercio}` }, cargar).subscribe();
    return () => { db.removeChannel(canal); };
  }, [cargar, comercio]);

  const conteo = useMemo(() => Object.fromEntries((Object.keys(FILTROS) as Filtro[]).map((k) => [k, (rows ?? []).filter(FILTROS[k].f).length])) as Record<Filtro, number>, [rows]);
  useEffect(() => { if (rows && conteo.curso === 0 && conteo.despachar > 0 && filtro === "curso") setFiltro("despachar"); }, [rows]); // eslint-disable-line react-hooks/exhaustive-deps
  const visibles = useMemo(() => {
    const t = q.trim().toLowerCase();
    return (rows ?? []).filter(FILTROS[filtro].f).filter((e) => !t || [e.numero, e.des_nombre, e.des_ciudad, e.referencia ?? ""].some((x) => x.toLowerCase().includes(t)));
  }, [rows, filtro, q]);
  const seleccionados = (rows ?? []).filter((e) => sel.has(e.id));
  const retirables = seleccionados.filter((e) => e.estado === "creado" && e.origen_modo === "retiro" && !e.retiro_id);

  const imprimir = async (ids: string[]) => {
    try { if (!imprimirEtiquetas(await paraEtiquetas(ids), porId)) toast.error("Permití las ventanas emergentes para imprimir las etiquetas"); } catch (e) { toast.error(errorMessage(e)); }
  };
  const toggle = (id: string) => setSel((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  if (error && !rows) return <ErrorState title="No pudimos cargar tus envíos" error={error} onRetry={cargar} />;
  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (rows.length === 0) return (
    <EmptyState icon={<Package className="h-7 w-7" />} title="Todavía no mandaste envíos" text={cuenta.estado === "activa" ? "Creá el primero: cotizás al instante y te damos la etiqueta para pegar en el paquete." : "Tu cuenta de envíos está pendiente de activación. Te avisamos cuando esté lista."}
      action={cuenta.estado === "activa" ? <Button asChild className="rounded-full"><Link to="/app/comercio/envios/nuevo">Crear envío</Link></Button> : undefined} />
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="scrollbar-none flex gap-2 overflow-x-auto">
          {(Object.keys(FILTROS) as Filtro[]).map((k) => (
            <button key={k} type="button" onClick={() => { setFiltro(k); setSel(new Set()); }} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold", filtro === k ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted", k === "problemas" && conteo.problemas > 0 && filtro !== k && "border-destructive/40 text-destructive")}>
              {FILTROS[k].texto}{k !== "todos" && conteo[k] > 0 && ` (${conteo[k]})`}
            </button>
          ))}
        </div>
        <label className="relative sm:w-64"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Número, destinatario o referencia" className="pl-9" aria-label="Buscar envíos" /></label>
      </div>

      {sel.size > 0 && (
        <div className="sticky top-2 z-10 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2.5 shadow-sm">
          <span className="px-2 text-sm font-bold">{sel.size} elegido{sel.size === 1 ? "" : "s"}</span>
          <Button size="sm" variant="outline" className="rounded-full" onClick={() => imprimir([...sel])}><Printer className="mr-1.5 h-4 w-4" /> Imprimir etiquetas</Button>
          {retirables.length > 0 && <Button size="sm" className="rounded-full" onClick={() => setRetiroAbierto(true)}><CalendarClock className="mr-1.5 h-4 w-4" /> Programar retiro ({retirables.length})</Button>}
          <Button size="sm" variant="ghost" className="ml-auto rounded-full" onClick={() => setSel(new Set())}>Quitar selección</Button>
        </div>
      )}
      {retiroAbierto && <ProgramarRetiro comercio={comercio} cuenta={cuenta} envios={retirables} onCerrar={() => setRetiroAbierto(false)} onListo={() => { setRetiroAbierto(false); setSel(new Set()); cargar(); }} />}

      {visibles.length === 0 ? <EmptyState icon={<Package className="h-7 w-7" />} title="No hay envíos en esta lista" /> : (
        <div className="overflow-hidden rounded-2xl border bg-card">
          <table className="w-full text-sm">
            <thead className="hidden border-b bg-muted/40 text-left text-xs font-semibold text-muted-foreground sm:table-header-group">
              <tr><th className="w-10 p-3"><input type="checkbox" aria-label="Elegir todos" checked={visibles.every((e) => sel.has(e.id))} onChange={(ev) => setSel(ev.target.checked ? new Set(visibles.map((e) => e.id)) : new Set())} /></th>
                <th className="p-3">Envío</th><th className="p-3">Destinatario</th><th className="p-3">Estado</th><th className="p-3 text-right">Llega</th><th className="p-3 text-right">Precio</th></tr>
            </thead>
            <tbody className="divide-y">
              {visibles.map((e) => (
                <tr key={e.id} className="hover:bg-muted/30">
                  <td className="w-10 p-3 align-top sm:align-middle"><input type="checkbox" aria-label={`Elegir ${e.numero}`} checked={sel.has(e.id)} onChange={() => toggle(e.id)} /></td>
                  <td className="p-3">
                    <Link to={`/app/comercio/envios/${e.id}`} className="font-mono text-[13px] font-bold hover:underline">{e.numero}</Link>
                    <p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)}{e.referencia ? ` · ${e.referencia}` : ""}</p>
                    <div className="mt-1 sm:hidden"><p className="font-semibold">{e.des_nombre}</p><p className="text-xs text-muted-foreground">{e.des_ciudad} ({e.des_cp})</p><div className="mt-1 flex items-center gap-2"><EstadoEnvio estado={e.estado} /><span className="text-xs font-semibold">{money(e.precio_total)}</span></div></div>
                  </td>
                  <td className="hidden p-3 sm:table-cell"><p className="font-semibold">{e.des_nombre}</p><p className="text-xs text-muted-foreground">{e.entrega_modo === "sucursal" ? "Retira en sucursal · " : ""}{e.des_ciudad} ({e.des_cp})</p></td>
                  <td className="hidden p-3 sm:table-cell"><EstadoEnvio estado={e.estado} />{e.estado === "creado" && e.retiro_id && <p className="mt-1 text-xs text-muted-foreground">Retiro programado</p>}{Number(e.reembolso) > 0 && <p className="mt-1 text-xs font-semibold text-muted-foreground">Contra reembolso {money(e.reembolso)}</p>}</td>
                  <td className="hidden p-3 text-right text-xs sm:table-cell">{e.estado === "entregado" && e.entregado_at ? formatDateTime(e.entregado_at) : e.fecha_estimada ? fechaCorta(e.fecha_estimada) : "—"}</td>
                  <td className="hidden p-3 text-right font-semibold tabular-nums sm:table-cell">{money(e.precio_total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ───────────────────────── Programar retiro ─────────────────────────

function ProgramarRetiro({ comercio, cuenta, envios, onCerrar, onListo }: { comercio: string; cuenta: Cuenta; envios: EnvioLog[]; onCerrar: () => void; onListo: () => void }) {
  const dias = useMemo(() => diasRetiro(8), []);
  const [fecha, setFecha] = useState(dias[0]);
  const [franja, setFranja] = useState<"manana" | "tarde">("tarde");
  const [direccion, setDireccion] = useState(envios[0]?.rem_direccion ?? cuenta.direccion_retiro ?? "");
  const [notas, setNotas] = useState("");
  const [busy, setBusy] = useState(false);
  const enviar = async () => {
    setBusy(true);
    try { await solicitarRetiro({ comercio, fecha, franja, envios: envios.map((e) => e.id), direccion, notas }); toast.success(`Retiro programado para el ${fechaCorta(fecha)}`); onListo(); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  return (
    <section className="rounded-2xl border bg-card p-4" aria-label="Programar retiro">
      <div className="flex items-start justify-between gap-2"><div><h3 className="font-bold">Programar retiro</h3><p className="text-sm text-muted-foreground">Pasamos a buscar {envios.length} {envios.length === 1 ? "paquete" : "paquetes"}. Tenelos embalados y con la etiqueta pegada.</p></div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-full p-1.5 hover:bg-muted"><X className="h-4 w-4" /></button></div>
      <div className="mt-3 scrollbar-none flex gap-2 overflow-x-auto" role="radiogroup" aria-label="Día">
        {dias.map((d) => <button key={d} type="button" role="radio" aria-checked={fecha === d} onClick={() => setFecha(d)} className={cn("shrink-0 rounded-xl border px-3 py-2 text-sm font-semibold capitalize", fecha === d ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted")}>{fechaCorta(d)}</button>)}
      </div>
      <div className="mt-2 flex gap-2" role="radiogroup" aria-label="Franja horaria">
        {(["manana", "tarde"] as const).map((f) => <button key={f} type="button" role="radio" aria-checked={franja === f} onClick={() => setFranja(f)} className={cn("rounded-xl border px-3 py-2 text-sm font-semibold", franja === f ? "border-primary bg-primary/5 ring-1 ring-primary" : "hover:bg-muted")}>{FRANJA[f]}</button>)}
      </div>
      <div className="mt-3 grid gap-2 sm:grid-cols-2">
        <label className="text-xs font-semibold">Dirección de retiro<Input value={direccion} onChange={(e) => setDireccion(e.target.value)} maxLength={200} className="mt-1" /></label>
        <label className="text-xs font-semibold">Indicaciones (opcional)<Input value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={300} placeholder="Timbre, horario, a quién pedir…" className="mt-1" /></label>
      </div>
      <Button className="mt-3 rounded-full" disabled={busy || direccion.trim().length < 3} onClick={enviar}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Confirmar retiro</Button>
    </section>
  );
}

// ───────────────────────── Retiros ─────────────────────────

const ESTADO_RETIRO: Record<Retiro["estado"], { texto: string; clase: string }> = {
  solicitado: { texto: "Solicitado", clase: "bg-muted text-muted-foreground" }, asignado: { texto: "En camino", clase: "bg-sky-500/15 text-sky-700 dark:text-sky-300" },
  realizado: { texto: "Retirado", clase: "bg-success/15 text-success" }, fallido: { texto: "No se pudo", clase: "bg-destructive/10 text-destructive" }, cancelado: { texto: "Cancelado", clase: "bg-foreground/10 text-foreground/70" },
};

function Retiros({ comercio, cuenta }: { comercio: string; cuenta: Cuenta }) {
  const [rows, setRows] = useState<(Retiro & { envios: { count: number }[] })[] | null>(null);
  const [pendientes, setPendientes] = useState<EnvioLog[]>([]);
  const [abierto, setAbierto] = useState(false);
  const cargar = useCallback(async () => {
    const [{ data }, { data: env }] = await Promise.all([
      db.from("log_retiros").select("*, envios:log_envios(count)").eq("cuenta_id", cuenta.id).order("fecha", { ascending: false }).limit(60),
      db.from("log_envios").select("*").eq("comercio_id", comercio).eq("estado", "creado").eq("origen_modo", "retiro").is("retiro_id", null),
    ]);
    setRows(data ?? []); setPendientes(env ?? []);
  }, [cuenta.id, comercio]);
  useEffect(() => { cargar(); }, [cargar]);
  const cancelar = async (r: Retiro) => {
    if (!(await confirmar({ titulo: "Cancelar el retiro", descripcion: "Los envíos vuelven a quedar sin retiro y podés programar otro.", confirmar: "Cancelar retiro", peligro: true }))) return;
    try { await actualizarRetiro(r.id, "cancelado"); toast.success("Retiro cancelado"); cargar(); } catch (e) { toast.error(errorMessage(e)); }
  };
  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  return (
    <div className="space-y-4">
      {pendientes.length > 0 && !abierto && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-primary/30 bg-primary/5 p-4">
          <p className="text-sm"><b>{pendientes.length} {pendientes.length === 1 ? "envío espera" : "envíos esperan"} retiro.</b> Programalo y pasamos a buscarlos.</p>
          <Button className="rounded-full" onClick={() => setAbierto(true)}><CalendarClock className="mr-1.5 h-4 w-4" /> Programar retiro</Button>
        </div>
      )}
      {abierto && <ProgramarRetiro comercio={comercio} cuenta={cuenta} envios={pendientes} onCerrar={() => setAbierto(false)} onListo={() => { setAbierto(false); cargar(); }} />}
      {rows.length === 0 ? <EmptyState icon={<Truck className="h-7 w-7" />} title="Sin retiros programados" text="Cuando crees envíos con retiro a domicilio, los programás desde acá o desde la lista de envíos." /> : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">
          {rows.map((r) => (
            <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
              <div className="min-w-0 flex-1">
                <p className="font-semibold capitalize">{fechaCorta(r.fecha)} · {FRANJA[r.franja]}</p>
                <p className="truncate text-xs text-muted-foreground">{r.direccion} · {r.envios?.[0]?.count ?? 0} envíos{r.motivo ? ` · ${r.motivo}` : ""}</p>
              </div>
              <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_RETIRO[r.estado].clase)}>{ESTADO_RETIRO[r.estado].texto}</span>
              {r.estado === "solicitado" && <Button size="sm" variant="ghost" className="rounded-full" onClick={() => cancelar(r)}>Cancelar</Button>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ───────────────────────── Mi cuenta ─────────────────────────

function MiCuenta({ comercio, cuenta, onGuardado }: { comercio: string; cuenta: Cuenta; onGuardado: () => void }) {
  const { access } = useMerchant();
  const verFinanzas = access.permisos.includes("finanzas");
  const [ec, setEc] = useState<EstadoCuenta | null>(null);
  const [rend, setRend] = useState<{ id: string; numero: number; monto: number; cantidad: number; estado: string; created_at: string; pagada_at: string | null; referencia: string | null }[]>([]);
  const [form, setForm] = useState({ razon_social: cuenta.razon_social, cuit: cuenta.cuit ?? "", condicion_iva: cuenta.condicion_iva ?? "", contacto_nombre: cuenta.contacto_nombre ?? "", email: cuenta.email ?? "",
    telefono: cuenta.telefono ?? "", direccion_retiro: cuenta.direccion_retiro ?? "", ciudad: cuenta.ciudad ?? "", provincia: cuenta.provincia ?? "", cp: cuenta.cp ? String(cuenta.cp) : "" });
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!verFinanzas) return;
    estadoCuenta(cuenta.id).then(setEc).catch(() => setEc(null));
    db.from("log_rendiciones").select("*").eq("cuenta_id", cuenta.id).order("created_at", { ascending: false }).limit(24).then(({ data }: { data: typeof rend | null }) => setRend(data ?? []));
  }, [cuenta.id, verFinanzas]);
  const guardar = async () => {
    setBusy(true);
    const { error } = await db.rpc("log_cuenta_datos_comercio", { p_comercio: comercio, p: form });
    setBusy(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Datos guardados"); onGuardado();
  };
  const campo = (k: keyof typeof form, label: string, extra: Partial<React.ComponentProps<typeof Input>> = {}) => (
    <label className="text-xs font-semibold">{label}<Input value={form[k]} onChange={(e) => setForm((f) => ({ ...f, [k]: e.target.value }))} className="mt-1" {...extra} /></label>
  );
  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        <span className="rounded-full bg-muted px-3 py-1 font-mono font-bold">Cuenta N.º {cuenta.numero}</span>
        <span className={cn("rounded-full px-3 py-1 font-bold", cuenta.estado === "activa" ? "bg-success/15 text-success" : "bg-warning/20 text-warning-foreground")}>{cuenta.estado === "activa" ? "Activa" : cuenta.estado === "suspendida" ? "Suspendida" : "Pendiente de activación"}</span>
        <span className="text-muted-foreground">{cuenta.condicion_pago === "cuenta_corriente" ? "Cuenta corriente" : "Pago contado"}</span>
      </div>
      {verFinanzas && ec && (
        <MetricStrip cols={4}>
          <Metric label="Saldo a pagar" value={money(ec.saldo)} hint={cuenta.condicion_pago === "cuenta_corriente" && ec.limite_credito > 0 ? `Límite ${money(ec.limite_credito)}` : undefined} />
          <Metric label="Envíos este mes" value={ec.mes_envios} hint={money(ec.mes_monto)} />
          <Metric label="Cobrado contra reembolso" value={money(ec.reembolsos_sin_rendir)} hint="Pendiente de rendir" />
          <Metric label="Rendiciones por cobrar" value={money(ec.rendiciones_pendientes)} hint="Te las transferimos" />
        </MetricStrip>
      )}
      {verFinanzas && rend.length > 0 && (
        <section className="rounded-2xl border bg-card">
          <h3 className="border-b p-4 font-bold">Rendiciones de contra reembolso</h3>
          <ul className="divide-y">{rend.map((r) => (
            <li key={r.id} className="flex items-center justify-between gap-2 p-4 text-sm">
              <div><p className="font-semibold">Rendición {r.numero} · {r.cantidad} envíos</p><p className="text-xs text-muted-foreground">{formatDateTime(r.created_at)}{r.referencia ? ` · ${r.referencia}` : ""}</p></div>
              <div className="text-right"><p className="font-bold tabular-nums">{money(r.monto)}</p><p className={cn("text-xs font-semibold", r.estado === "pagada" ? "text-success" : "text-muted-foreground")}>{r.estado === "pagada" ? "Transferida" : "Pendiente"}</p></div>
            </li>))}</ul>
        </section>
      )}
      <section className="rounded-2xl border bg-card p-4">
        <h3 className="font-bold">Datos de facturación y retiro</h3>
        <p className="text-sm text-muted-foreground">Se usan en las etiquetas, los retiros y las facturas. Las condiciones comerciales (tarifas y forma de pago) las define Woref.</p>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          {campo("razon_social", "Razón social", { maxLength: 120 })}{campo("cuit", "CUIT", { inputMode: "numeric", maxLength: 13 })}
          <label className="text-xs font-semibold">Condición frente al IVA
            <select value={form.condicion_iva} onChange={(e) => setForm((f) => ({ ...f, condicion_iva: e.target.value }))} className="mt-1 h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Elegir…</option>{["responsable_inscripto", "monotributo", "exento", "consumidor_final"].map((v) => <option key={v} value={v}>{v.replace("_", " ").replace(/^./, (c) => c.toUpperCase())}</option>)}
            </select></label>
          {campo("contacto_nombre", "Persona de contacto", { maxLength: 80 })}{campo("email", "Email", { type: "email", maxLength: 160 })}{campo("telefono", "Teléfono", { inputMode: "tel", maxLength: 30 })}
          {campo("direccion_retiro", "Dirección de retiro", { maxLength: 200 })}{campo("ciudad", "Ciudad", { maxLength: 80 })}{campo("provincia", "Provincia", { maxLength: 60 })}{campo("cp", "Código postal", { inputMode: "numeric", maxLength: 4 })}
        </div>
        <Button className="mt-4 rounded-full" disabled={busy} onClick={guardar}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Guardar</Button>
      </section>
    </div>
  );
}

// ───────────────────────── Nuevo envío ─────────────────────────

function NuevoEnvio() {
  const { store, orders } = useMerchant();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const { cuenta, error } = useCuenta();
  const pedido = orders.find((o) => o.id === params.get("pedido"));

  if (error && !cuenta) return <ErrorState title="No pudimos abrir tu cuenta de envíos" error={error} />;
  if (!cuenta) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (cuenta.estado !== "activa") return <EmptyState icon={<Package className="h-7 w-7" />} title="Tu cuenta de envíos no está activa" text="Completá tus datos en Envíos → Mi cuenta. Te avisamos cuando la activemos." action={<Button asChild className="rounded-full"><Link to="/app/comercio/envios?vista=cuenta">Ir a Mi cuenta</Link></Button>} />;
  return (
    <div className="space-y-4">
      <Link to="/app/comercio/envios" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Envíos</Link>
      <h2 className="text-xl font-extrabold">Nuevo envío</h2>
      <FormularioEnvio comercio={store.id} cuenta={cuenta}
        inicial={{ rem_direccion: cuenta.direccion_retiro || store.direccion || "", ...(pedido ? { des_telefono: pedido.telefono_contacto ?? "", des_direccion: pedido.direccion_entrega ?? "", referencia: `Pedido ${shortId(pedido.id)}`, pedido_id: pedido.id } : {}) }}
        onCreado={(r) => { toast.success(`Envío ${r.numero} creado`); navigate(`/app/comercio/envios/${r.id}?creado=1`, { replace: true }); }} />
    </div>
  );
}

// ───────────────────────── Detalle ─────────────────────────

function DetalleEnvio({ id }: { id: string }) {
  const [params, setParams] = useSearchParams();
  const [e, setE] = useState<EnvioLog | null>(null);
  const [bultos, setBultos] = useState<BultoLog[]>([]);
  const [eventos, setEventos] = useState<EventoLog[]>([]);
  const [incs, setIncs] = useState<Incidencia[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [reclamo, setReclamo] = useState<{ tipo: string; texto: string } | null>(null);
  const { porId } = useSucursales();

  const cargar = useCallback(async () => {
    const [a, b, c, d] = await Promise.all([
      db.from("log_envios").select("*").eq("id", id).maybeSingle(),
      db.from("log_bultos").select("*").eq("envio_id", id).order("nro"),
      db.from("log_eventos").select("*").eq("envio_id", id).order("created_at", { ascending: false }),
      db.from("log_incidencias").select("*").eq("envio_id", id).order("created_at", { ascending: false }),
    ]);
    if (a.error || !a.data) { setError(a.error ?? new Error("No encontramos ese envío")); return; }
    setError(null); setE(a.data); setBultos(b.data ?? []); setEventos(c.data ?? []); setIncs(d.data ?? []);
  }, [id]);
  useEffect(() => {
    cargar();
    const canal = db.channel(`log-envio-${id}`).on("postgres_changes", { event: "*", schema: "public", table: "log_envios", filter: `id=eq.${id}` }, cargar).subscribe();
    return () => { db.removeChannel(canal); };
  }, [cargar, id]);

  const imprimir = () => { if (e && !imprimirEtiquetas([{ envio: e, bultos }], porId)) toast.error("Permití las ventanas emergentes para imprimir las etiquetas"); };
  const copiar = async () => { if (!e) return; try { await navigator.clipboard.writeText(enlaceSeguimiento(e.numero)); toast.success("Enlace copiado: compartilo con tu cliente"); } catch { toast.error("No se pudo copiar"); } };
  const cancelar = async () => {
    if (!e) return;
    const motivo = await pedirTexto({ titulo: "Cancelar el envío", descripcion: "Solo se puede antes de que recibamos el paquete. No se cobra.", etiqueta: "Motivo", inicial: "Ya no lo mando", maximo: 200, confirmar: "Cancelar envío", peligro: true });
    if (motivo === null) return;
    try { await cancelarEnvio(e.id, motivo); toast.success("Envío cancelado"); cargar(); } catch (err) { toast.error(errorMessage(err)); }
  };
  const enviarReclamo = async () => {
    if (!e || !reclamo) return;
    try { await abrirIncidencia(e.id, reclamo.tipo, reclamo.texto); toast.success("Reclamo enviado: te respondemos por acá"); setReclamo(null); cargar(); } catch (err) { toast.error(errorMessage(err)); }
  };

  if (error) return <ErrorState title="No pudimos abrir el envío" error={error} onRetry={cargar} />;
  if (!e) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const sd = e.sucursal_destino_id ? porId[e.sucursal_destino_id] : null;

  return (
    <div className="space-y-4">
      <Link to="/app/comercio/envios" className="inline-flex items-center gap-1 text-sm font-semibold text-muted-foreground hover:text-foreground"><ArrowLeft className="h-4 w-4" /> Envíos</Link>
      {params.get("creado") && e.estado === "creado" && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-success/30 bg-success/10 p-4">
          <div><p className="font-bold">¡Listo! Envío {e.numero} creado.</p><p className="text-sm text-muted-foreground">Imprimí la etiqueta y pegala en el paquete. {e.origen_modo === "retiro" ? "Después programá el retiro." : `Llevalo a ${e.sucursal_origen_id ? porId[e.sucursal_origen_id]?.nombre ?? "la sucursal" : "la sucursal"}.`}</p></div>
          <div className="flex gap-2"><Button className="rounded-full" onClick={imprimir}><Printer className="mr-1.5 h-4 w-4" /> Imprimir etiqueta</Button>
            {e.origen_modo === "retiro" && <Button variant="outline" className="rounded-full" asChild><Link to="/app/comercio/envios?vista=retiros">Programar retiro</Link></Button>}
            <Button variant="ghost" size="icon" className="rounded-full" aria-label="Cerrar aviso" onClick={() => setParams({}, { replace: true })}><X className="h-4 w-4" /></Button></div>
        </div>
      )}
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-muted-foreground">Envío {e.servicio === "express" ? "Express" : e.servicio === "prioritario" ? "Prioritario" : "Estándar"}{e.referencia ? ` · ${e.referencia}` : ""}</p>
          <h2 className="font-mono text-2xl font-extrabold tracking-tight">{e.numero}</h2>
          <div className="mt-1 flex items-center gap-2"><EstadoEnvio estado={e.estado} />{e.intentos > 0 && <span className="text-xs text-muted-foreground">{e.intentos} {e.intentos === 1 ? "visita" : "visitas"}</span>}</div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={imprimir}><Printer className="mr-1.5 h-4 w-4" /> Etiquetas</Button>
          <Button variant="outline" className="rounded-full" onClick={copiar}><Copy className="mr-1.5 h-4 w-4" /> Enlace de seguimiento</Button>
          <Button variant="ghost" className="rounded-full" asChild><a href={`/seguimiento/${e.numero}`} target="_blank" rel="noreferrer"><ExternalLink className="mr-1.5 h-4 w-4" /> Ver como cliente</a></Button>
        </div>
      </header>
      {!["cancelado", "devuelto", "siniestrado", "en_devolucion"].includes(e.estado) && <div className="rounded-2xl border bg-card p-4"><ProgresoEnvio estado={e.estado} />
        {e.fecha_estimada && e.estado !== "entregado" && <p className="mt-3 text-sm">Llegada estimada: <b className="capitalize">{fechaCorta(e.fecha_estimada)}</b></p>}
        {e.estado === "entregado" && <p className="mt-3 text-sm">Entregado el {formatDateTime(e.entregado_at)}{e.receptor_nombre ? ` a ${e.receptor_nombre}` : ""}{e.receptor_dni ? ` (DNI ${e.receptor_dni})` : ""}.</p>}
      </div>}

      <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <section className="rounded-2xl border bg-card p-4"><h3 className="mb-3 font-bold">Movimientos</h3><LineaTiempo eventos={eventosVista(eventos, porId)} /></section>
          {incs.length > 0 && (
            <section className="rounded-2xl border bg-card p-4"><h3 className="mb-2 font-bold">Reclamos</h3>
              <ul className="space-y-3">{incs.map((i) => (
                <li key={i.id} className="rounded-xl bg-muted/50 p-3 text-sm">
                  <p className="font-semibold">#{i.numero} · {TIPOS_INCIDENCIA[i.tipo] ?? i.tipo} <span className={cn("ml-1 text-xs font-bold", i.estado === "resuelta" ? "text-success" : "text-warning-foreground")}>{i.estado === "resuelta" ? "Resuelto" : i.estado === "en_gestion" ? "En gestión" : "Abierto"}</span></p>
                  <p className="text-muted-foreground">{i.descripcion}</p>{i.resolucion && <p className="mt-1"><b>Respuesta: </b>{i.resolucion}</p>}
                </li>))}</ul>
            </section>
          )}
          {e.estado !== "cancelado" && e.estado !== "creado" && (reclamo ? (
            <section className="space-y-2 rounded-2xl border bg-card p-4"><h3 className="font-bold">Hacer un reclamo</h3>
              <select value={reclamo.tipo} onChange={(ev) => setReclamo({ ...reclamo, tipo: ev.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm" aria-label="Motivo">
                {Object.entries(TIPOS_INCIDENCIA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
              <Textarea value={reclamo.texto} onChange={(ev) => setReclamo({ ...reclamo, texto: ev.target.value })} maxLength={1000} className="min-h-[80px]" placeholder="Contanos qué pasó" aria-label="Detalle del reclamo" />
              <div className="flex gap-2"><Button className="rounded-full" disabled={reclamo.texto.trim().length < 5} onClick={enviarReclamo}>Enviar reclamo</Button><Button variant="ghost" className="rounded-full" onClick={() => setReclamo(null)}>Volver</Button></div>
            </section>
          ) : <Button variant="outline" className="rounded-full" onClick={() => setReclamo({ tipo: "demora", texto: "" })}><MessageSquareWarning className="mr-1.5 h-4 w-4" /> Hacer un reclamo</Button>)}
          {e.estado === "creado" && <Button variant="ghost" className="rounded-full text-destructive hover:text-destructive" onClick={cancelar}>Cancelar envío</Button>}
        </div>
        <aside className="space-y-4">
          <section className="rounded-2xl border bg-card p-4 text-sm"><h3 className="mb-2 font-bold">Destinatario</h3>
            <p className="font-semibold">{e.des_nombre}</p><p>{e.des_telefono}{e.des_email ? ` · ${e.des_email}` : ""}</p>
            <p className="mt-1 text-muted-foreground">{sd ? `Retira en ${sd.nombre} — ${sd.direccion}, ${sd.ciudad}` : `${e.des_direccion}, ${e.des_ciudad}, ${e.des_provincia} (${e.des_cp})`}</p>
            {e.des_notas && <p className="mt-1 text-xs text-muted-foreground">“{e.des_notas}”</p>}
          </section>
          <section className="rounded-2xl border bg-card p-4 text-sm"><h3 className="mb-2 font-bold">Paquetes</h3>
            <ul className="space-y-1">{bultos.map((b) => <li key={b.id} className="flex justify-between"><span className="font-mono text-xs">{b.codigo}</span><span>{b.peso_kg} kg{b.alto_cm ? ` · ${b.alto_cm}×${b.ancho_cm}×${b.largo_cm} cm` : ""}</span></li>)}</ul>
            <p className="mt-2 text-xs text-muted-foreground">{e.peso_facturable} kg facturables{e.contenido ? ` · ${e.contenido}` : ""}</p>
            {Number(e.reembolso) > 0 && <p className="mt-2 font-semibold">Contra reembolso: {money(e.reembolso)} {e.reembolso_cobrado ? <span className="text-success">· cobrado</span> : null}</p>}
          </section>
          <section className="rounded-2xl border bg-card p-4 text-sm"><h3 className="mb-2 font-bold">Precio</h3>
            <dl className="space-y-1">{([["Flete", e.precio_flete], ["Seguro", e.precio_seguro], ["Comisión contra reembolso", e.precio_reembolso], ["Retiro", e.precio_retiro]] as [string, number][]).filter(([, v]) => Number(v) > 0).map(([k, v]) => <div key={k} className="flex justify-between"><dt className="text-muted-foreground">{k}</dt><dd className="tabular-nums">{money(v)}</dd></div>)}
              <div className="flex justify-between border-t pt-1 font-bold"><dt>Total</dt><dd className="tabular-nums">{money(e.precio_total)}</dd></div></dl>
          </section>
        </aside>
      </div>
    </div>
  );
}
