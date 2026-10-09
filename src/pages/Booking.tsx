import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { BellRing, CalendarCheck, CalendarPlus, Check, Clock3, Hourglass, Loader2, MapPin, Store as StoreIcon, User, Users } from "lucide-react";
import { toast } from "sonner";
import { StoreLogo } from "@/components/delivery/StoreCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { COMERCIO_COLS, db, DeliveryStore, errorMessage, money } from "@/lib/delivery";
import { normalizeTheme } from "@/lib/storefront";
import { estiloTienda } from "@/lib/storefrontStyle";
import { cn } from "@/lib/utils";
import { fetchMyProfile } from "@/services/profile";
import { cap1, DiaLibre, duracionTexto, fechaCorta, fechaLarga, fetchHorarios, fetchServiciosDeTienda, googleCalendarUrl, horaLocal, hoyLocal, icsDeTurno, MODALIDAD, Profesional, reservarTurno, Servicio, sumarDias, unirseEspera } from "@/services/bookings";

type Datos = { servicios: Servicio[]; profesionales: (Profesional & { servicios: string[] })[] };
type Confirmado = { id: string; inicio: string; fin: string; servicio: string; profesional: string | null; pendiente: boolean };

/** Reserva de turnos de un comercio (/t/:slug/reservar), con el diseño de su tienda: servicio, profesional, día y hora. */
export default function Booking() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Desde el aviso "se liberó un horario" se llega con ?servicio=…&fecha=…
  const [params] = useSearchParams();
  const fechaPedida = /^\d{4}-\d{2}-\d{2}$/.test(params.get("fecha") ?? "") ? params.get("fecha") : null;
  const [personas, setPersonas] = useState(1);
  const [espera, setEspera] = useState(fechaPedida ?? hoyLocal());
  const [anotado, setAnotado] = useState(false);
  const [store, setStore] = useState<DeliveryStore | null>(null);
  const [datos, setDatos] = useState<Datos | null>(null);
  const [state, setState] = useState<"loading" | "ready" | "missing">("loading");
  const [servicioId, setServicioId] = useState<string | null>(null);
  const [profesionalId, setProfesionalId] = useState<string | null>(null);
  const [dias, setDias] = useState<DiaLibre[] | null>(null);
  const [fecha, setFecha] = useState<string | null>(null);
  const [inicio, setInicio] = useState<string | null>(null);
  const [telefono, setTelefono] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [listo, setListo] = useState<Confirmado | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: found } = await db.from("delivery_comercios").select(COMERCIO_COLS).eq("slug", slug).maybeSingle();
      if (!alive) return;
      if (!found) { setState("missing"); return; }
      const d = await fetchServiciosDeTienda(found.id);
      if (!alive) return;
      setStore(found); setDatos(d); setState("ready");
      const pedido = params.get("servicio");
      if (pedido && d.servicios.some((s) => s.id === pedido)) setServicioId(pedido);
      else if (d.servicios.length === 1) setServicioId(d.servicios[0].id);
    })();
    return () => { alive = false; };
  }, [slug]);
  useEffect(() => { if (user) fetchMyProfile().then((p) => { if (p?.telefono) setTelefono((c) => c || p.telefono || ""); }); }, [user]);

  const servicio = datos?.servicios.find((s) => s.id === servicioId) ?? null;
  const profesionales = useMemo(() => (datos?.profesionales ?? []).filter((p) => servicioId && p.servicios.includes(servicioId)), [datos, servicioId]);

  useEffect(() => {
    setDias(null); setFecha(null); setInicio(null);
    if (!servicioId) return;
    let alive = true;
    setPersonas(1); setAnotado(false);
    fetchHorarios(servicioId, profesionalId, hoyLocal(), 21).then((d) => { if (alive) { setDias(d); setFecha(d.find((x) => x.fecha === fechaPedida)?.fecha ?? d[0]?.fecha ?? null); } }, () => { if (alive) setDias([]); });
    return () => { alive = false; };
  }, [servicioId, profesionalId]);
  useEffect(() => { setInicio(null); }, [fecha]);

  const theme = useMemo(() => normalizeTheme(store?.tienda_tema), [store?.tienda_tema]);
  const style = useMemo(() => estiloTienda(theme), [theme]);

  if (state === "loading") return <div className="flex min-h-screen items-center justify-center"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>;
  if (state === "missing" || !store || !datos) {
    return <div className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center px-6 text-center"><StoreIcon className="h-10 w-10 text-muted-foreground" /><h1 className="mt-4 text-2xl font-extrabold">No encontramos este local</h1><Button asChild className="mt-6 rounded-full"><Link to="/app">Volver</Link></Button></div>;
  }
  const { darkPage, pageStyle, accent, radiusButton, headingStyle, width } = style;
  const dia = dias?.find((d) => d.fecha === fecha) ?? null;
  // Con "cualquier profesional" el mismo horario puede repetirse: se muestra una sola vez.
  const horarios = dia ? [...new Map(dia.horarios.map((h) => [h.inicio, h])).values()] : [];
  const profElegido = inicio && profesionalId ? profesionales.find((p) => p.id === profesionalId)?.nombre ?? null : null;
  const capacidad = servicio?.capacidad ?? 1;
  /** En grupales: lugares que quedan en ese horario (el máximo entre profesionales, si se eligió "cualquiera"). */
  const lugaresDe = (ini: string) => { const del = dia?.horarios.filter((h) => h.inicio === ini && h.lugares != null) ?? []; return del.length ? Math.max(...del.map((h) => Number(h.lugares))) : null; };
  const anotarme = async () => {
    if (!servicio) return;
    if (!user) { toast.info("Ingresá para anotarte en la lista de espera."); navigate("/auth", { state: { from: `/t/${store.slug}/reservar?servicio=${servicio.id}` } }); return; }
    try { await unirseEspera(servicio.id, espera, profesionalId); setAnotado(true); toast.success("Listo: te avisamos si se libera un horario ese día."); } catch (error) { toast.error(errorMessage(error)); }
  };

  const confirmar = async () => {
    if (!servicio || !inicio) return;
    if (!user) { toast.info("Ingresá o creá tu cuenta para confirmar el turno."); navigate("/auth", { state: { from: `/t/${store.slug}/reservar` } }); return; }
    setSaving(true);
    try {
      const id = await reservarTurno({ servicio: servicio.id, inicio, profesional: profesionalId, telefono, notas, personas });
      const fin = new Date(new Date(inicio).getTime() + servicio.duracion_min * 60_000).toISOString();
      setListo({ id, inicio, fin, servicio: servicio.nombre, profesional: profElegido, pendiente: Boolean(servicio.requiere_confirmacion) });
    } catch (error) { toast.error(errorMessage(error)); fetchHorarios(servicio.id, profesionalId, hoyLocal(), 21).then((d) => { setDias(d); }); setInicio(null); } finally { setSaving(false); }
  };

  const descargarIcs = () => {
    if (!listo) return;
    const blob = new Blob([icsDeTurno({ ...listo, comercio: store.nombre, direccion: store.direccion, profesional: listo.profesional ?? undefined })], { type: "text/calendar" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "turno.ics"; a.click(); URL.revokeObjectURL(a.href);
  };

  return (
    <div style={pageStyle} className={cn("min-h-screen bg-background text-foreground", darkPage && "dark")}>
      <header className="border-b bg-card text-card-foreground">
        <div className={cn("mx-auto flex h-16 items-center gap-3 px-4 sm:px-6", width)}>
          <Link to={`/t/${store.slug}`} className="flex min-w-0 items-center gap-3" aria-label={`Volver a ${store.nombre}`}><StoreLogo store={store} className="h-10 w-10 shrink-0 text-sm" /><span className="truncate text-lg font-extrabold" style={headingStyle}>{store.nombre}</span></Link>
        </div>
      </header>

      <main className={cn("mx-auto px-4 pb-24 pt-6 sm:px-6", width)}>
        {listo ? (
          <section className="mx-auto max-w-xl rounded-3xl border bg-card p-6 text-center text-card-foreground" aria-live="polite">
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full" style={accent}>{listo.pendiente ? <Hourglass className="h-7 w-7" /> : <CalendarCheck className="h-7 w-7" />}</span>
            <h1 className="mt-4 text-2xl font-extrabold" style={headingStyle}>{listo.pendiente ? "¡Solicitud enviada!" : "¡Turno confirmado!"}</h1>
            {listo.pendiente && <p className="mt-1 text-sm text-muted-foreground">El local confirma cada turno. Te avisamos apenas responda; mientras tanto el horario queda guardado para vos.</p>}
            <p className="mt-2 text-lg font-bold">{listo.servicio}</p>
            <p className="text-muted-foreground">{cap1(fechaLarga(listo.inicio))} · {horaLocal(listo.inicio)} hs</p>
            {store.direccion && <p className="mt-1 text-sm text-muted-foreground"><MapPin className="mr-1 inline h-4 w-4" />{store.nombre} · {store.direccion}</p>}
            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <Button variant="outline" className="rounded-full" onClick={descargarIcs}><CalendarPlus className="h-4 w-4" />Agregar al calendario</Button>
              <Button variant="outline" className="rounded-full" asChild><a href={googleCalendarUrl({ ...listo, comercio: store.nombre, direccion: store.direccion })} target="_blank" rel="noopener noreferrer">Google Calendar</a></Button>
              <Button asChild className="rounded-full" style={{ ...accent, ...radiusButton }}><Link to="/app/turnos">Ver mis turnos</Link></Button>
            </div>
          </section>
        ) : (
          <>
            <h1 className="text-2xl font-extrabold sm:text-3xl" style={headingStyle}>Reservá tu turno</h1>
            <p className="mt-1 text-muted-foreground">Elegí el servicio, el día y la hora. Pagás en el lugar.</p>

            {datos.servicios.length === 0 ? <p className="mt-6 rounded-2xl bg-muted p-4 text-muted-foreground">Este local todavía no ofrece turnos en línea.</p> : (
              <div className="mt-6 space-y-6">
                <section aria-label="Servicio">
                  <h2 className="mb-2 font-extrabold">1. ¿Qué servicio querés?</h2>
                  <div role="radiogroup" aria-label="Servicio" className="grid gap-2 sm:grid-cols-2">
                    {datos.servicios.map((s) => (
                      <button key={s.id} type="button" role="radio" aria-checked={servicioId === s.id} onClick={() => { setServicioId(s.id); setProfesionalId(null); }} className={cn("rounded-2xl border p-4 text-left transition-colors", servicioId === s.id ? "border-[var(--sf-accent)] bg-[var(--sf-accent)]/5" : "bg-card hover:bg-muted")}>
                        <span className="flex items-start justify-between gap-2"><span className="font-extrabold">{s.nombre}</span><span className="font-black tabular-nums">{s.precio > 0 ? money(s.precio) : "Consultar"}</span></span>
                        <span className="mt-0.5 flex items-center gap-2 text-sm text-muted-foreground"><Clock3 className="h-3.5 w-3.5" />{duracionTexto(s.duracion_min)} · {MODALIDAD[s.modalidad]}</span>
                        {s.descripcion && <span className="mt-1 line-clamp-2 block text-sm text-muted-foreground">{s.descripcion}</span>}
                      </button>
                    ))}
                  </div>
                </section>

                {servicio && (
                  <section aria-label="Profesional">
                    <h2 className="mb-2 font-extrabold">2. ¿Con quién?</h2>
                    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label="Profesional">
                      <button type="button" role="radio" aria-checked={profesionalId === null} onClick={() => setProfesionalId(null)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", profesionalId === null ? "border-[var(--sf-accent)] bg-[var(--sf-accent)]/10" : "bg-card hover:bg-muted")}>Cualquiera</button>
                      {profesionales.map((p) => <button key={p.id} type="button" role="radio" aria-checked={profesionalId === p.id} onClick={() => setProfesionalId(p.id)} className={cn("inline-flex items-center gap-1.5 rounded-full border px-4 py-2 text-sm font-bold", profesionalId === p.id ? "border-[var(--sf-accent)] bg-[var(--sf-accent)]/10" : "bg-card hover:bg-muted")}><User className="h-3.5 w-3.5" />{p.nombre}</button>)}
                    </div>
                  </section>
                )}

                {servicio && (
                  <section aria-label="Día y hora">
                    <h2 className="mb-2 font-extrabold">3. Elegí el día y la hora</h2>
                    {!dias ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
                      : dias.length === 0 ? <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">No hay horarios libres en los próximos días. Probá con otro profesional o volvé más tarde.</p> : (
                        <>
                          <div className="scrollbar-none flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Día">
                            {dias.map((d) => <button key={d.fecha} type="button" role="tab" aria-selected={fecha === d.fecha} onClick={() => setFecha(d.fecha)} className={cn("shrink-0 rounded-2xl border px-4 py-2 text-sm font-bold capitalize", fecha === d.fecha ? "border-transparent" : "bg-card hover:bg-muted")} style={fecha === d.fecha ? accent : undefined}>{fechaCorta(`${d.fecha}T15:00:00Z`)}</button>)}
                          </div>
                          <div className="mt-3 grid grid-cols-3 gap-2 sm:grid-cols-5 md:grid-cols-6" role="radiogroup" aria-label="Hora">
                            {horarios.map((h) => { const lug = lugaresDe(h.inicio); return (
                              <button key={h.inicio} type="button" role="radio" aria-checked={inicio === h.inicio} onClick={() => { setInicio(h.inicio); if (lug != null) setPersonas((n) => Math.min(n, lug)); }} className={cn("flex h-12 flex-col items-center justify-center rounded-xl border text-sm font-extrabold tabular-nums", inicio === h.inicio ? "border-transparent" : "bg-card hover:bg-muted")} style={inicio === h.inicio ? accent : undefined}>
                                {horaLocal(h.inicio)}{lug != null && <span className="text-[10px] font-semibold opacity-80">{lug} {lug === 1 ? "lugar" : "lugares"}</span>}
                              </button>
                            ); })}
                          </div>
                        </>
                      )}
                    {dias && (
                      <div className="mt-4 flex flex-wrap items-end gap-2 rounded-2xl border border-dashed p-3 text-sm">
                        <BellRing className="mb-2 h-4 w-4 text-muted-foreground" />
                        <div className="min-w-0 flex-1"><p className="font-bold">¿No hay lugar el día que querés?</p><p className="text-xs text-muted-foreground">Anotate y te avisamos si alguien cancela.</p></div>
                        <input type="date" aria-label="Día para la lista de espera" min={hoyLocal()} max={sumarDias(hoyLocal(), servicio.reserva_max_dias ?? 60)} value={espera} onChange={(e) => { setEspera(e.target.value); setAnotado(false); }} className="h-9 rounded-full border bg-background px-3" />
                        <Button type="button" variant="outline" size="sm" className="h-9 rounded-full" disabled={anotado} onClick={anotarme}>{anotado ? "Anotado" : "Avisarme"}</Button>
                      </div>
                    )}
                  </section>
                )}

                {servicio && inicio && (
                  <section aria-label="Confirmar" className="space-y-3 rounded-3xl border bg-card p-4 text-card-foreground sm:p-5">
                    <h2 className="font-extrabold">4. Confirmá tu turno</h2>
                    <p className="rounded-xl bg-muted p-3 text-sm"><span className="font-bold">{servicio.nombre}</span> · <span>{cap1(fechaLarga(inicio))}</span> a las <span className="font-bold">{horaLocal(inicio)} hs</span>{servicio.precio > 0 && <> · {money(servicio.precio * personas)} en el lugar</>}</p>
                    {capacidad > 1 && (
                      <div className="space-y-1.5"><Label htmlFor="b-pers" className="flex items-center gap-1.5"><Users className="h-4 w-4" />¿Cuántas personas?</Label>
                        <Input id="b-pers" type="number" min={1} max={lugaresDe(inicio) ?? capacidad} value={personas} onChange={(e) => setPersonas(Math.max(1, Math.min(lugaresDe(inicio) ?? capacidad, Number(e.target.value) || 1)))} className="w-28" /></div>
                    )}
                    <div className="space-y-1.5"><Label htmlFor="b-tel">Teléfono de contacto</Label><Input id="b-tel" type="tel" inputMode="tel" autoComplete="tel" value={telefono} maxLength={25} onChange={(e) => setTelefono(e.target.value)} placeholder="2355 123456" /></div>
                    <div className="space-y-1.5"><Label htmlFor="b-notas">Aclaraciones (opcional)</Label><Textarea id="b-notas" value={notas} maxLength={300} onChange={(e) => setNotas(e.target.value)} className="min-h-[64px] resize-none" /></div>
                    <p className="text-xs text-muted-foreground">Podés cancelarlo o cambiarlo sin costo hasta {servicio.cancelar_hasta_horas} hs antes.{servicio.requiere_confirmacion ? " El local confirma cada turno y te avisamos." : ""}</p>
                    <Button className="h-12 w-full text-base font-bold" style={{ ...accent, ...radiusButton }} disabled={saving} onClick={confirmar}>{saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Check className="h-5 w-5" />}{user ? (servicio.requiere_confirmacion ? "Pedir turno" : "Confirmar turno") : "Ingresar para confirmar"}</Button>
                  </section>
                )}
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
