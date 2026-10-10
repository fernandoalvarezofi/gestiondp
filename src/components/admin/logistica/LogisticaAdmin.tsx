import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ClipboardList, Loader2, Package, Printer, ScanLine, Search, Truck, X, XCircle, PackagePlus, PackageCheck, CalendarDays, Banknote } from "lucide-react";
import { toast } from "sonner";
import { Metric, MetricStrip, PageIntro } from "@/components/panel/kit";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { confirmar, pedirTexto } from "@/components/ui/dialogos";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import {
  actualizarIncidencia, actualizarRetiro, avanzar, BultoLog, cerrarHoja, crearHoja, EnvioLog, escanear, esFinal, ESTADOS_LOG, EstadoLog, EventoLog, fechaCorta, FRANJA, Incidencia,
  paraEtiquetas, PIDE_SUCURSAL, Retiro, SIGUIENTES, TIPOS_INCIDENCIA,
} from "@/services/logistica";
import { EstadoEnvio, eventosVista, imprimirEtiquetas, LineaTiempo, useSucursales } from "@/components/logistica/comun";
import { LogisticaCuentas } from "./LogisticaCuentas";
import { LogisticaConfig } from "./LogisticaConfig";

/**
 * Back office de Woref Logística (estilo Andreani/OCA): tablero, envíos, escaneo en depósito, retiros, hojas de ruta,
 * reclamos, cuentas (CRM) y configuración. Todas las acciones pasan por funciones del servidor que validan el rol.
 */
const TABS = [
  ["tablero", "Tablero"], ["envios", "Envíos"], ["escaneo", "Escaneo"], ["retiros", "Retiros"], ["hojas", "Hojas de ruta"], ["incidencias", "Reclamos"], ["cuentas", "Cuentas"], ["config", "Configuración"],
] as const;
type Tab = (typeof TABS)[number][0];

export function LogisticaAdmin() {
  const [params, setParams] = useSearchParams();
  const tab = (TABS.some(([t]) => t === params.get("tab")) ? params.get("tab") : "tablero") as Tab;
  const ir = (t: Tab) => setParams(t === "tablero" ? {} : { tab: t }, { replace: true });
  return (
    <div className="space-y-5">
      <PageIntro description="Paquetería local e interurbana: admisión, depósito, tránsito entre sucursales, última milla y cuentas de clientes." />
      <div role="tablist" aria-label="Logística" className="scrollbar-none flex gap-2 overflow-x-auto">
        {TABS.map(([t, label]) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => ir(t)} className={cn("h-9 shrink-0 rounded-full border px-4 text-sm font-bold", tab === t ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{label}</button>
        ))}
      </div>
      {tab === "tablero" && <Tablero ir={ir} />}
      {tab === "envios" && <Envios />}
      {tab === "escaneo" && <Escaneo />}
      {tab === "retiros" && <Retiros />}
      {tab === "hojas" && <Hojas />}
      {tab === "incidencias" && <Incidencias />}
      {tab === "cuentas" && <LogisticaCuentas />}
      {tab === "config" && <LogisticaConfig />}
    </div>
  );
}

const Cargando = () => <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

// ───────────────────────── Tablero ─────────────────────────

type Tab0 = { por_estado: Partial<Record<EstadoLog, number>>; creados_hoy: number; entregados_hoy: number; demorados: number; incidencias_abiertas: number; retiros_hoy: number; retiros_sin_asignar: number; hojas_abiertas: number; reembolsos_sin_rendir: number; facturado_mes: number; envios_mes: number };

