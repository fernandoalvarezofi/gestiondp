import { MouseEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, ErrorState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { confirmar } from "@/components/ui/dialogos";
import { db, errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import {
  AccionMasiva, cambiarEstadoTurno, cap1, carriles, Cierre, diasDelMes, ESTADO_TURNO, EstadoTurno, fechaLarga, fechaLocal, fetchAgenda, horaLocal, hoyLocal,
  inicioSemana, minutosDelDia, Profesional, Servicio, sumarDias, Tramo, tramosDelDia, TurnoAgenda, turnoMasivo,
} from "@/services/bookings";
import { fichaCliente } from "@/services/crm";
import { TurnoDialog } from "./BookingDialogs";
import { ClienteTurno, NuevoTurnoDialog } from "./NuevoTurnoDialog";
import type { SlotValue } from "./SlotPicker";

type Prof = Profesional & { servicios: string[] };
type Vista = "dia" | "semana" | "mes" | "lista";
type Columna = { clave: string; titulo: string; sub?: string; fecha: string; profesional?: string; items: TurnoAgenda[]; tramos: [number, number][]; cerrado?: string | null };
const PALETA = ["#2B9778", "#2563EB", "#BE185D", "#B45309", "#7C3AED", "#0F766E", "#DC2626", "#4B5563"];
const HORA_PX = 64; // alto de una hora en la grilla
const ACTIVOS: EstadoTurno[] = ["pendiente", "confirmado", "en_curso"];
const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];
const VISTAS: [Vista, string][] = [["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"], ["lista", "Lista"]];

const ahoraMin = () => minutosDelDia(new Date().toISOString());
const hhmmDe = (min: number) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/**
 * Calendario de turnos del local: día por profesional (columnas del equipo), semana, mes y lista con acciones masivas.
 * Sombrea lo que está fuera del horario de atención y los cierres; marca la hora actual; un clic en un hueco abre
 * el alta de turno con ese día, hora y profesional. Acepta ?turno=<id> (abre el turno) y ?nuevo=1&contacto=<id>.
 */
export function AgendaTab({ storeId, servicios, profesionales, horarios, cierres }: {
  storeId: string; servicios: Servicio[]; profesionales: Prof[]; horarios: Record<string, Tramo[]>; cierres: Cierre[];
}) {
  const [params, setParams] = useSearchParams();
  const [vista, setVista] = useState<Vista>(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "lista" : "semana"));
  const [fecha, setFecha] = useState(hoyLocal());
  const [prof, setProf] = useState<string>("");
  const [serv, setServ] = useState<string>("");
  const [estado, setEstado] = useState<EstadoTurno | "">("");
  const [busca, setBusca] = useState("");
  const [rows, setRows] = useState<TurnoAgenda[] | null>(null);
  const [fallo, setFallo] = useState(false);
  const [abierto, setAbierto] = useState<TurnoAgenda | null>(null);
  const [buscado, setBuscado] = useState<string | null>(null);
  const [nuevo, setNuevo] = useState<{ inicial?: Partial<SlotValue>; cliente?: ClienteTurno } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);
  const [minuto, setMinuto] = useState(ahoraMin);

  const rango = useMemo(() => {
    if (vista === "dia") return { desde: fecha, hasta: fecha };
    if (vista === "semana" || vista === "lista") { const d = inicioSemana(fecha); return { desde: d, hasta: sumarDias(d, 6) }; }
    const dias = diasDelMes(fecha); return { desde: dias[0], hasta: dias[dias.length - 1] };
  }, [vista, fecha]);

  const load = useCallback(async () => {
    try { setRows(await fetchAgenda(storeId, rango.desde, rango.hasta, { profesional: prof || null, servicio: serv || null, estado: estado || null })); setFallo(false); }
    catch (error) { setFallo(true); toast.error(errorMessage(error)); }
  }, [storeId, rango.desde, rango.hasta, prof, serv, estado]);
  useEffect(() => { setRows(null); setSel(new Set()); load(); const t = window.setInterval(load, 60000); return () => window.clearInterval(t); }, [load]);
  useEffect(() => { const t = window.setInterval(() => setMinuto(ahoraMin()), 60000); return () => window.clearInterval(t); }, []);

  // Enlaces profundos desde el CRM, el centro de operaciones o una notificación.
  useEffect(() => {
    const turno = params.get("turno");
    const contacto = params.get("contacto");
    if (turno) {
      setBuscado(turno);
      db.rpc("agenda_turno_inicio", { p_turno: turno }).then(({ data }) => {
        if (data) { setFecha(fechaLocal(data as string)); setVista((v) => (v === "mes" ? "dia" : v)); } else { toast.error("No encontramos ese turno"); setBuscado(null); }
      });
    }
    if (params.get("nuevo") === "1") {
      if (contacto) {
        fichaCliente(contacto).then((f) => {
          if ("fusionado_en" in f) return setNuevo({ inicial: { fecha: hoyLocal() } });
          setNuevo({ cliente: { contactoId: f.id, id: f.cliente_id, nombre: f.nombre, telefono: f.telefono }, inicial: { fecha: hoyLocal() } });
        }, () => setNuevo({ inicial: { fecha: hoyLocal() } }));
      } else setNuevo({ inicial: { fecha: hoyLocal() } });
    }
    if (turno || params.get("nuevo")) { const p = new URLSearchParams(params); ["turno", "nuevo", "contacto"].forEach((k) => p.delete(k)); setParams(p, { replace: true }); }
  }, [params]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!buscado || !rows) return;
    const t = rows.find((r) => r.id === buscado);
    if (t) { setAbierto(t); setBuscado(null); }
  }, [rows, buscado]);

  const colorDe = useCallback((t: TurnoAgenda) => t.color || PALETA[Math.max(0, profesionales.findIndex((p) => p.id === t.profesional_id)) % PALETA.length], [profesionales]);
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (rows ?? []).filter((r) => (estado === "cancelado" || r.estado !== "cancelado") && (!q || `${r.cliente} ${r.telefono ?? ""} ${r.servicio}`.toLowerCase().includes(q)));
  }, [rows, busca, estado]);
  const vigentes = filtrados.filter((r) => r.estado !== "cancelado");
  const porConfirmar = (rows ?? []).filter((r) => r.estado === "pendiente");
  const cancelados = (rows ?? []).filter((r) => r.estado === "cancelado").length;
  const hoy = hoyLocal();

  const mover = (dir: -1 | 1) => setFecha((f) => (vista === "dia" ? sumarDias(f, dir) : vista === "mes" ? sumarDias(`${f.slice(0, 7)}-15`, dir * 30) : sumarDias(f, dir * 7)));
  const titulo = vista === "dia" ? cap1(fechaLarga(`${fecha}T15:00:00Z`))
    : vista === "mes" ? cap1(new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${fecha.slice(0, 7)}-15T12:00:00Z`)))
    : `Semana del ${Number(rango.desde.slice(8))}/${Number(rango.desde.slice(5, 7))} al ${Number(rango.hasta.slice(8))}/${Number(rango.hasta.slice(5, 7))}`;

  const masivo = async (accion: AccionMasiva) => {
    const ids = [...sel];
    if (accion === "cancelar" && !(await confirmar({ titulo: `¿Cancelar ${ids.length} ${ids.length === 1 ? "turno" : "turnos"}?`, descripcion: "Les avisamos a las personas y los horarios quedan libres para otros.", confirmar: "Cancelar turnos", cancelar: "Volver", peligro: true }))) return;
    setBusy(true);
    try {
      const r = await turnoMasivo(ids, accion, accion === "cancelar" ? "Cancelado por el local" : undefined);
      if (r.errores.length) toast.warning(`${r.aplicados} aplicados, ${r.errores.length} no se pudieron: ${r.errores[0].error}`); else toast.success(`${r.aplicados} turnos actualizados`);
      setSel(new Set()); load();
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const confirmarUno = async (t: TurnoAgenda) => {
    setBusy(true);
    try { await cambiarEstadoTurno(t.id, "confirmado"); toast.success(`Confirmado: ${t.cliente}. Le avisamos.`); load(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  const cierreDe = useCallback((d: string) => cierres.find((c) => c.desde <= d && c.hasta >= d), [cierres]);
  const profsVisibles = profesionales.filter((p) => p.activo && (!prof || p.id === prof));
  const tramosUnion = useCallback((d: string) => {
    const lista = profsVisibles.flatMap((p) => tramosDelDia(horarios[p.id] ?? [], d)).sort((a, b) => a[0] - b[0]);
    return lista.reduce<[number, number][]>((acc, t) => { const u = acc[acc.length - 1]; if (u && t[0] <= u[1]) u[1] = Math.max(u[1], t[1]); else acc.push([t[0], t[1]]); return acc; }, []);
  }, [profsVisibles, horarios]);

  const columnas: Columna[] = useMemo(() => {
    if (vista === "dia") {
      const cerrado = cierreDe(fecha);
      return profsVisibles.map((p) => ({ clave: p.id, titulo: p.nombre, sub: `${filtrados.filter((r) => r.profesional_id === p.id && r.estado !== "cancelado").length} turnos`, fecha, profesional: p.id, items: filtrados.filter((r) => r.profesional_id === p.id), tramos: tramosDelDia(horarios[p.id] ?? [], fecha), cerrado: cerrado ? cerrado.motivo || "Cerrado" : null }));
    }
    return Array.from({ length: 7 }, (_, i) => {
      const d = sumarDias(rango.desde, i); const cerrado = cierreDe(d);
      return { clave: d, titulo: `${DIAS_CORTOS[i]} ${Number(d.slice(8))}`, fecha: d, profesional: prof || undefined, items: filtrados.filter((r) => fechaLocal(r.inicio) === d), tramos: tramosUnion(d), cerrado: cerrado ? cerrado.motivo || "Cerrado" : null };
    });
  }, [vista, fecha, profsVisibles, filtrados, horarios, rango.desde, prof, cierreDe, tramosUnion]);

  // Rango de horas visible: el horario de atención más amplio, estirado si hay turnos fuera (mínimo 9 a 19).
  const horas = useMemo(() => {
    const mins = [...vigentes.flatMap((r) => [minutosDelDia(r.inicio), minutosDelDia(r.fin)]), ...columnas.flatMap((c) => c.tramos.flat())];
    const desde = Math.min(9 * 60, ...mins); const hasta = Math.max(19 * 60, ...mins);
    return { desde: Math.floor(desde / 60), hasta: Math.min(24, Math.ceil(hasta / 60)) };
  }, [vigentes, columnas]);
  const alto = (horas.hasta - horas.desde) * HORA_PX;
  const y = (min: number) => ((min - horas.desde * 60) / 60) * HORA_PX;

  const clicEnHueco = (c: Columna, e: MouseEvent<HTMLButtonElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const min = Math.floor(((e.clientY - rect.top) / HORA_PX) * 4) * 15 + horas.desde * 60;
    if (c.fecha < hoy || (c.fecha === hoy && min < minuto)) return toast.info("Ese horario ya pasó. Elegí uno a partir de ahora.");
    setNuevo({ inicial: { fecha: c.fecha, hora: hhmmDe(min), ...(c.profesional ? { profesional: c.profesional } : {}) } });
  };

  const bloque = (r: TurnoAgenda, lane: { carril: number; de: number }) => {
    const top = y(minutosDelDia(r.inicio));
    const h = Math.max(24, ((new Date(r.fin).getTime() - new Date(r.inicio).getTime()) / 3600000) * HORA_PX - 3);
    const c = colorDe(r);
    const ancho = 100 / lane.de;
    return (
      <button key={r.id} type="button" onClick={() => setAbierto(r)} title={`${horaLocal(r.inicio)}–${horaLocal(r.fin)} · ${r.cliente} · ${r.servicio} · ${ESTADO_TURNO[r.estado].texto}`}
        className={cn("absolute z-[1] overflow-hidden rounded-lg border border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition-shadow hover:z-10 hover:shadow-pop focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          r.estado === "pendiente" && "border-dashed bg-[repeating-linear-gradient(135deg,transparent,transparent_6px,rgba(240,185,0,.14)_6px,rgba(240,185,0,.14)_12px)]",
          r.estado === "en_curso" && "ring-2 ring-primary/60", r.estado === "completado" && "opacity-60", r.estado === "ausente" && "opacity-60 grayscale", r.estado === "cancelado" && "opacity-40 line-through")}
        style={{ top, height: h, left: `calc(${lane.carril * ancho}% + 2px)`, width: `calc(${ancho}% - 4px)`, borderLeftColor: c, borderColor: `${c}55`, backgroundColor: `${c}1a` }}>
        {h < 40 ? <span className="block truncate"><span className="font-extrabold">{r.cliente}</span> <span className="tabular-nums opacity-80">{horaLocal(r.inicio)} · {r.servicio}</span></span> : <>
          <span className="block truncate font-extrabold">{r.cliente}</span>
          <span className="block truncate tabular-nums opacity-80">{horaLocal(r.inicio)} · {r.servicio}{(r.personas ?? 1) > 1 ? ` · ${r.personas}p` : ""}</span>
        </>}
        {h > 56 && vista === "semana" && <span className="block truncate opacity-70">{r.profesional}</span>}
      </button>
    );
  };

  const grilla = (
    <div className="overflow-x-auto rounded-3xl border bg-card">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `56px repeat(${columnas.length}, minmax(${vista === "dia" ? 160 : 92}px, 1fr))` }}>
        <div className="sticky left-0 z-20 border-b bg-card" />
        {columnas.map((c) => {
          const esHoy = c.fecha === hoy;
          return (
            <div key={c.clave} className={cn("border-b border-l px-2 py-2 text-center", esHoy && vista !== "dia" && "bg-primary/5")}>
              {vista === "dia" ? (
                <p className="flex items-center justify-center gap-2 text-sm font-extrabold">
                  <span className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-black text-white" style={{ background: PALETA[Math.max(0, profesionales.findIndex((p) => p.id === c.profesional)) % PALETA.length] }}>{c.titulo.slice(0, 1).toUpperCase()}</span>{c.titulo}
                </p>
              ) : (
                <button type="button" onClick={() => { setFecha(c.fecha); setVista("dia"); }} className={cn("rounded-full px-2 text-sm font-extrabold hover:bg-muted", esHoy && "bg-primary text-primary-foreground hover:bg-primary/90")}>{c.titulo}</button>
              )}
              <p className="text-[11px] text-muted-foreground">{c.cerrado ? c.cerrado : vista === "dia" ? c.sub : `${c.items.filter((r) => r.estado !== "cancelado").length} turnos`}</p>
            </div>
          );
        })}
        <div className="sticky left-0 z-20 bg-card" style={{ height: alto }}>
          {Array.from({ length: horas.hasta - horas.desde }, (_, i) => <span key={i} style={{ top: i * HORA_PX - 7 }} className={cn("absolute right-1.5 text-[11px] tabular-nums text-muted-foreground", i === 0 && "top-0")}>{`${String(horas.desde + i).padStart(2, "0")}:00`}</span>)}
        </div>
        {columnas.map((c) => {
          const lanes = carriles(c.items);
          // Huecos fuera del horario de atención (si no hay horario cargado no se sombrea nada).
          const fuera: [number, number][] = [];
          if (c.cerrado) fuera.push([horas.desde * 60, horas.hasta * 60]);
          else if (c.tramos.length) {
            let desde = horas.desde * 60;
            for (const [a, b] of c.tramos) { if (a > desde) fuera.push([desde, a]); desde = Math.max(desde, b); }
            if (desde < horas.hasta * 60) fuera.push([desde, horas.hasta * 60]);
          }
          return (
            <div key={c.clave} className="relative border-l" style={{ height: alto }}>
              {fuera.map(([a, b]) => <div key={a} aria-hidden className="absolute inset-x-0 bg-[repeating-linear-gradient(45deg,hsl(var(--muted)),hsl(var(--muted))_4px,transparent_4px,transparent_9px)] opacity-80" style={{ top: y(a), height: y(b) - y(a) }} />)}
              {Array.from({ length: (horas.hasta - horas.desde) * 2 }, (_, i) => <div key={i} aria-hidden style={{ top: (i * HORA_PX) / 2 }} className={cn("pointer-events-none absolute inset-x-0 border-t", i % 2 ? "border-dashed border-border/50" : "border-border/80")} />)}
              <button type="button" aria-label={`Agendar turno: ${c.titulo}`} onClick={(e) => clicEnHueco(c, e)} className="absolute inset-0 cursor-cell hover:bg-primary/[0.03]" />
              {c.items.map((r) => bloque(r, lanes[r.id] ?? { carril: 0, de: 1 }))}
              {c.fecha === hoy && minuto >= horas.desde * 60 && minuto <= horas.hasta * 60 && (
                <div aria-hidden className="pointer-events-none absolute inset-x-0 z-[2] border-t-2 border-destructive" style={{ top: y(minuto) }}><span className="absolute -left-1 -top-[5px] h-2 w-2 rounded-full bg-destructive" /></div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );

  const lista = filtrados.length === 0
    ? <EmptyState icon={<CalendarCheck className="h-7 w-7" />} title="No hay turnos en estas fechas" text="Cuando alguien reserve o cargues un turno, lo vas a ver acá." action={<Button className="rounded-full" onClick={() => setNuevo({ inicial: { fecha: fecha < hoy ? hoy : fecha } })}><Plus className="h-4 w-4" />Agendar un turno</Button>} />
    : (
      <div>
        {sel.size > 0 && (
          <div className="sticky top-14 z-20 mb-2 flex flex-wrap items-center gap-2 rounded-2xl border bg-card p-2.5 shadow-pop" role="toolbar" aria-label="Acciones sobre los turnos elegidos">
            <span className="px-2 text-sm font-extrabold">{sel.size} elegidos</span>
            <Button size="sm" className="rounded-full" disabled={busy} onClick={() => masivo("confirmar")}>Confirmar</Button>
            <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => masivo("completar")}>Se realizaron</Button>
            <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => masivo("ausente")}>No vinieron</Button>
            <Button size="sm" variant="outline" className="rounded-full text-destructive" disabled={busy} onClick={() => masivo("cancelar")}>Cancelar</Button>
            <Button size="sm" variant="ghost" className="ml-auto rounded-full" onClick={() => setSel(new Set())}>Quitar selección</Button>
          </div>
        )}
        <div className="space-y-4">
          {[...new Set(filtrados.map((r) => fechaLocal(r.inicio)))].map((d) => (
            <section key={d} aria-label={cap1(fechaLarga(`${d}T15:00:00Z`))}>
              <h3 className={cn("mb-1.5 px-1 text-sm font-extrabold", d === hoy && "text-primary")}>{d === hoy ? "Hoy · " : ""}{cap1(fechaLarga(`${d}T15:00:00Z`))}</h3>
              <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                {filtrados.filter((r) => fechaLocal(r.inicio) === d).map((r) => (
                  <li key={r.id} className={cn("flex items-center gap-3 p-3", r.estado === "cancelado" && "opacity-60", sel.has(r.id) && "bg-primary/5")}>
                    {ACTIVOS.includes(r.estado) && <input type="checkbox" aria-label={`Elegir turno de ${r.cliente}`} checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} className="h-4 w-4 accent-primary" />}
                    <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: colorDe(r) }} />
                    <button type="button" onClick={() => setAbierto(r)} className="min-w-0 flex-1 text-left">
                      <p className="font-extrabold tabular-nums">{horaLocal(r.inicio)} – {horaLocal(r.fin)} <span className="font-semibold text-muted-foreground">· {r.servicio}</span></p>
                      <p className="truncate text-sm"><span className="font-bold">{r.cliente}</span>{(r.personas ?? 1) > 1 && ` · ${r.personas} personas`} · con {r.profesional}{Number(r.precio) > 0 && ` · ${money(r.precio)}`}{r.origen === "panel" && <span className="text-muted-foreground"> · cargado por el local</span>}</p>
                    </button>
                    {r.estado === "pendiente" && <Button size="sm" className="hidden rounded-full sm:inline-flex" disabled={busy} onClick={() => confirmarUno(r)}>Confirmar</Button>}
                    <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_TURNO[r.estado].clase)}>{ESTADO_TURNO[r.estado].texto}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      </div>
    );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Vista" className="flex rounded-full border bg-card p-1">
          {VISTAS.map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)} className={cn("h-8 rounded-full px-3.5 text-sm font-bold", vista === v ? "bg-foreground text-background" : "hover:bg-muted")}>{l}</button>)}
        </div>
        <div className="flex items-center gap-1">
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" aria-label="Anterior" onClick={() => mover(-1)}><ChevronLeft className="h-4 w-4" /></Button>
          <Button variant="outline" className="h-9 rounded-full" onClick={() => setFecha(hoy)}>Hoy</Button>
          <Button variant="outline" size="icon" className="h-9 w-9 rounded-full" aria-label="Siguiente" onClick={() => mover(1)}><ChevronRight className="h-4 w-4" /></Button>
        </div>
        <input type="date" aria-label="Ir a la fecha" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className="h-9 rounded-full border bg-background px-3 text-sm font-semibold" />
        <Button className="ml-auto rounded-full" onClick={() => setNuevo({ inicial: { fecha: fecha < hoy ? hoy : fecha, ...(prof ? { profesional: prof } : {}) } })}><Plus className="h-4 w-4" />Nuevo turno</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-full border bg-card px-3 text-sm"><Search className="h-4 w-4 text-muted-foreground" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, teléfono o servicio" aria-label="Buscar en la agenda" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
        <select aria-label="Profesional" value={prof} onChange={(e) => setProf(e.target.value)} className="h-9 rounded-full border bg-background px-3 text-sm font-semibold"><option value="">Todo el equipo</option>{profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        <select aria-label="Servicio" value={serv} onChange={(e) => setServ(e.target.value)} className="h-9 rounded-full border bg-background px-3 text-sm font-semibold"><option value="">Todos los servicios</option>{servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
        <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoTurno | "")} className="h-9 rounded-full border bg-background px-3 text-sm font-semibold"><option value="">Todos los vigentes</option>{(Object.keys(ESTADO_TURNO) as EstadoTurno[]).map((k) => <option key={k} value={k}>{ESTADO_TURNO[k].texto}</option>)}</select>
      </div>

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-extrabold">{titulo}</h2>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="rounded-full bg-muted px-2.5 py-1 font-bold">{vigentes.length} {vigentes.length === 1 ? "turno" : "turnos"}</span>
          <span className="rounded-full bg-muted px-2.5 py-1 font-bold">{money(vigentes.filter((r) => r.estado !== "ausente").reduce((t, r) => t + Number(r.precio), 0))} estimado</span>
          {porConfirmar.length > 0 && <button type="button" onClick={() => setEstado("pendiente")} className="rounded-full bg-brand-yellow/25 px-2.5 py-1 font-bold text-brand-yellow-foreground hover:bg-brand-yellow/40">{porConfirmar.length} por confirmar</button>}
          {cancelados > 0 && estado !== "cancelado" && <button type="button" onClick={() => setEstado("cancelado")} className="rounded-full px-2.5 py-1 font-semibold text-muted-foreground hover:bg-muted">{cancelados} cancelados</button>}
        </div>
      </div>

      {fallo && !rows ? <ErrorState title="No pudimos cargar la agenda" onRetry={load} />
        : !rows ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : vista === "mes" ? (
          <div className="overflow-hidden rounded-3xl border bg-card">
            <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-bold text-muted-foreground">{DIAS_CORTOS.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
            <div className="grid grid-cols-7">
              {diasDelMes(fecha).map((d) => {
                const del = vigentes.filter((r) => fechaLocal(r.inicio) === d);
                const fuera = d.slice(0, 7) !== fecha.slice(0, 7);
                const cerrado = cierreDe(d);
                return (
                  <button key={d} type="button" onClick={() => { setFecha(d); setVista("dia"); }} className={cn("min-h-[92px] border-b border-r p-1.5 text-left align-top hover:bg-muted/60", fuera && "bg-muted/30 text-muted-foreground", cerrado && "bg-muted/60")}>
                    <span className={cn("inline-grid h-6 min-w-6 place-items-center rounded-full px-1 text-xs font-extrabold", d === hoy && "bg-primary text-primary-foreground")}>{Number(d.slice(8))}</span>
                    {cerrado && <span className="ml-1 text-[10px] font-semibold text-muted-foreground">{cerrado.motivo || "Cerrado"}</span>}
                    <span className="mt-1 flex flex-col gap-0.5">
                      {del.slice(0, 3).map((r) => <span key={r.id} className={cn("truncate rounded px-1 text-[10px] font-semibold", r.estado === "pendiente" && "outline-dashed outline-1 outline-brand-yellow")} style={{ background: `${colorDe(r)}26` }}>{horaLocal(r.inicio)} {r.cliente}</span>)}
                      {del.length > 3 && <span className="text-[10px] font-bold text-muted-foreground">+{del.length - 3} más</span>}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : vista === "lista" ? lista : (
          <>
            {columnas.length === 0
              ? <EmptyState icon={<CalendarCheck className="h-7 w-7" />} title="Todavía no hay nadie en el equipo" text="Sumá a quienes atienden en Configuración › Equipo y horarios para ver sus columnas." />
              : <div className="hidden md:block">{grilla}</div>}
            <div className="md:hidden">{lista}</div>
            <p className="hidden text-xs text-muted-foreground md:block">Tocá un hueco de la grilla para agendar en ese horario. Lo rayado está fuera del horario de atención.</p>
          </>
        )}

      <NuevoTurnoDialog open={Boolean(nuevo)} onOpenChange={(v) => !v && setNuevo(null)} servicios={servicios} profesionales={profesionales} inicial={nuevo?.inicial} cliente={nuevo?.cliente ?? null} onCreated={load} />
      <TurnoDialog turno={abierto} storeId={storeId} servicios={servicios} profesionales={profesionales} onClose={() => setAbierto(null)} onChanged={load}
        onAgendarOtro={(cliente, servicio) => { setAbierto(null); setNuevo({ cliente, inicial: { servicio, fecha: hoy } }); }} />
    </div>
  );
}
