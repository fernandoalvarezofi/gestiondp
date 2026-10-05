import { useCallback, useEffect, useState } from "react";
import { CalendarCheck, ChevronLeft, ChevronRight, Loader2, Phone } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { cancelarTurno, cap1, cerrarTurno, ESTADO_TURNO, fechaLarga, fetchAgenda, horaLocal, hoyLocal, Profesional, sumarDias, TurnoAgenda } from "@/services/bookings";

/** Agenda del día: quién viene, con qué profesional, y el cierre de cada turno (se realizó, no vino o se cancela). */
export function AgendaTab({ storeId, profesionales }: { storeId: string; profesionales: Profesional[] }) {
  const [fecha, setFecha] = useState(hoyLocal());
  const [prof, setProf] = useState<string | null>(null);
  const [rows, setRows] = useState<TurnoAgenda[] | null>(null);
  const [cancelando, setCancelando] = useState<TurnoAgenda | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    try { setRows(await fetchAgenda(storeId, fecha, fecha, prof)); } catch (error) { toast.error(errorMessage(error)); setRows([]); }
  }, [storeId, fecha, prof]);
  useEffect(() => { setRows(null); load(); const t = window.setInterval(load, 60000); return () => window.clearInterval(t); }, [load]);

  const run = async (id: string, action: () => Promise<void>, ok: string) => {
    setBusy(id);
    try { await action(); toast.success(ok); setCancelando(null); setMotivo(""); await load(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(null); }
  };
  const confirmados = (rows ?? []).filter((r) => r.estado === "confirmado" || r.estado === "completado");

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Día anterior" onClick={() => setFecha(sumarDias(fecha, -1))}><ChevronLeft className="h-4 w-4" /></Button>
        <input type="date" aria-label="Fecha" value={fecha} onChange={(e) => e.target.value && setFecha(e.target.value)} className="h-10 rounded-full border bg-background px-4 text-sm font-bold" />
        <Button variant="outline" size="icon" className="rounded-full" aria-label="Día siguiente" onClick={() => setFecha(sumarDias(fecha, 1))}><ChevronRight className="h-4 w-4" /></Button>
        {fecha !== hoyLocal() && <Button variant="ghost" className="rounded-full" onClick={() => setFecha(hoyLocal())}>Hoy</Button>}
        <select aria-label="Profesional" value={prof ?? ""} onChange={(e) => setProf(e.target.value || null)} className="ml-auto h-10 rounded-full border bg-background px-3 text-sm font-semibold">
          <option value="">Todo el equipo</option>
          {profesionales.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
      </div>
      <p className="text-sm text-muted-foreground"><span className="font-bold text-foreground">{cap1(fechaLarga(`${fecha}T15:00:00Z`))}</span> · {confirmados.length} {confirmados.length === 1 ? "turno" : "turnos"} · {money(confirmados.reduce((t, r) => t + Number(r.precio), 0))} a cobrar en el local</p>

      {!rows ? <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState icon={<CalendarCheck className="h-7 w-7" />} title="No hay turnos este día" text="Cuando alguien reserve, lo vas a ver acá." />
        : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className={cn("rounded-3xl border bg-card p-4", r.estado === "cancelado" && "opacity-60")}>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="font-extrabold tabular-nums">{horaLocal(r.inicio)} – {horaLocal(r.fin)} <span className="font-semibold text-muted-foreground">· {r.servicio}</span></p>
                  <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_TURNO[r.estado].clase)}>{ESTADO_TURNO[r.estado].texto}</span>
                </div>
                <p className="mt-1 text-sm"><span className="font-bold">{r.cliente}</span> · con {r.profesional}{Number(r.precio) > 0 && ` · ${money(r.precio)}`}</p>
                {r.notas && <p className="mt-1 rounded-xl bg-muted p-2 text-sm">“{r.notas}”</p>}
                {r.telefono && <a href={`tel:${r.telefono.replace(/[^\d+]/g, "")}`} className="mt-1 inline-flex items-center gap-1 text-sm font-semibold text-primary"><Phone className="h-3.5 w-3.5" />{r.telefono}</a>}
                {r.estado === "confirmado" && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {r.puede_cerrar && <>
                      <Button size="sm" className="rounded-full" disabled={busy === r.id} onClick={() => run(r.id, () => cerrarTurno(r.id, "completado"), "Turno marcado como realizado")}>Se realizó</Button>
                      <Button size="sm" variant="outline" className="rounded-full" disabled={busy === r.id} onClick={() => run(r.id, () => cerrarTurno(r.id, "ausente"), "Marcado como que no vino")}>No vino</Button>
                    </>}
                    <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => { setCancelando(r); setMotivo(""); }}>Cancelar</Button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

      <Dialog open={Boolean(cancelando)} onOpenChange={(open) => !open && !busy && setCancelando(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-extrabold">¿Cancelar este turno?</DialogTitle>
          <DialogDescription>{cancelando && `${cancelando.cliente} · ${cancelando.servicio} a las ${horaLocal(cancelando.inicio)} hs. Avisale a la persona por teléfono.`}</DialogDescription>
          <Textarea aria-label="Motivo" placeholder="Motivo (opcional)" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} className="min-h-[64px] resize-none" />
          <div className="flex gap-2"><Button variant="destructive" className="rounded-full" disabled={Boolean(busy)} onClick={() => cancelando && run(cancelando.id, () => cancelarTurno(cancelando.id, motivo), "Turno cancelado")}>Cancelar turno</Button><Button variant="ghost" className="rounded-full" onClick={() => setCancelando(null)}>Volver</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