function Tablero({ ir }: { ir: (t: Tab) => void }) {
  const [d, setD] = useState<Tab0 | null>(null);
  const [error, setError] = useState<unknown>(null);
  const cargar = useCallback(async () => { const { data, error: e } = await db.rpc("log_tablero"); if (e) setError(e); else { setError(null); setD(data); } }, []);
  useEffect(() => { cargar(); const t = setInterval(cargar, 60000); return () => clearInterval(t); }, [cargar]);
  if (error && !d) return <ErrorState error={error} onRetry={cargar} />;
  if (!d) return <Cargando />;
  const flujo: EstadoLog[] = ["creado", "admitido", "en_centro", "en_transito", "en_sucursal", "en_distribucion", "visita_fallida", "en_devolucion"];
  const max = Math.max(1, ...flujo.map((e) => d.por_estado[e] ?? 0));
  const alertas = [
    d.retiros_sin_asignar > 0 && { t: `${d.retiros_sin_asignar} retiros sin repartidor`, tab: "retiros" as Tab },
    d.demorados > 0 && { t: `${d.demorados} envíos pasados de la fecha estimada`, tab: "envios" as Tab },
    d.incidencias_abiertas > 0 && { t: `${d.incidencias_abiertas} reclamos abiertos`, tab: "incidencias" as Tab },
    (d.por_estado.visita_fallida ?? 0) > 0 && { t: `${d.por_estado.visita_fallida} visitas fallidas para reprogramar`, tab: "envios" as Tab },
  ].filter(Boolean) as { t: string; tab: Tab }[];
  return (
    <div className="space-y-5">
      <MetricStrip cols={5}>
        <Metric icon={<PackagePlus />} tone="ink" label="Creados hoy" value={d.creados_hoy} />
        <Metric icon={<PackageCheck />} tone="brand" label="Entregados hoy" value={d.entregados_hoy} />
        <Metric icon={<Truck />} tone="info" label="Retiros de hoy" value={d.retiros_hoy} hint={`${d.hojas_abiertas} hojas de ruta abiertas`} />
        <Metric icon={<CalendarDays />} tone="ink" label="Envíos del mes" value={d.envios_mes} hint={money(d.facturado_mes)} />
        <Metric icon={<Banknote />} tone="accent" label="Contra reembolso sin rendir" value={money(d.reembolsos_sin_rendir)} />
      </MetricStrip>
      {alertas.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2">{alertas.map((a) => (
          <li key={a.t}><button type="button" onClick={() => ir(a.tab)} className="flex w-full items-center gap-2 rounded-2xl border border-warning/40 bg-warning/10 p-3 text-left text-sm font-semibold hover:bg-warning/20"><AlertTriangle className="h-4 w-4 shrink-0 text-warning-foreground" />{a.t}</button></li>
        ))}</ul>
      )}
      <section className="rounded-2xl border bg-card p-4">
        <h3 className="mb-3 font-bold">Envíos por etapa</h3>
        <ul className="space-y-2">{flujo.map((e) => (
          <li key={e} className="grid grid-cols-[150px_1fr_40px] items-center gap-3 text-sm">
            <span className="truncate font-semibold">{ESTADOS_LOG[e].texto}</span>
            <span className="h-2.5 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${((d.por_estado[e] ?? 0) / max) * 100}%` }} /></span>
            <span className="text-right font-bold tabular-nums">{d.por_estado[e] ?? 0}</span>
          </li>
        ))}</ul>
      </section>
    </div>
  );
}

// ───────────────────────── Envíos ─────────────────────────

type FilaEnvio = EnvioLog & { cuenta?: { numero: number; razon_social: string } | null };

