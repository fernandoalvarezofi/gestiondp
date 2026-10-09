import { FormEvent, useEffect, useState } from "react";
import { CalendarClock, History, Loader2, Phone, StickyNote, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import {
  cambiarEstadoTurno, cap1, crearTurnoPanel, ESTADO_TURNO, EVENTO_TURNO, fechaLarga, fechaLocal, fetchFicha, FichaCliente, guardarNotaCliente, guardarNotaInterna,
  horaLocal, hoyLocal, Profesional, reprogramarTurno, Servicio, TurnoAgenda,
} from "@/services/bookings";
import { SlotPicker, slotIso, SlotValue } from "./SlotPicker";

type Prof = Profesional & { servicios: string[] };

/** Turno cargado por el local: alguien llamó, escribió o vino al mostrador. Nace confirmado. */
export function NuevoTurnoDialog({ open, onOpenChange, servicios, profesionales, inicial, cliente, onCreated }: {
  open: boolean; onOpenChange: (v: boolean) => void; servicios: Servicio[]; profesionales: Prof[]; inicial?: Partial<SlotValue>;
  cliente?: { id: string | null; nombre: string; telefono: string | null } | null; onCreated: () => void;
}) {
  const [slot, setSlot] = useState<SlotValue>({ servicio: "", profesional: "", fecha: hoyLocal(), hora: "" });
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [interna, setInterna] = useState("");
  const [personas, setPersonas] = useState(1);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!open) return;
    setSlot({ servicio: "", profesional: "", fecha: hoyLocal(), hora: "", ...inicial });
    setNombre(cliente?.nombre ?? ""); setTelefono(cliente?.telefono ?? ""); setNotas(""); setInterna(""); setPersonas(1);
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  const servicio = servicios.find((s) => s.id === slot.servicio);
  const capacidad = servicio?.capacidad ?? 1;

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const inicio = slotIso(slot);
    if (!slot.servicio || !slot.profesional || !inicio) return toast.error("Elegí servicio, profesional, día y hora");
    if (!cliente?.id && nombre.trim().length < 2) return toast.error("Escribí el nombre de la persona");
    setBusy(true);
    try {
      await crearTurnoPanel({ servicio: slot.servicio, profesional: slot.profesional, inicio, cliente: cliente?.id ?? null, nombre: cliente?.id ? undefined : nombre, telefono, notas, personas, notaInterna: interna });
      toast.success(`Turno agendado: ${cap1(fechaLarga(inicio))} a las ${horaLocal(inicio)}`);
      onOpenChange(false); onCreated();
    } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => !busy && onOpenChange(v)}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <DialogTitle className="text-xl font-extrabold">Nuevo turno</DialogTitle>
        <DialogDescription>Para quien llamó, escribió o vino al local. Queda confirmado y ocupa la agenda al instante.</DialogDescription>
        <form onSubmit={submit} className="space-y-4">
          <SlotPicker servicios={servicios} profesionales={profesionales} value={slot} onChange={setSlot} />
          {capacidad > 1 && (
            <div className="space-y-1.5"><Label htmlFor="nt-pers">Personas (cupo {capacidad} por horario)</Label><Input id="nt-pers" type="number" min={1} max={capacidad} value={personas} onChange={(e) => setPersonas(Math.max(1, Math.min(capacidad, Number(e.target.value) || 1)))} /></div>
          )}
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5"><Label htmlFor="nt-nombre">Nombre</Label><Input id="nt-nombre" maxLength={80} disabled={Boolean(cliente?.id)} value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre y apellido" /></div>
            <div className="space-y-1.5"><Label htmlFor="nt-tel">Teléfono</Label><Input id="nt-tel" inputMode="tel" maxLength={30} value={telefono} onChange={(e) => setTelefono(e.target.value)} placeholder="Para avisarle si cambia algo" /></div>
          </div>
          <div className="space-y-1.5"><Label htmlFor="nt-notas">Nota para el turno (la ve la persona si tiene cuenta)</Label><Textarea id="nt-notas" maxLength={300} value={notas} onChange={(e) => setNotas(e.target.value)} className="min-h-[56px] resize-none" /></div>
          <div className="space-y-1.5"><Label htmlFor="nt-int">Nota interna (solo el equipo)</Label><Textarea id="nt-int" maxLength={1000} value={interna} onChange={(e) => setInterna(e.target.value)} className="min-h-[56px] resize-none" /></div>
          <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Agendar turno</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

