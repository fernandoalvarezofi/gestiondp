import { ReactNode, useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { CalendarCheck, CheckCircle2, Clock3, ListChecks, Loader2, Plus, UserRoundX, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { ErrorState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { cambiarEstadoTurno, cap1, EnEspera, ESTADO_TURNO, fechaCorta, fetchAgenda, fetchListaEspera, horaLocal, hoyLocal, sumarDias, TurnoAgenda } from "@/services/bookings";

const BASE = "/app/comercio/turnos";

/**
 * Centro de operaciones del día: qué pasa ahora, qué sigue, qué hay que confirmar, qué falta cerrar
 * (turnos que ya pasaron sin marcar si vino o no) y quién espera un lugar. Cada acción se resuelve acá mismo.
 */
export function HoyPanel({ storeId }: { storeId: string }) {
  const navigate = useNavigate();
  const [hoy, setHoy] = useState<TurnoAgenda[] | null>(null);
  const [pendientes, setPendientes] = useState<TurnoAgenda[]>([]);
  const [porCerrar, setPorCerrar] = useState<TurnoAgenda[]>([]);
  const [espera, setEspera] = useState<EnEspera[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const d = hoyLocal();
    try {
      const [h, p, c, e] = await Promise.all([
        fetchAgenda(storeId, d, d),
        fetchAgenda(storeId, d, sumarDias(d, 60), { estado: "pendiente" }),
        fetchAgenda(storeId, sumarDias(d, -7), d, { estado: "confirmado" }),
        fetchListaEspera(storeId).catch(() => [] as EnEspera[]),
      ]);
      setHoy(h); setPendientes(p); setPorCerrar(c.filter((t) => t.puede_cerrar && new Date(t.fin).getTime() < Date.now())); setEspera(e); setError(null);
    } catch (err) { setError(err); }
  }, [storeId]);
  useEffect(() => { load(); const t = window.setInterval(load, 60000); return () => window.clearInterval(t); }, [load]);

  const accion = async (t: TurnoAgenda, estado: "confirmado" | "en_curso" | "completado" | "ausente", ok: string) => {
    setBusy(t.id);
    try { await cambiarEstadoTurno(t.id, estado); toast.success(ok); await load(); } catch (err) { toast.error(errorMessage(err)); } finally { setBusy(null); }
  };
  const abrir = (t: TurnoAgenda) => navigate(`${BASE}/calendario?turno=${t.id}`);

  if (error && !hoy) return <ErrorState title="No pudimos cargar el día" error={error} onRetry={load} />;
  if (!hoy) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const ahora = Date.now();
  const vigentes = hoy.filter((t) => t.estado !== "cancelado");
  const enCurso = vigentes.filter((t) => t.estado === "en_curso");
  const siguen = vigentes.filter((t) => (t.estado === "confirmado" || t.estado === "pendiente") && new Date(t.fin).getTime() > ahora);
  const atendidos = vigentes.filter((t) => t.estado === "completado");
  const ausentes = vigentes.filter((t) => t.estado === "ausente").length;
  const estimado = vigentes.filter((t) => t.estado !== "ausente").reduce((s, t) => s + Number(t.precio), 0);
  const cobrado = atendidos.reduce((s, t) => s + Number(t.precio), 0);

  const fila = (t: TurnoAgenda, acciones: ReactNode, conDia = false) => (
    <li key={t.id} className="flex flex-wrap items-center gap-3 p-3">
      <span className="h-10 w-1.5 shrink-0 rounded-full" style={{ background: t.color || "hsl(var(--primary))" }} />
      <button type="button" onClick={() => abrir(t)} className="min-w-[13rem] flex-1 text-left">
        <p className="font-extrabold tabular-nums">{conDia && <span className="font-semibold text-muted-foreground">{cap1(fechaCorta(t.inicio))} · </span>}{horaLocal(t.inicio)} – {horaLocal(t.fin)} <span className="font-semibold text-muted-foreground">· {t.servicio}</span></p>
        <p className="truncate text-sm"><span className="font-bold">{t.cliente}</span> · con {t.profesional}{t.telefono ? ` · ${t.telefono}` : ""}</p>
      </button>
      <div className="ml-auto flex gap-1.5">{acciones}</div>
    </li>
  );

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Kpi icono={<CalendarCheck className="h-4 w-4" />} titulo="Turnos de hoy" valor={vigentes.length} sub={`${siguen.length} por atender`} />
        <Kpi icono={<CheckCircle2 className="h-4 w-4" />} titulo="Atendidos" valor={atendidos.length} sub={`${money(cobrado)} de ${money(estimado)}`} />
        <Kpi icono={<Clock3 className="h-4 w-4" />} titulo="Por confirmar" valor={pendientes.length} sub="pedidos online" alerta={pendientes.length > 0} />
        <Kpi icono={<UserRoundX className="h-4 w-4" />} titulo="No vinieron" valor={ausentes} sub={porCerrar.length ? `${porCerrar.length} sin cerrar` : "todo al día"} alerta={porCerrar.length > 0} />
      </div>

      <div className="flex flex-wrap gap-2">
        <Button asChild className="rounded-full"><Link to={`${BASE}/calendario?nuevo=1`}><Plus className="h-4 w-4" />Nuevo turno</Link></Button>
        <Button asChild variant="outline" className="rounded-full"><Link to={`${BASE}/calendario`}>Ver calendario</Link></Button>
      </div>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="space-y-5">
          <Bloque titulo="Ahora y lo que sigue hoy" vacio="No quedan turnos por atender hoy.">
            {[...enCurso, ...siguen].slice(0, 12).map((t) => fila(t, t.estado === "en_curso" ? (
              <>
                <span className={cn("self-center rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_TURNO.en_curso.clase)}>En curso</span>
                <Button size="sm" className="rounded-full" disabled={busy === t.id} onClick={() => accion(t, "completado", "Marcado como realizado")}>Terminó</Button>
              </>
            ) : t.puede_empezar ? (
              <Button size="sm" variant="outline" className="rounded-full" disabled={busy === t.id} onClick={() => accion(t, "en_curso", `Empezó el turno de ${t.cliente}`)}>Empezar</Button>
            ) : <span className={cn("self-center rounded-full px-2.5 py-0.5 text-xs font-bold", ESTADO_TURNO[t.estado].clase)}>{ESTADO_TURNO[t.estado].texto}</span>))}
          </Bloque>
          {porCerrar.length > 0 && (
            <Bloque titulo="Falta marcar si vinieron" ayuda="Así las métricas y la ficha de cada cliente quedan bien." icono={<ListChecks className="h-4 w-4" />}>
              {porCerrar.map((t) => fila(t, <>
                <Button size="sm" className="rounded-full" disabled={busy === t.id} onClick={() => accion(t, "completado", "Marcado como realizado")}>Vino</Button>
                <Button size="sm" variant="outline" className="rounded-full" disabled={busy === t.id} onClick={() => accion(t, "ausente", "Marcado como que no vino")}>No vino</Button>
              </>, true))}
            </Bloque>
          )}
        </div>
        <div className="space-y-5">
          <Bloque titulo="Por confirmar" ayuda="Pedidos de turno que hicieron online. Al confirmar le avisamos a la persona." vacio="No hay pedidos de turno esperando.">
            {pendientes.slice(0, 15).map((t) => fila(t, <>
              <Button size="sm" className="rounded-full" disabled={busy === t.id} onClick={() => accion(t, "confirmado", `Confirmado: ${t.cliente}. Le avisamos.`)}>Confirmar</Button>
              <Button size="sm" variant="ghost" className="rounded-full" onClick={() => abrir(t)}>Ver</Button>
            </>, true))}
          </Bloque>
          <Bloque titulo="Lista de espera" ayuda="Personas que querían un día sin lugar. Si se libera un horario, les avisamos solos." vacio="Nadie está esperando lugar." icono={<UsersRound className="h-4 w-4" />}
            pie={espera.length > 0 ? <Link to={`${BASE}/espera`} className="text-sm font-bold text-primary hover:underline">Ver toda la lista ({espera.length})</Link> : null}>
            {espera.slice(0, 5).map((e) => (
              <li key={e.id} className="flex items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1"><span className="block truncate font-bold">{e.cliente}</span><span className="block truncate text-muted-foreground">{cap1(fechaCorta(`${e.fecha}T15:00:00Z`))} · {e.servicio}{e.profesional ? ` · con ${e.profesional}` : ""}</span></span>
                {e.avisado_at && <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-bold">Avisado</span>}
              </li>
            ))}
          </Bloque>
        </div>
      </div>
    </div>
  );
}

function Kpi({ icono, titulo, valor, sub, alerta }: { icono: ReactNode; titulo: string; valor: number; sub: string; alerta?: boolean }) {
  return (
    <div className={cn("rounded-3xl border bg-card p-4", alerta && "border-brand-yellow/60 bg-brand-yellow/10")}>
      <p className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">{icono}{titulo}</p>
      <p className="mt-1 text-2xl font-black tabular-nums">{valor}</p>
      <p className="truncate text-xs text-muted-foreground">{sub}</p>
    </div>
  );
}

function Bloque({ titulo, ayuda, vacio, icono, pie, children }: { titulo: string; ayuda?: string; vacio?: string; icono?: ReactNode; pie?: ReactNode; children: ReactNode }) {
  const items = Array.isArray(children) ? children.filter(Boolean) : children ? [children] : [];
  return (
    <section className="rounded-3xl border bg-card" aria-label={titulo}>
      <header className="border-b px-4 py-3">
        <h2 className="flex items-center gap-1.5 font-extrabold">{icono}{titulo}</h2>
        {ayuda && <p className="text-xs text-muted-foreground">{ayuda}</p>}
      </header>
      {items.length ? <ul className="divide-y">{children}</ul> : <p className="px-4 py-6 text-center text-sm text-muted-foreground">{vacio}</p>}
      {pie && <div className="border-t px-4 py-2.5">{pie}</div>}
    </section>
  );
}