function Envios() {
  const [rows, setRows] = useState<FilaEnvio[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [estado, setEstado] = useState<"activos" | "demorados" | EstadoLog | "todos">("activos");
  const [q, setQ] = useState("");
  const [abierto, setAbierto] = useState<string | null>(null);
  const cargar = useCallback(async () => {
    let query = db.from("log_envios").select("*, cuenta:log_cuentas(numero, razon_social)").order("created_at", { ascending: false }).limit(300);
    const t = q.trim();
    if (t) query = /^wr\d+/i.test(t) ? query.ilike("numero", `${t.toUpperCase().split("-")[0]}%`) : query.or(`des_nombre.ilike.%${t.replace(/[%,()]/g, "")}%,referencia.ilike.%${t.replace(/[%,()]/g, "")}%,des_ciudad.ilike.%${t.replace(/[%,()]/g, "")}%`);
    if (estado === "activos") query = query.not("estado", "in", "(entregado,devuelto,cancelado,siniestrado)");
    else if (estado === "demorados") query = query.lt("fecha_estimada", new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date())).not("estado", "in", "(entregado,devuelto,cancelado,siniestrado)");
    else if (estado !== "todos") query = query.eq("estado", estado);
    const { data, error: e } = await query;
    if (e) { setError(e); return; }
    setError(null); setRows(data ?? []);
  }, [estado, q]);
  useEffect(() => { const t = setTimeout(cargar, q ? 300 : 0); return () => clearTimeout(t); }, [cargar, q]);

  const opciones: [typeof estado, string][] = [["activos", "En curso"], ["demorados", "Demorados"], ["creado", "Sin ingresar"], ["en_centro", "En centro"], ["en_distribucion", "En reparto"], ["visita_fallida", "Visita fallida"], ["en_devolucion", "En devolución"], ["entregado", "Entregados"], ["todos", "Todos"]];
  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="scrollbar-none flex gap-2 overflow-x-auto">{opciones.map(([v, t]) => (
          <button key={v} type="button" onClick={() => setEstado(v)} className={cn("shrink-0 rounded-full border px-3.5 py-1.5 text-sm font-bold", estado === v ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{t}</button>
        ))}</div>
        <label className="relative lg:w-72"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="WR…, destinatario, ciudad o referencia" className="pl-9" aria-label="Buscar envíos" /></label>
      </div>
      {error && !rows ? <ErrorState error={error} onRetry={cargar} /> : !rows ? <Cargando /> : rows.length === 0 ? <EmptyState icon={<Package className="h-7 w-7" />} title="No hay envíos con este filtro" /> : (
        <div className="overflow-x-auto rounded-2xl border bg-card">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs font-semibold text-muted-foreground"><tr><th className="p-3">Envío</th><th className="p-3">Cuenta</th><th className="p-3">Destino</th><th className="p-3">Estado</th><th className="p-3">Estimado</th><th className="p-3 text-right">Total</th></tr></thead>
            <tbody className="divide-y">{rows.map((e) => {
              const demorado = !esFinal(e.estado) && e.fecha_estimada && e.fecha_estimada < new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
              return (
                <tr key={e.id} className="cursor-pointer hover:bg-muted/30" onClick={() => setAbierto(e.id)}>
                  <td className="p-3"><span className="font-mono text-[13px] font-bold">{e.numero}</span><p className="text-xs text-muted-foreground">{formatDateTime(e.created_at)} · {e.servicio}</p></td>
                  <td className="p-3"><p className="font-semibold">{e.cuenta?.razon_social ?? "—"}</p><p className="text-xs text-muted-foreground">N.º {e.cuenta?.numero}</p></td>
                  <td className="p-3"><p className="font-semibold">{e.des_nombre}</p><p className="text-xs text-muted-foreground">{e.des_ciudad} ({e.des_cp}){e.entrega_modo === "sucursal" ? " · sucursal" : ""}</p></td>
                  <td className="p-3"><EstadoEnvio estado={e.estado} />{Number(e.reembolso) > 0 && <p className="mt-1 text-xs text-muted-foreground">CR {money(e.reembolso)}</p>}</td>
                  <td className={cn("p-3 text-xs capitalize", demorado && "font-bold text-destructive")}>{e.fecha_estimada ? fechaCorta(e.fecha_estimada) : "—"}</td>
                  <td className="p-3 text-right font-semibold tabular-nums">{money(e.precio_total)}</td>
                </tr>
              );
            })}</tbody>
          </table>
        </div>
      )}
      {abierto && <EnvioOperacion id={abierto} onCerrar={() => setAbierto(null)} onCambio={cargar} />}
    </div>
  );
}

function EnvioOperacion({ id, onCerrar, onCambio }: { id: string; onCerrar: () => void; onCambio: () => void }) {
  const [e, setE] = useState<EnvioLog | null>(null);
  const [bultos, setBultos] = useState<BultoLog[]>([]);
  const [eventos, setEventos] = useState<EventoLog[]>([]);
  const [destino, setDestino] = useState<EstadoLog | "">("");
  const [suc, setSuc] = useState("");
  const [detalle, setDetalle] = useState("");
  const [receptor, setReceptor] = useState({ nombre: "", dni: "", cobrado: false });
  const [busy, setBusy] = useState(false);
  const { lista: sucursales, porId } = useSucursales();
  const cargar = useCallback(async () => {
    const [a, b, c] = await Promise.all([db.from("log_envios").select("*").eq("id", id).single(), db.from("log_bultos").select("*").eq("envio_id", id).order("nro"), db.from("log_eventos").select("*").eq("envio_id", id).order("created_at", { ascending: false })]);
    setE(a.data); setBultos(b.data ?? []); setEventos(c.data ?? []); setDestino(""); setDetalle("");
  }, [id]);
  useEffect(() => { cargar(); }, [cargar]);
  const aplicar = async () => {
    if (!e || !destino) return;
    setBusy(true);
    try {
      await avanzar(e.id, destino, { sucursal: suc || null, detalle: detalle || null, receptorNombre: receptor.nombre || null, receptorDni: receptor.dni || null, cobrado: receptor.cobrado });
      toast.success(`Envío ${e.numero}: ${ESTADOS_LOG[destino].texto}`); await cargar(); onCambio();
    } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(false); }
  };
  const siguientes = e ? SIGUIENTES[e.estado] ?? [] : [];
  return (
    <Dialog open onOpenChange={(o) => !o && onCerrar()}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogTitle className="font-mono">{e?.numero ?? "Envío"}</DialogTitle>
        <DialogDescription className="sr-only">Detalle y operación del envío</DialogDescription>
        {!e ? <Cargando /> : (
          <div className="grid gap-4 md:grid-cols-[1fr_280px]">
            <div className="space-y-4">
              <div className="flex flex-wrap items-center gap-2"><EstadoEnvio estado={e.estado} /><span className="text-xs text-muted-foreground">{e.servicio} · {e.bultos} bultos · {e.peso_facturable} kg · intentos {e.intentos}</span>
                <Button size="sm" variant="outline" className="ml-auto rounded-full" onClick={() => { if (!imprimirEtiquetas([{ envio: e, bultos }], porId)) toast.error("Permití las ventanas emergentes"); }}><Printer className="mr-1.5 h-4 w-4" /> Etiquetas</Button></div>
              {siguientes.length > 0 && (
                <section className="space-y-2 rounded-2xl border p-3">
                  <h4 className="text-sm font-bold">Cambiar estado</h4>
                  <div className="flex flex-wrap gap-1.5">{siguientes.map((s) => (
                    <button key={s} type="button" onClick={() => setDestino(s)} className={cn("rounded-full border px-3 py-1 text-xs font-bold", destino === s ? "border-primary bg-primary text-primary-foreground" : "hover:bg-muted")}>{ESTADOS_LOG[s].texto}</button>
                  ))}</div>
                  {destino && (
                    <div className="space-y-2">
                      {(PIDE_SUCURSAL.includes(destino) || destino === "en_transito") && (
                        <select value={suc} onChange={(ev) => setSuc(ev.target.value)} className="h-9 w-full rounded-md border bg-background px-2 text-sm" aria-label="Sucursal">
                          <option value="">{destino === "en_transito" ? "Hacia (opcional)…" : "Sucursal…"}</option>{sucursales.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}
                        </select>
                      )}
                      {destino === "entregado" && (
                        <div className="grid grid-cols-2 gap-2">
                          <Input placeholder="Recibió (nombre)" value={receptor.nombre} onChange={(ev) => setReceptor({ ...receptor, nombre: ev.target.value })} />
                          <Input placeholder="DNI sin puntos" inputMode="numeric" value={receptor.dni} onChange={(ev) => setReceptor({ ...receptor, dni: ev.target.value.replace(/\D/g, "") })} />
                          {Number(e.reembolso) > 0 && <label className="col-span-2 flex items-center gap-2 text-sm"><input type="checkbox" checked={receptor.cobrado} onChange={(ev) => setReceptor({ ...receptor, cobrado: ev.target.checked })} /> Cobrado el contra reembolso de {money(e.reembolso)}</label>}
                        </div>
                      )}
                      <Input placeholder={destino === "visita_fallida" ? "Motivo (obligatorio)" : "Detalle (opcional)"} value={detalle} onChange={(ev) => setDetalle(ev.target.value)} maxLength={300} />
                      <Button size="sm" className="rounded-full" disabled={busy} onClick={aplicar}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Confirmar: {ESTADOS_LOG[destino].texto}</Button>
                    </div>
                  )}
                </section>
              )}
              <section><h4 className="mb-2 text-sm font-bold">Movimientos</h4><LineaTiempo eventos={eventosVista(eventos, porId)} /></section>
            </div>
            <aside className="space-y-3 text-sm">
              <div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs font-bold text-muted-foreground">REMITENTE</p><p className="font-semibold">{e.rem_nombre}</p><p>{e.origen_modo === "retiro" ? e.rem_direccion : `Despacha en ${e.sucursal_origen_id ? porId[e.sucursal_origen_id]?.nombre ?? "sucursal" : "sucursal"}`}</p><p className="text-muted-foreground">{e.rem_ciudad} ({e.rem_cp}) · {e.rem_telefono}</p></div>
              <div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs font-bold text-muted-foreground">DESTINATARIO</p><p className="font-semibold">{e.des_nombre}{e.des_dni ? ` · DNI ${e.des_dni}` : ""}</p><p>{e.des_direccion}</p><p className="text-muted-foreground">{e.des_ciudad}, {e.des_provincia} ({e.des_cp}) · {e.des_telefono}</p>{e.des_notas && <p className="mt-1 text-xs">“{e.des_notas}”</p>}</div>
              <div className="rounded-2xl bg-muted/50 p-3"><p className="text-xs font-bold text-muted-foreground">IMPORTES</p><p>Total {money(e.precio_total)} · Declarado {money(e.valor_declarado)}</p>{Number(e.reembolso) > 0 && <p>Contra reembolso {money(e.reembolso)} {e.reembolso_cobrado ? "(cobrado)" : ""}</p>}</div>
              <ul className="space-y-0.5">{bultos.map((b) => <li key={b.id} className="font-mono text-xs">{b.codigo} · {b.peso_kg} kg</li>)}</ul>
            </aside>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

// ───────────────────────── Escaneo ─────────────────────────

const ESTADOS_ESCANEO: EstadoLog[] = ["admitido", "en_centro", "en_transito", "en_sucursal", "en_distribucion", "en_devolucion", "devuelto"];

function Escaneo() {
  const { lista: sucursales } = useSucursales();
  const [estado, setEstado] = useState<EstadoLog>("en_centro");
  const [suc, setSuc] = useState("");
  const [codigos, setCodigos] = useState<string[]>([]);
  const [actual, setActual] = useState("");
  const [res, setRes] = useState<{ codigo: string; numero?: string; ok: boolean; mensaje: string }[] | null>(null);
  const [busy, setBusy] = useState(false);
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => { if (!suc && sucursales[0]) setSuc(sucursales[0].id); }, [sucursales, suc]);
  const agregar = () => {
    const nuevos = actual.split(/[\s,;]+/).map((c) => c.trim().toUpperCase()).filter(Boolean);
    if (nuevos.length) setCodigos((cs) => [...cs, ...nuevos.filter((n) => !cs.includes(n))]);
    setActual(""); ref.current?.focus();
  };
  const procesar = async () => {
    setBusy(true);
    try { const r = await escanear(codigos, estado, PIDE_SUCURSAL.includes(estado) || estado === "en_transito" ? suc || null : null); setRes(r); setCodigos([]); const ok = r.filter((x) => x.ok).length; toast[ok === r.length ? "success" : "warning"](`${ok} de ${r.length} procesados`); }
    catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); ref.current?.focus(); }
  };
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_1fr]">
      <section className="space-y-3 rounded-2xl border bg-card p-4">
        <h3 className="flex items-center gap-2 font-bold"><ScanLine className="h-5 w-5 text-primary" /> Escaneo masivo</h3>
        <p className="text-sm text-muted-foreground">Usá un lector de códigos (escribe y da Enter) o pegá varios números. Cada envío se procesa por separado y te decimos cuál falló.</p>
        <div className="grid gap-2 sm:grid-cols-2">
          <label className="text-xs font-semibold">Nuevo estado<select value={estado} onChange={(e) => setEstado(e.target.value as EstadoLog)} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm">{ESTADOS_ESCANEO.map((s) => <option key={s} value={s}>{ESTADOS_LOG[s].texto}</option>)}</select></label>
          {(PIDE_SUCURSAL.includes(estado) || estado === "en_transito") && <label className="text-xs font-semibold">{estado === "en_transito" ? "Hacia" : "Sucursal"}<select value={suc} onChange={(e) => setSuc(e.target.value)} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm">{sucursales.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}</select></label>}
        </div>
        <form onSubmit={(e) => { e.preventDefault(); agregar(); }}><Input ref={ref} autoFocus value={actual} onChange={(e) => setActual(e.target.value)} placeholder="Escaneá o escribí WR…-01" className="h-12 font-mono text-base uppercase" aria-label="Código a escanear" /></form>
        {codigos.length > 0 && (
          <div className="flex flex-wrap gap-1.5">{codigos.map((c) => <span key={c} className="inline-flex items-center gap-1 rounded-full bg-muted px-2.5 py-1 font-mono text-xs font-bold">{c}<button type="button" aria-label={`Quitar ${c}`} onClick={() => setCodigos((cs) => cs.filter((x) => x !== c))}><X className="h-3 w-3" /></button></span>)}</div>
        )}
        <Button className="rounded-full" disabled={busy || codigos.length === 0} onClick={procesar}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Procesar {codigos.length || ""} → {ESTADOS_LOG[estado].texto}</Button>
      </section>
      <section className="rounded-2xl border bg-card p-4">
        <h3 className="mb-2 font-bold">Resultado</h3>
        {!res ? <p className="text-sm text-muted-foreground">Acá vas a ver qué se procesó.</p> : (
          <ul className="divide-y text-sm">{res.map((r, i) => (
            <li key={`${r.codigo}-${i}`} className="flex items-center gap-2 py-2">{r.ok ? <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> : <XCircle className="h-4 w-4 shrink-0 text-destructive" />}<span className="font-mono text-xs font-bold">{r.codigo}</span><span className={cn("ml-auto text-right text-xs", !r.ok && "font-semibold text-destructive")}>{r.mensaje}</span></li>
          ))}</ul>
        )}
      </section>
    </div>
  );
}

