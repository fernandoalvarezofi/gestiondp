import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CalendarCheck, CalendarPlus, Loader2, MapPin } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { cancelarTurno, cap1, duracionTexto, ESTADO_TURNO, fechaLarga, fetchMisTurnos, googleCalendarUrl, horaLocal, icsDeTurno, MODALIDAD, Turno } from "@/services/bookings";

/** Mis turnos: los próximos (con opción de cancelar dentro del plazo y de sumarlos al calendario) y el historial. */
export default function MyAppointments() {
  const [turnos, setTurnos] = useState<Turno[] | null>(null);
  const [cancelando, setCancelando] = useState<Turno | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState(false);
  const load = useCallback(async () => { setTurnos(await fetchMisTurnos()); }, []);
  useEffect(() => { load(); }, [load]);

  const ahora = Date.now();
  const proximos = (turnos ?? []).filter((t) => t.estado === "confirmado" && new Date(t.fin).getTime() >= ahora).sort((a, b) => a.inicio.localeCompare(b.inicio));
  const historial = (turnos ?? []).filter((t) => !proximos.includes(t));

  const cancelar = async () => {
    if (!cancelando) return;
    setBusy(true);
    try { await cancelarTurno(cancelando.id, motivo); toast.success("Cancelaste el turno"); setCancelando(null); setMotivo(""); await load(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  const ics = (t: Turno) => {
    const blob = new Blob([icsDeTurno({ id: t.id, inicio: t.inicio, fin: t.fin, servicio: t.servicio, comercio: t.comercio, direccion: t.direccion, profesional: t.profesional })], { type: "text/calendar" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "turno.ics"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div className="mx-auto max-w-3xl px-4 pb-14 pt-5 sm:px-6">
      <PageHeader eyebrow="Reservas" title="Mis turnos" subtitle="Tus próximos turnos y los de los últimos 3 meses." />
      {!turnos ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : turnos.length === 0 ? <EmptyState className="mt-6" icon={<CalendarCheck className="h-7 w-7" />} title="Todavía no tenés turnos" text="Buscá un local que ofrezca turnos y reservá en un minuto." action={<Button asChild className="rounded-full"><Link to="/app">Descubrir locales</Link></Button>} />
        : (
          <div className="mt-6 space-y-8">
            <section aria-label="Próximos turnos">
              <h2 className="text-lg font-extrabold">Próximos</h2>
              {proximos.length === 0 ? <p className="mt-2 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No tenés turnos próximos.</p> : (
                <ul className="mt-3 space-y-3">
                  {proximos.map((t) => (
                    <li key={t.id} className="rounded-3xl border bg-card p-4 sm:p-5">
                      <div className="flex flex-wrap items-start justify-between gap-2">
                        <div><p className="text-lg font-extrabold">{t.servicio}</p><p className="text-muted-foreground">{cap1(fechaLarga(t.inicio))} · {horaLocal(t.inicio)} hs · {duracionTexto(t.duracion_min)}</p></div>
                        <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_TURNO[t.estado].clase)}>{ESTADO_TURNO[t.estado].texto}</span>
                      </div>
                      <p className="mt-2 text-sm"><Link to={`/t/${t.comercio_slug}`} className="font-bold hover:underline">{t.comercio}</Link> · con {t.profesional} · {MODALIDAD[t.modalidad]}{t.precio > 0 && ` · ${money(t.precio)} en el lugar`}</p>
                      {t.direccion && t.modalidad === "en_local" && <p className="text-sm text-muted-foreground"><MapPin className="mr-1 inline h-3.5 w-3.5" />{t.direccion}</p>}
                      <div className="mt-3 flex flex-wrap gap-2">
                        <Button size="sm" variant="outline" className="rounded-full" onClick={() => ics(t)}><CalendarPlus className="h-4 w-4" />Calendario</Button>
                        <Button size="sm" variant="outline" className="rounded-full" asChild><a href={googleCalendarUrl(t)} target="_blank" rel="noopener noreferrer">Google Calendar</a></Button>
                        {t.puede_cancelar ? <Button size="sm" variant="ghost" className="rounded-full text-destructive" onClick={() => { setCancelando(t); setMotivo(""); }}>Cancelar turno</Button>
                          : <span className="self-center text-xs text-muted-foreground">Ya no se puede cancelar desde acá (venció el {formatDateTime(t.cancelar_hasta)}). Comunicate con el local.</span>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            {historial.length > 0 && (
              <section aria-label="Historial">
                <h2 className="text-lg font-extrabold">Historial</h2>
                <ul className="mt-3 divide-y rounded-3xl border bg-card">
                  {historial.map((t) => (
                    <li key={t.id} className="flex flex-wrap items-center gap-3 p-4 text-sm">
                      <span className="min-w-0 flex-1"><span className="block font-bold">{t.servicio} · {t.comercio}</span><span className="block text-muted-foreground">{formatDateTime(t.inicio)}{t.estado === "cancelado" && (t.cancelado_por === "comercio" ? " · lo canceló el local" : " · lo cancelaste vos")}</span></span>
                      <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_TURNO[t.estado].clase)}>{ESTADO_TURNO[t.estado].texto}</span>
                      <Button size="sm" variant="outline" className="rounded-full" asChild><Link to={`/t/${t.comercio_slug}/reservar`}>Reservar de nuevo</Link></Button>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      <Dialog open={Boolean(cancelando)} onOpenChange={(open) => !open && !busy && setCancelando(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-extrabold">¿Cancelar el turno?</DialogTitle>
          <DialogDescription>{cancelando && `${cancelando.servicio} · ${fechaLarga(cancelando.inicio)} a las ${horaLocal(cancelando.inicio)} hs. El horario queda libre para otra persona.`}</DialogDescription>
          <Textarea aria-label="Motivo (opcional)" placeholder="Contanos por qué (opcional)" value={motivo} maxLength={200} onChange={(e) => setMotivo(e.target.value)} className="min-h-[64px] resize-none" />
          <div className="flex gap-2"><Button variant="destructive" className="rounded-full" disabled={busy} onClick={cancelar}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Sí, cancelar</Button><Button variant="ghost" className="rounded-full" disabled={busy} onClick={() => setCancelando(null)}>Volver</Button></div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