/** Detalle del turno: acciones según el estado, reprogramar, ficha del cliente, notas e historial. */
export function TurnoDialog({ turno, storeId, servicios, profesionales, onClose, onChanged, onAgendarOtro }: {
  turno: TurnoAgenda | null; storeId: string; servicios: Servicio[]; profesionales: Prof[]; onClose: () => void; onChanged: () => void;
  onAgendarOtro: (cliente: { id: string | null; nombre: string; telefono: string | null }, servicio: string) => void;
}) {
  const [ficha, setFicha] = useState<FichaCliente | null>(null);
  const [modo, setModo] = useState<"ver" | "reprogramar" | "cancelar">("ver");
  const [slot, setSlot] = useState<SlotValue>({ servicio: "", profesional: "", fecha: "", hora: "" });
  const [motivo, setMotivo] = useState("");
  const [interna, setInterna] = useState("");
  const [notaCliente, setNotaCliente] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!turno) return;
    setModo("ver"); setMotivo(""); setFicha(null); setInterna(turno.nota_interna ?? "");
    setSlot({ servicio: turno.servicio_id ?? "", profesional: turno.profesional_id, fecha: fechaLocal(turno.inicio), hora: horaLocal(turno.inicio) });
    fetchFicha(turno.id).then((f) => { setFicha(f); setNotaCliente(f.nota ?? ""); }).catch(() => setFicha(null));
  }, [turno]);
  if (!turno) return null;

  const run = async (accion: () => Promise<void>, ok: string, cerrar = true) => {
    setBusy(true);
    try { await accion(); toast.success(ok); onChanged(); if (cerrar) onClose(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const activo = turno.estado === "pendiente" || turno.estado === "confirmado";
  const futuro = new Date(turno.inicio).getTime() > Date.now();

  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-xl overflow-y-auto">
        <div className="flex flex-wrap items-start justify-between gap-2 pr-6">
          <div>
            <DialogTitle className="text-xl font-extrabold">{turno.servicio}</DialogTitle>
            <DialogDescription>{cap1(fechaLarga(turno.inicio))} · {horaLocal(turno.inicio)} – {horaLocal(turno.fin)} · con {turno.profesional}{turno.recurso ? ` · ${turno.recurso}` : ""}</DialogDescription>
          </div>
          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_TURNO[turno.estado].clase)}>{ESTADO_TURNO[turno.estado].texto}</span>
        </div>

        <div className="rounded-2xl border p-3">
          <p className="flex items-center gap-2 font-extrabold"><UserRound className="h-4 w-4 text-primary" />{ficha?.nombre ?? turno.cliente}{(turno.personas ?? 1) > 1 && <span className="text-sm font-semibold text-muted-foreground">· {turno.personas} personas</span>}</p>
          {(ficha?.telefono ?? turno.telefono) && <a href={`tel:${(ficha?.telefono ?? turno.telefono ?? "").replace(/[^\d+]/g, "")}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary"><Phone className="h-3.5 w-3.5" />{ficha?.telefono ?? turno.telefono}</a>}
          {ficha ? (
            <dl className="mt-3 grid grid-cols-3 gap-2 text-center text-xs sm:grid-cols-5">
              {[["Turnos", ficha.total], ["Realizados", ficha.completados], ["No vino", ficha.ausentes], ["Cancelados", ficha.cancelados], ["Gastó", money(ficha.gastado)]].map(([k, v]) => (
                <div key={k as string} className="rounded-xl bg-muted p-2"><dt className="text-muted-foreground">{k}</dt><dd className="font-extrabold tabular-nums">{v}</dd></div>
              ))}
            </dl>
          ) : <Loader2 className="mt-2 h-4 w-4 animate-spin text-muted-foreground" />}
          {ficha && ficha.ausentes >= 2 && <p className="mt-2 rounded-xl bg-destructive/10 p-2 text-xs font-semibold text-destructive">Faltó {ficha.ausentes} veces. Considerá pedirle confirmación antes.</p>}
          <p className="mt-2 text-xs text-muted-foreground">{turno.origen === "panel" ? "Cargado por el local" : "Reservado online"}{(turno.reprogramaciones ?? 0) > 0 ? ` · cambió de horario ${turno.reprogramaciones} ${turno.reprogramaciones === 1 ? "vez" : "veces"}` : ""}{!ficha?.con_cuenta && ficha ? " · sin cuenta en Woref" : ""}</p>
          {turno.notas && <p className="mt-2 rounded-xl bg-muted p-2 text-sm">“{turno.notas}”</p>}
          {turno.estado === "cancelado" && turno.motivo_cancelacion && <p className="mt-2 text-sm text-muted-foreground">Motivo: {turno.motivo_cancelacion}</p>}
        </div>

        {modo === "ver" && (
          <div className="flex flex-wrap gap-2">
            {turno.estado === "pendiente" && <Button className="rounded-full" disabled={busy} onClick={() => run(() => cambiarEstadoTurno(turno.id, "confirmado"), "Turno confirmado. Le avisamos a la persona.")}>Confirmar</Button>}
            {turno.puede_empezar && <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => cambiarEstadoTurno(turno.id, "en_curso"), "Turno en curso", false)}>Empezar</Button>}
            {turno.puede_cerrar && <>
              <Button className="rounded-full" disabled={busy} onClick={() => run(() => cambiarEstadoTurno(turno.id, "completado"), "Marcado como realizado")}>Se realizó</Button>
              <Button variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => cambiarEstadoTurno(turno.id, "ausente"), "Marcado como que no vino")}>No vino</Button>
            </>}
            {activo && futuro && <Button variant="outline" className="rounded-full" onClick={() => setModo("reprogramar")}><CalendarClock className="h-4 w-4" />Cambiar horario</Button>}
            {activo && <Button variant="ghost" className="rounded-full text-destructive" onClick={() => setModo("cancelar")}>{turno.estado === "pendiente" ? "Rechazar" : "Cancelar"}</Button>}
            {ficha && <Button variant="ghost" className="rounded-full" onClick={() => onAgendarOtro({ id: ficha.cliente_id, nombre: ficha.nombre, telefono: ficha.telefono }, turno.servicio_id ?? "")}>Agendar otro turno</Button>}
          </div>
        )}
        {modo === "reprogramar" && (
          <div className="space-y-3 rounded-2xl border p-3">
            <p className="font-extrabold">Nuevo horario</p>
            <SlotPicker servicios={servicios} profesionales={profesionales} value={slot} onChange={setSlot} fijarServicio />
            <p className="text-xs text-muted-foreground">Le avisamos a la persona del cambio. Si se libera un lugar, avisamos a la lista de espera.</p>
            <div className="flex gap-2">
              <Button className="rounded-full" disabled={busy} onClick={() => { const inicio = slotIso(slot); if (!inicio) return toast.error("Elegí día y hora"); run(() => reprogramarTurno(turno.id, inicio, slot.profesional || null), "Horario cambiado"); }}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cambio</Button>
              <Button variant="ghost" className="rounded-full" onClick={() => setModo("ver")}>Volver</Button>
            </div>
          </div>
        )}
        {modo === "cancelar" && (
          <div className="space-y-3 rounded-2xl border border-destructive/30 p-3">
            <p className="font-extrabold">{turno.estado === "pendiente" ? "¿Rechazar este pedido de turno?" : "¿Cancelar este turno?"}</p>
            <Textarea aria-label="Motivo" placeholder="Motivo (se lo mostramos a la persona)" maxLength={200} value={motivo} onChange={(e) => setMotivo(e.target.value)} className="min-h-[56px] resize-none" />
            <div className="flex gap-2">
              <Button variant="destructive" className="rounded-full" disabled={busy} onClick={() => run(() => cambiarEstadoTurno(turno.id, "cancelado", motivo), "Turno cancelado")}>Confirmar</Button>
              <Button variant="ghost" className="rounded-full" onClick={() => setModo("ver")}>Volver</Button>
            </div>
          </div>
        )}

        <div className="space-y-1.5">
          <Label htmlFor="td-int" className="flex items-center gap-1.5"><StickyNote className="h-4 w-4" />Nota interna de este turno</Label>
          <Textarea id="td-int" maxLength={1000} value={interna} onChange={(e) => setInterna(e.target.value)} className="min-h-[56px] resize-none" placeholder="Solo la ve el equipo" />
          {interna !== (turno.nota_interna ?? "") && <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => guardarNotaInterna(turno.id, interna), "Nota guardada", false)}>Guardar nota</Button>}
        </div>
        {ficha?.con_cuenta && ficha.cliente_id && (
          <div className="space-y-1.5">
            <Label htmlFor="td-cli">Nota sobre esta persona (para todos sus turnos y pedidos)</Label>
            <Textarea id="td-cli" maxLength={2000} value={notaCliente} onChange={(e) => setNotaCliente(e.target.value)} className="min-h-[56px] resize-none" placeholder="Preferencias, alergias, cómo le gusta que la atiendan…" />
            {notaCliente !== (ficha.nota ?? "") && <Button size="sm" variant="outline" className="rounded-full" disabled={busy} onClick={() => run(() => guardarNotaCliente(storeId, ficha.cliente_id as string, notaCliente), "Nota guardada", false)}>Guardar nota</Button>}
          </div>
        )}

        {ficha && ficha.turnos.length > 1 && (
          <details className="rounded-2xl border p-3">
            <summary className="cursor-pointer text-sm font-extrabold">Turnos anteriores ({ficha.turnos.length - 1})</summary>
            <ul className="mt-2 divide-y text-sm">
              {ficha.turnos.filter((t) => t.id !== turno.id).map((t) => (
                <li key={t.id} className="flex items-center justify-between gap-2 py-1.5"><span>{formatDateTime(t.inicio)} · {t.servicio}</span><span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", ESTADO_TURNO[t.estado].clase)}>{ESTADO_TURNO[t.estado].texto}</span></li>
              ))}
            </ul>
          </details>
        )}
        {ficha && ficha.historial.length > 0 && (
          <details className="rounded-2xl border p-3">
            <summary className="flex cursor-pointer items-center gap-1.5 text-sm font-extrabold"><History className="h-4 w-4" />Historial de este turno</summary>
            <ol className="mt-2 space-y-1 text-sm">
              {ficha.historial.map((h, i) => <li key={i} className="flex justify-between gap-2"><span>{EVENTO_TURNO[h.evento] ?? h.evento}{typeof h.detalle?.motivo === "string" ? ` · ${h.detalle.motivo}` : ""}</span><span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(h.fecha)} · {h.por}</span></li>)}
            </ol>
          </details>
        )}
      </DialogContent>
    </Dialog>
  );
}