// ───────────────────────── Repartidores (para retiros y hojas) ─────────────────────────

function useRepartidores() {
  const [lista, setLista] = useState<{ perfil_id: string; nombre: string }[]>([]);
  useEffect(() => {
    db.from("delivery_repartidores").select("perfil_id, perfil:perfiles(nombre)").eq("activo", true).then(({ data }: { data: { perfil_id: string; perfil: { nombre: string } | null }[] | null }) =>
      setLista((data ?? []).map((r) => ({ perfil_id: r.perfil_id, nombre: r.perfil?.nombre ?? "Sin nombre" })).sort((a, b) => a.nombre.localeCompare(b.nombre))));
  }, []);
  return lista;
}

// ───────────────────────── Retiros ─────────────────────────

type FilaRetiro = Retiro & { cuenta: { numero: number; razon_social: string } | null; envios: { count: number }[] };

function Retiros() {
  const [rows, setRows] = useState<FilaRetiro[] | null>(null);
  const [filtro, setFiltro] = useState<"pendientes" | "hoy" | "todos">("pendientes");
  const repartidores = useRepartidores();
  const nombre = useMemo(() => Object.fromEntries(repartidores.map((r) => [r.perfil_id, r.nombre])), [repartidores]);
  const cargar = useCallback(async () => {
    let q = db.from("log_retiros").select("*, cuenta:log_cuentas(numero, razon_social), envios:log_envios(count)").order("fecha").order("franja").limit(200);
    const hoy = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Argentina/Buenos_Aires" }).format(new Date());
    if (filtro === "pendientes") q = q.in("estado", ["solicitado", "asignado"]);
    else if (filtro === "hoy") q = q.eq("fecha", hoy);
    else q = q.order("created_at", { ascending: false });
    const { data } = await q;
    setRows(data ?? []);
  }, [filtro]);
  useEffect(() => { cargar(); }, [cargar]);
  const run = async (fn: () => Promise<void>, ok: string) => { try { await fn(); toast.success(ok); cargar(); } catch (e) { toast.error(errorMessage(e)); } };
  const fallido = async (r: FilaRetiro) => {
    const motivo = await pedirTexto({ titulo: "No se pudo retirar", etiqueta: "Motivo (lo ve el cliente)", maximo: 200, confirmar: "Marcar como fallido", peligro: true });
    if (motivo) run(() => actualizarRetiro(r.id, "fallido", null, motivo), "Retiro marcado como fallido");
  };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">{([["pendientes", "Pendientes"], ["hoy", "Hoy"], ["todos", "Todos"]] as const).map(([v, t]) => (
        <button key={v} type="button" onClick={() => setFiltro(v)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-bold", filtro === v ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{t}</button>
      ))}</div>
      {!rows ? <Cargando /> : rows.length === 0 ? <EmptyState icon={<Truck className="h-7 w-7" />} title="No hay retiros en esta lista" /> : (
        <ul className="divide-y overflow-hidden rounded-2xl border bg-card">{rows.map((r) => (
          <li key={r.id} className="flex flex-wrap items-center gap-3 p-4">
            <div className="min-w-0 flex-1">
              <p className="font-semibold"><span className="capitalize">{fechaCorta(r.fecha)}</span> · {FRANJA[r.franja]} · {r.cuenta?.razon_social}</p>
              <p className="truncate text-xs text-muted-foreground">{r.direccion}{r.cp ? ` (${r.cp})` : ""} · {r.envios?.[0]?.count ?? 0} envíos{r.contacto ? ` · ${r.contacto}` : ""}{r.telefono ? ` ${r.telefono}` : ""}{r.notas ? ` · “${r.notas}”` : ""}</p>
              {r.repartidor_id && <p className="text-xs font-semibold">Repartidor: {nombre[r.repartidor_id] ?? "—"}</p>}
            </div>
            <span className="rounded-full bg-muted px-2.5 py-0.5 text-xs font-bold capitalize">{r.estado}</span>
            {["solicitado", "asignado"].includes(r.estado) && (
              <div className="flex flex-wrap gap-2">
                <select aria-label="Asignar repartidor" value={r.repartidor_id ?? ""} onChange={(e) => e.target.value && run(() => actualizarRetiro(r.id, "asignado", e.target.value), "Repartidor asignado")} className="h-8 rounded-md border bg-background px-2 text-xs">
                  <option value="">Asignar…</option>{repartidores.map((p) => <option key={p.perfil_id} value={p.perfil_id}>{p.nombre}</option>)}
                </select>
                <Button size="sm" className="h-8 rounded-full" onClick={() => run(() => actualizarRetiro(r.id, "realizado"), "Retirado: envíos admitidos")}>Retirado</Button>
                <Button size="sm" variant="ghost" className="h-8 rounded-full" onClick={() => fallido(r)}>Falló</Button>
              </div>
            )}
          </li>
        ))}</ul>
      )}
    </div>
  );
}

