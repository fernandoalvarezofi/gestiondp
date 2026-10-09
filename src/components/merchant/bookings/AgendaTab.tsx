import { useCallback, useEffect, useMemo, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Plus, Search } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import {
  AccionMasiva, cap1, DIAS, diaDeSemana, diasDelMes, ESTADO_TURNO, EstadoTurno, fechaLarga, fechaLocal, fetchAgenda, horaLocal, hoyLocal, inicioSemana, minutosDelDia, Profesional,
  Servicio, sumarDias, TurnoAgenda, turnoMasivo,
} from "@/services/bookings";
import { NuevoTurnoDialog, TurnoDialog } from "./BookingDialogs";
import type { SlotValue } from "./SlotPicker";

type Prof = Profesional & { servicios: string[] };
type Vista = "dia" | "semana" | "mes";
const PALETA = ["#2B9778", "#2563EB", "#BE185D", "#B45309", "#7C3AED", "#0F766E", "#DC2626", "#4B5563"];
const HORA_PX = 56; // alto de una hora en la grilla
const ACTIVOS: EstadoTurno[] = ["pendiente", "confirmado", "en_curso"];
const DIAS_CORTOS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"];

/** Agenda del local: vista de día (por profesional), semana o mes, filtros, acciones masivas y alta de turnos desde el panel. */
export function AgendaTab({ storeId, servicios, profesionales }: { storeId: string; servicios: Servicio[]; profesionales: Prof[] }) {
  const [vista, setVista] = useState<Vista>(() => (typeof window !== "undefined" && window.innerWidth < 768 ? "dia" : "semana"));
  const [fecha, setFecha] = useState(hoyLocal());
  const [prof, setProf] = useState<string>("");
  const [serv, setServ] = useState<string>("");
  const [estado, setEstado] = useState<EstadoTurno | "">("");
  const [busca, setBusca] = useState("");
  const [rows, setRows] = useState<TurnoAgenda[] | null>(null);
  const [abierto, setAbierto] = useState<TurnoAgenda | null>(null);
  const [nuevo, setNuevo] = useState<{ inicial?: Partial<SlotValue>; cliente?: { id: string | null; nombre: string; telefono: string | null } } | null>(null);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [busy, setBusy] = useState(false);

  const rango = useMemo(() => {
    if (vista === "dia") return { desde: fecha, hasta: fecha };
    if (vista === "semana") { const d = inicioSemana(fecha); return { desde: d, hasta: sumarDias(d, 6) }; }
    const dias = diasDelMes(fecha); return { desde: dias[0], hasta: dias[dias.length - 1] };
  }, [vista, fecha]);

  const load = useCallback(async () => {
    try { setRows(await fetchAgenda(storeId, rango.desde, rango.hasta, { profesional: prof || null, servicio: serv || null, estado: estado || null })); }
    catch (error) { toast.error(errorMessage(error)); setRows([]); }
  }, [storeId, rango.desde, rango.hasta, prof, serv, estado]);
  useEffect(() => { setRows(null); setSel(new Set()); load(); const t = window.setInterval(load, 60000); return () => window.clearInterval(t); }, [load]);

  const colorDe = useCallback((t: TurnoAgenda) => t.color || PALETA[Math.max(0, profesionales.findIndex((p) => p.id === t.profesional_id)) % PALETA.length], [profesionales]);
  const filtrados = useMemo(() => {
    const q = busca.trim().toLowerCase();
    return (rows ?? []).filter((r) => !q || `${r.cliente} ${r.telefono ?? ""} ${r.servicio}`.toLowerCase().includes(q));
  }, [rows, busca]);
  const vigentes = filtrados.filter((r) => r.estado !== "cancelado");
  const pendientes = filtrados.filter((r) => r.estado === "pendiente").length;

  const mover = (dir: -1 | 1) => setFecha((f) => (vista === "dia" ? sumarDias(f, dir) : vista === "semana" ? sumarDias(f, dir * 7) : sumarDias(`${f.slice(0, 7)}-15`, dir * 30)));
  const titulo = vista === "dia" ? cap1(fechaLarga(`${fecha}T15:00:00Z`))
    : vista === "semana" ? `Semana del ${Number(rango.desde.slice(8))}/${Number(rango.desde.slice(5, 7))} al ${Number(rango.hasta.slice(8))}/${Number(rango.hasta.slice(5, 7))}`
    : cap1(new Intl.DateTimeFormat("es-AR", { month: "long", year: "numeric", timeZone: "UTC" }).format(new Date(`${fecha.slice(0, 7)}-15T12:00:00Z`)));

  const masivo = async (accion: AccionMasiva) => {
    const ids = [...sel];
    if (accion === "cancelar" && !window.confirm(`¿Cancelar ${ids.length} turnos? Les avisamos a las personas.`)) return;
    setBusy(true);
    try {
      const r = await turnoMasivo(ids, accion, accion === "cancelar" ? "Cancelado por el local" : undefined);
      if (r.errores.length) toast.warning(`${r.aplicados} aplicados, ${r.errores.length} no se pudieron: ${r.errores[0].error}`); else toast.success(`${r.aplicados} turnos actualizados`);
      setSel(new Set()); load();
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  // Grilla horaria: desde la hora más temprana a la más tarde con turnos (mínimo 8 a 20).
  const horas = useMemo(() => {
    const mins = vigentes.flatMap((r) => [minutosDelDia(r.inicio), minutosDelDia(r.fin)]);
    const desde = Math.min(8 * 60, ...mins); const hasta = Math.max(20 * 60, ...mins);
    return { desde: Math.floor(desde / 60), hasta: Math.ceil(hasta / 60) };
  }, [vigentes]);

  const bloque = (r: TurnoAgenda) => {
    const top = ((minutosDelDia(r.inicio) - horas.desde * 60) / 60) * HORA_PX;
    const alto = Math.max(22, ((new Date(r.fin).getTime() - new Date(r.inicio).getTime()) / 3600000) * HORA_PX - 2);
    const c = colorDe(r);
    return (
      <button key={r.id} type="button" onClick={() => setAbierto(r)} title={`${horaLocal(r.inicio)} ${r.cliente} · ${r.servicio}`}
        className={cn("absolute inset-x-1 overflow-hidden rounded-lg border-l-4 px-1.5 py-1 text-left text-[11px] leading-tight shadow-sm transition-transform hover:z-10 hover:scale-[1.02]", r.estado === "pendiente" && "border-dashed", r.estado === "cancelado" && "opacity-40 line-through")}
        style={{ top, height: alto, borderLeftColor: c, background: `${c}1f` }}>
        <span className="block font-extrabold tabular-nums">{horaLocal(r.inicio)} {r.cliente}</span>
        <span className="block truncate opacity-80">{r.servicio}{(r.personas ?? 1) > 1 ? ` · ${r.personas}p` : ""}</span>
      </button>
    );
  };
  const grilla = (columnas: { clave: string; titulo: string; sub?: string; items: TurnoAgenda[]; hoy?: boolean; onNuevo: () => void }[]) => (
    <div className="overflow-x-auto rounded-3xl border bg-card">
      <div className="grid min-w-[640px]" style={{ gridTemplateColumns: `52px repeat(${columnas.length}, minmax(110px, 1fr))` }}>
        <div className="sticky left-0 z-10 border-b bg-card" />
        {columnas.map((c) => (
          <div key={c.clave} className={cn("border-b border-l px-2 py-2 text-center", c.hoy && "bg-primary/5")}>
            <p className={cn("text-sm font-extrabold", c.hoy && "text-primary")}>{c.titulo}</p>
            {c.sub && <p className="text-[11px] text-muted-foreground">{c.sub}</p>}
          </div>
        ))}
        <div className="sticky left-0 z-10 bg-card">
          {Array.from({ length: horas.hasta - horas.desde }, (_, i) => <div key={i} style={{ height: HORA_PX }} className="pr-1 text-right text-[11px] tabular-nums text-muted-foreground">{String(horas.desde + i).padStart(2, "0")}:00</div>)}
        </div>
        {columnas.map((c) => (
          <div key={c.clave} className={cn("relative border-l", c.hoy && "bg-primary/[0.03]")} style={{ height: (horas.hasta - horas.desde) * HORA_PX }}>
            {Array.from({ length: horas.hasta - horas.desde }, (_, i) => <div key={i} style={{ top: i * HORA_PX }} className="absolute inset-x-0 border-t border-dashed border-border/70" />)}
            <button type="button" aria-label={`Nuevo turno ${c.titulo}`} onClick={c.onNuevo} className="absolute inset-0 cursor-cell" />
            {c.items.map(bloque)}
          </div>
        ))}
      </div>
    </div>
  );

  const profsVisibles = profesionales.filter((p) => p.activo && (!prof || p.id === prof));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Vista" className="flex rounded-full border bg-card p-1">
          {([["dia", "Día"], ["semana", "Semana"], ["mes", "Mes"]] as const).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)} className={cn("h-8 rounded-full px-3.5 text-sm font-bold", vista === v ? "bg-foreground text-background" : "hover:bg-muted")}>{l}</button>)}
        </div>
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Anterior" onClick={() => mover(-1)}><ChevronLeft className="h-4 w-4" /></Button>
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Siguiente" onClick={() => mover(1)}><ChevronRight className="h-4 w-4" /></Button>
        <Button variant="ghost" className="rounded-full" onClick={() => setFecha(hoyLocal())}>Hoy</Button>
        <input type="date" aria-label="Ir a la fecha" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className="h-9 rounded-full border bg-background px-3 text-sm font-semibold" />
        <Button className="ml-auto rounded-full" onClick={() => setNuevo({ inicial: { fecha: fecha < hoyLocal() ? hoyLocal() : fecha } })}><Plus className="h-4 w-4" />Nuevo turno</Button>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <label className="flex h-9 min-w-[180px] flex-1 items-center gap-2 rounded-full border bg-card px-3 text-sm"><Search className="h-4 w-4 text-muted-foreground" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar cliente, teléfono o servicio" aria-label="Buscar en la agenda" className="min-w-0 flex-1 bg-transparent outline-none" /></label>
        <select aria-label="Profesional" value={prof} onChange={(e) => setProf(e.target.value)} className="h-9 rounded-full border bg-background px-3 text-sm font-semibold"><option value="">Todo el equipo</option>{profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}</select>
        <select aria-label="Servicio" value={serv} onChange={(e) => setServ(e.target.value)} className="h-9 rounded-full border bg-background px-3 text-sm font-semibold"><option value="">Todos los servicios</option>{servicios.map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}</select>
        <select aria-label="Estado" value={estado} onChange={(e) => setEstado(e.target.value as EstadoTurno | "")} className="h-9 rounded-full border bg-background px-3 text-sm font-semibold"><option value="">Todos los estados</option>{(Object.keys(ESTADO_TURNO) as EstadoTurno[]).map((k) => <option key={k} value={k}>{ESTADO_TURNO[k].texto}</option>)}</select>
      </div>

      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-lg font-extrabold">{titulo}</h2>
        <p className="text-sm text-muted-foreground">{vigentes.length} {vigentes.length === 1 ? "turno" : "turnos"} · {money(vigentes.reduce((t, r) => t + Number(r.precio), 0))}{pendientes > 0 && <span className="ml-2 rounded-full bg-brand-yellow/25 px-2 py-0.5 text-xs font-bold text-brand-yellow-foreground">{pendientes} por confirmar</span>}</p>
      </div>

      {!rows ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : (
        <>
          {vista === "dia" && profsVisibles.length > 0 && (
            <div className="hidden md:block">
              {grilla(profsVisibles.map((p) => ({ clave: p.id, titulo: p.nombre, items: filtrados.filter((r) => r.profesional_id === p.id), onNuevo: () => setNuevo({ inicial: { fecha, profesional: p.id } }) })))}
            </div>
          )}
          {vista === "semana" && (
            <div className="hidden md:block">
              {grilla(Array.from({ length: 7 }, (_, i) => { const d = sumarDias(rango.desde, i); return { clave: d, titulo: `${DIAS_CORTOS[i]} ${Number(d.slice(8))}`, hoy: d === hoyLocal(), items: filtrados.filter((r) => fechaLocal(r.inicio) === d), onNuevo: () => setNuevo({ inicial: { fecha: d < hoyLocal() ? hoyLocal() : d } }) }; }))}
            </div>
          )}
          {vista === "mes" && (
            <div className="overflow-hidden rounded-3xl border bg-card">
              <div className="grid grid-cols-7 border-b bg-muted/50 text-center text-xs font-bold text-muted-foreground">{DIAS_CORTOS.map((d) => <div key={d} className="py-2">{d}</div>)}</div>
              <div className="grid grid-cols-7">
                {diasDelMes(fecha).map((d) => {
                  const del = vigentes.filter((r) => fechaLocal(r.inicio) === d);
                  const fuera = d.slice(0, 7) !== fecha.slice(0, 7);
                  return (
                    <button key={d} type="button" onClick={() => { setFecha(d); setVista("dia"); }} className={cn("min-h-[84px] border-b border-r p-1.5 text-left align-top hover:bg-muted/60", fuera && "bg-muted/30 text-muted-foreground", d === hoyLocal() && "bg-primary/5")}>
                      <span className={cn("text-xs font-extrabold", d === hoyLocal() && "text-primary")}>{Number(d.slice(8))}</span>
                      <span className="mt-1 flex flex-col gap-0.5">
                        {del.slice(0, 3).map((r) => <span key={r.id} className="truncate rounded px-1 text-[10px] font-semibold" style={{ background: `${colorDe(r)}26` }}>{horaLocal(r.inicio)} {r.cliente}</span>)}
                        {del.length > 3 && <span className="text-[10px] font-bold text-muted-foreground">+{del.length - 3} más</span>}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Lista: en el celular es la vista principal; en escritorio, para seleccionar y aplicar acciones masivas. */}
          {vista !== "mes" && (filtrados.length === 0 ? <EmptyState icon={<CalendarCheck className="h-7 w-7" />} title="No hay turnos en estas fechas" text="Cuando alguien reserve o cargues un turno, lo vas a ver acá." />
            : (
              <div className={cn(vista !== "dia" && "md:mt-2")}>
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
                <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                  {filtrados.map((r) => (
                    <li key={r.id} className={cn("flex items-center gap-3 p-3", r.estado === "cancelado" && "opacity-60", sel.has(r.id) && "bg-primary/5")}>
                      {ACTIVOS.includes(r.estado) && <input type="checkbox" aria-label={`Elegir turno de ${r.cliente}`} checked={sel.has(r.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(r.id)) n.delete(r.id); else n.add(r.id); return n; })} className="h-4 w-4 accent-primary" />}
                      <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: colorDe(r) }} />
                      <button type="button" onClick={() => setAbierto(r)} className="min-w-0 flex-1 text-left">
                        <p className="font-extrabold tabular-nums">{vista !== "dia" && <span className="font-semibold text-muted-foreground">{DIAS[diaDeSemana(fechaLocal(r.inicio))].slice(0, 3)} {Number(fechaLocal(r.inicio).slice(8))} · </span>}{horaLocal(r.inicio)} – {horaLocal(r.fin)} <span className="font-semibold text-muted-foreground">· {r.servicio}</span></p>
                        <p className="truncate text-sm"><span className="font-bold">{r.cliente}</span>{(r.personas ?? 1) > 1 && ` · ${r.personas} personas`} · con {r.profesional}{Number(r.precio) > 0 && ` · ${money(r.precio)}`}{r.origen === "panel" && <span className="text-muted-foreground"> · cargado por el local</span>}</p>
                      </button>
                      <span className={cn("shrink-0 rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_TURNO[r.estado].clase)}>{ESTADO_TURNO[r.estado].texto}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
        </>
      )}

      <NuevoTurnoDialog open={Boolean(nuevo)} onOpenChange={(v) => !v && setNuevo(null)} servicios={servicios} profesionales={profesionales} inicial={nuevo?.inicial} cliente={nuevo?.cliente ?? null} onCreated={load} />
      <TurnoDialog turno={abierto} storeId={storeId} servicios={servicios} profesionales={profesionales} onClose={() => setAbierto(null)} onChanged={load}
        onAgendarOtro={(cliente, servicio) => { setAbierto(null); setNuevo({ cliente, inicial: { servicio, fecha: hoyLocal() } }); }} />
    </div>
  );
}