// ───────────────────────── Hojas de ruta ─────────────────────────

type Hoja = { id: string; numero: number; repartidor_id: string; sucursal_id: string | null; fecha: string; estado: "abierta" | "cerrada"; created_at: string; cerrada_at: string | null; envios: { id: string; numero: string; estado: EstadoLog; des_nombre: string; des_direccion: string | null; des_ciudad: string; reembolso: number; reembolso_cobrado: boolean }[] };

function Hojas() {
  const [rows, setRows] = useState<Hoja[] | null>(null);
  const [ver, setVer] = useState<"abierta" | "cerrada">("abierta");
  const [nueva, setNueva] = useState(false);
  const repartidores = useRepartidores();
  const { lista: sucursales, porId } = useSucursales();
  const nombre = useMemo(() => Object.fromEntries(repartidores.map((r) => [r.perfil_id, r.nombre])), [repartidores]);
  const [form, setForm] = useState({ repartidor: "", sucursal: "", codigos: "" });
  const [busy, setBusy] = useState(false);
  const cargar = useCallback(async () => {
    const { data } = await db.from("log_hojas_ruta").select("*, envios:log_envios(id, numero, estado, des_nombre, des_direccion, des_ciudad, reembolso, reembolso_cobrado)").eq("estado", ver).order("created_at", { ascending: false }).limit(60);
    setRows(data ?? []);
  }, [ver]);
  useEffect(() => { cargar(); }, [cargar]);
  useEffect(() => { if (!form.sucursal && sucursales[0]) setForm((f) => ({ ...f, sucursal: sucursales[0].id })); }, [sucursales, form.sucursal]);
  const crear = async () => {
    setBusy(true);
    try {
      const r = await crearHoja(form.repartidor, form.sucursal || null, form.codigos.split(/[\s,;]+/).map((c) => c.trim()).filter(Boolean));
      toast.success(`Hoja ${r.numero}: ${r.cargados} envíos cargados`);
      if (r.errores?.length) toast.warning(r.errores.map((e) => `${e.codigo}: ${e.mensaje}`).join(" · "));
      setNueva(false); setForm((f) => ({ ...f, codigos: "" })); cargar();
    } catch (e) { toast.error(errorMessage(e)); } finally { setBusy(false); }
  };
  const cerrar = async (h: Hoja) => {
    const pend = h.envios.filter((e) => e.estado === "en_distribucion").length;
    if (!(await confirmar({ titulo: `Cerrar la hoja ${h.numero}`, descripcion: pend ? `${pend} envíos siguen en reparto: vuelven al centro como visita sin éxito.` : "Todos los envíos están resueltos.", confirmar: "Cerrar hoja" }))) return;
    try { await cerrarHoja(h.id); toast.success("Hoja cerrada"); cargar(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const imprimir = async (h: Hoja) => {
    try { if (!imprimirEtiquetas(await paraEtiquetas(h.envios.map((e) => e.id)), porId)) toast.error("Permití las ventanas emergentes"); } catch (e) { toast.error(errorMessage(e)); }
  };
  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex gap-2">{(["abierta", "cerrada"] as const).map((v) => <button key={v} type="button" onClick={() => setVer(v)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-bold", ver === v ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{v === "abierta" ? "Abiertas" : "Cerradas"}</button>)}</div>
        <Button className="rounded-full" onClick={() => setNueva((x) => !x)}><ClipboardList className="mr-1.5 h-4 w-4" /> Nueva hoja de ruta</Button>
      </div>
      {nueva && (
        <section className="space-y-3 rounded-2xl border bg-card p-4">
          <h3 className="font-bold">Armar hoja de ruta</h3>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="text-xs font-semibold">Repartidor<select value={form.repartidor} onChange={(e) => setForm({ ...form, repartidor: e.target.value })} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm"><option value="">Elegir…</option>{repartidores.map((p) => <option key={p.perfil_id} value={p.perfil_id}>{p.nombre}</option>)}</select></label>
            <label className="text-xs font-semibold">Sale de<select value={form.sucursal} onChange={(e) => setForm({ ...form, sucursal: e.target.value })} className="mt-1 h-10 w-full rounded-md border bg-background px-2 text-sm">{sucursales.map((s) => <option key={s.id} value={s.id}>{s.codigo} · {s.nombre}</option>)}</select></label>
          </div>
          <label className="block text-xs font-semibold">Envíos (escaneá o pegá los números)<Textarea value={form.codigos} onChange={(e) => setForm({ ...form, codigos: e.target.value })} className="mt-1 min-h-[100px] font-mono uppercase" placeholder={"WR0001000001\nWR0001000002-01"} /></label>
          <Button className="rounded-full" disabled={busy || !form.repartidor || !form.codigos.trim()} onClick={crear}>{busy && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}Crear y salir a reparto</Button>
        </section>
      )}
      {!rows ? <Cargando /> : rows.length === 0 ? <EmptyState icon={<ClipboardList className="h-7 w-7" />} title={ver === "abierta" ? "No hay hojas en reparto" : "Sin hojas cerradas"} /> : (
        <div className="grid gap-3 lg:grid-cols-2">{rows.map((h) => {
          const entregados = h.envios.filter((e) => e.estado === "entregado").length;
          const cobrar = h.envios.filter((e) => Number(e.reembolso) > 0 && e.reembolso_cobrado).reduce((s, e) => s + Number(e.reembolso), 0);
          return (
            <section key={h.id} className="rounded-2xl border bg-card p-4">
              <div className="flex items-start justify-between gap-2">
                <div><p className="font-bold">Hoja {h.numero} · {nombre[h.repartidor_id] ?? "Repartidor"}</p><p className="text-xs text-muted-foreground">{formatDateTime(h.created_at)} · {entregados}/{h.envios.length} entregados{cobrar > 0 ? ` · rinde ${money(cobrar)} en efectivo` : ""}</p></div>
                <div className="flex gap-1.5"><Button size="sm" variant="ghost" className="h-8 rounded-full" onClick={() => imprimir(h)} aria-label="Imprimir etiquetas"><Printer className="h-4 w-4" /></Button>
                  {h.estado === "abierta" && <Button size="sm" variant="outline" className="h-8 rounded-full" onClick={() => cerrar(h)}>Cerrar</Button>}</div>
              </div>
              <ul className="mt-2 divide-y text-sm">{h.envios.map((e) => <li key={e.id} className="flex items-center gap-2 py-1.5"><span className="font-mono text-xs">{e.numero}</span><span className="min-w-0 flex-1 truncate text-xs text-muted-foreground">{e.des_direccion}, {e.des_ciudad}</span><EstadoEnvio estado={e.estado} /></li>)}</ul>
            </section>
          );
        })}</div>
      )}
    </div>
  );
}

// ───────────────────────── Reclamos ─────────────────────────

type FilaInc = Incidencia & { envio: { numero: string; estado: EstadoLog } | null; cuenta: { razon_social: string } | null };

function Incidencias() {
  const [rows, setRows] = useState<FilaInc[] | null>(null);
  const [ver, setVer] = useState<"abiertas" | "resueltas">("abiertas");
  const cargar = useCallback(async () => {
    let q = db.from("log_incidencias").select("*, envio:log_envios(numero, estado), cuenta:log_cuentas(razon_social)").order("created_at", { ascending: ver === "abiertas" }).limit(200);
    q = ver === "abiertas" ? q.neq("estado", "resuelta") : q.eq("estado", "resuelta");
    const { data } = await q;
    setRows(data ?? []);
  }, [ver]);
  useEffect(() => { cargar(); }, [cargar]);
  const resolver = async (i: FilaInc) => {
    const r = await pedirTexto({ titulo: `Resolver reclamo #${i.numero}`, etiqueta: "Respuesta (la ve el cliente)", multilinea: true, maximo: 1000, confirmar: "Marcar como resuelto" });
    if (r === null) return;
    try { await actualizarIncidencia(i.id, "resuelta", r); toast.success("Reclamo resuelto"); cargar(); } catch (e) { toast.error(errorMessage(e)); }
  };
  const tomar = async (i: FilaInc) => { try { await actualizarIncidencia(i.id, "en_gestion"); cargar(); } catch (e) { toast.error(errorMessage(e)); } };
  return (
    <div className="space-y-4">
      <div className="flex gap-2">{(["abiertas", "resueltas"] as const).map((v) => <button key={v} type="button" onClick={() => setVer(v)} className={cn("rounded-full border px-3.5 py-1.5 text-sm font-bold capitalize", ver === v ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{v}</button>)}</div>
      {!rows ? <Cargando /> : rows.length === 0 ? <EmptyState icon={<CheckCircle2 className="h-7 w-7" />} title={ver === "abiertas" ? "Sin reclamos pendientes" : "Todavía no hay reclamos resueltos"} /> : (
        <ul className="space-y-3">{rows.map((i) => (
          <li key={i.id} className="rounded-2xl border bg-card p-4">
            <div className="flex flex-wrap items-center gap-2"><p className="font-bold">#{i.numero} · {TIPOS_INCIDENCIA[i.tipo] ?? i.tipo}</p><span className="font-mono text-xs">{i.envio?.numero}</span>{i.envio && <EstadoEnvio estado={i.envio.estado} />}<span className="ml-auto text-xs text-muted-foreground">{i.cuenta?.razon_social} · {formatDateTime(i.created_at)}</span></div>
            <p className="mt-1 text-sm">{i.descripcion}</p>
            {i.resolucion && <p className="mt-1 text-sm text-muted-foreground"><b>Respuesta:</b> {i.resolucion}</p>}
            {i.estado !== "resuelta" && <div className="mt-2 flex gap-2">{i.estado === "abierta" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => tomar(i)}>Tomar</Button>}<Button size="sm" className="rounded-full" onClick={() => resolver(i)}>Resolver</Button></div>}
          </li>
        ))}</ul>
      )}
    </div>
  );
}
