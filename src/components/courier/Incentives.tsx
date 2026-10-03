import { useCallback, useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, Target, Trophy } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { Goal, goalPercent, goalWindow, loadGoals, loadShifts, Shift, ShiftsData, shiftDayLabel } from "@/lib/incentives";
import { cn } from "@/lib/utils";

/** Metas con bono (por día o semana) y turnos reservables del repartidor. */
export function CourierIncentives() {
  const [goals, setGoals] = useState<Goal[] | null>(null);
  const [shifts, setShifts] = useState<ShiftsData | null | undefined>(undefined);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const [goalList, shiftData] = await Promise.all([loadGoals(), loadShifts()]);
    setGoals(goalList);
    setShifts(shiftData);
  }, []);
  useEffect(() => { load(); }, [load]);

  const act = async (shift: Shift, action: "reservar" | "cancelar") => {
    setBusy(shift.id);
    const { error } = await db.rpc(action === "reservar" ? "delivery_turno_reservar" : "delivery_turno_cancelar", { p_turno: shift.id });
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success(action === "reservar" ? "Turno reservado: conectate a la hora" : "Turno cancelado");
    load();
  };

  if (goals === null || shifts === undefined) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const days = new Map<string, Shift[]>();
  for (const shift of shifts?.turnos ?? []) days.set(shift.fecha, [...(days.get(shift.fecha) ?? []), shift]);
  const blocked = shifts ? shifts.ausencias >= shifts.max_ausencias : false;

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <section>
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Target className="h-5 w-5 text-primary" />Metas con bono</h2>
        <p className="text-sm text-muted-foreground">Cumplí la cantidad de entregas y el bono se suma solo a tus ganancias.</p>
        {goals.length === 0 ? (
          <EmptyState className="mt-3 py-8" icon={<Trophy className="h-6 w-6" />} title="Por ahora no hay metas activas" text="Cuando haya, vas a ver acá tu avance." />
        ) : (
          <ul className="mt-3 space-y-3">
            {goals.map((goal) => (
              <li key={goal.id} className={cn("rounded-3xl border bg-card p-4", goal.lograda && "border-success/40 bg-success/5")}>
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-extrabold">{goal.nombre}</p>
                    <p className="text-xs text-muted-foreground">{goal.objetivo} entregas {goalWindow(goal)} · {goal.periodo === "dia" ? "hoy" : "esta semana"}</p>
                  </div>
                  <span className="shrink-0 rounded-full bg-primary px-3 py-1 text-sm font-black text-primary-foreground">+{money(goal.bono)}</span>
                </div>
                <Progress value={goalPercent(goal.viajes, goal.objetivo)} className="mt-3 h-2.5" aria-label={`Avance de ${goal.nombre}`} />
                <p className="mt-2 flex items-center gap-1.5 text-sm font-bold">
                  {goal.lograda ? <><CheckCircle2 className="h-4 w-4 text-success" />¡Meta cumplida! El bono ya está en tus ganancias.</> : <>{Math.min(goal.viajes, goal.objetivo)} de {goal.objetivo} <span className="font-normal text-muted-foreground">· termina {formatDateTime(goal.termina)}</span></>}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section>
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><CalendarClock className="h-5 w-5 text-primary" />Turnos</h2>
        <p className="text-sm text-muted-foreground">Reservá tu lugar en las franjas de más demanda y conectate a la hora. Podés cancelar hasta {shifts?.cancelar_horas ?? 2} horas antes.</p>
        {shifts && shifts.ausencias > 0 && (
          <p className={cn("mt-3 rounded-2xl p-3 text-sm font-semibold", blocked ? "bg-destructive/10 text-destructive" : "bg-warning/15")}>
            {blocked ? `Tenés ${shifts.ausencias} ausencias en los últimos 30 días: por ahora no podés reservar turnos.` : `Tenés ${shifts.ausencias} de ${shifts.max_ausencias} ausencias permitidas en los últimos 30 días. Una ausencia es no conectarte durante el turno reservado.`}
          </p>
        )}
        {days.size === 0 ? (
          <EmptyState className="mt-3 py-8" icon={<CalendarClock className="h-6 w-6" />} title="No hay turnos publicados" text="Cuando se publiquen nuevas franjas, las vas a ver acá." />
        ) : (
          <div className="mt-3 space-y-4">
            {[...days.entries()].map(([day, list]) => (
              <div key={day}>
                <p className="mb-2 text-sm font-extrabold">{shiftDayLabel(day)}</p>
                <ul className="space-y-2">
                  {list.map((shift) => {
                    const full = shift.ocupados >= shift.cupos && !shift.mio;
                    return (
                      <li key={shift.id} className={cn("flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3", shift.mio && "border-primary/50 bg-primary/5")}>
                        <div className="min-w-0 flex-1">
                          <p className="font-extrabold tabular-nums">{shift.desde} a {shift.hasta}</p>
                          <p className="text-xs text-muted-foreground">{shift.nota ? `${shift.nota} · ` : ""}{full ? "Completo" : `${Math.max(shift.cupos - shift.ocupados, 0)} ${shift.cupos - shift.ocupados === 1 ? "lugar libre" : "lugares libres"}`}</p>
                        </div>
                        {shift.mio
                          ? <Button size="sm" variant="outline" className="rounded-full" disabled={busy === shift.id} onClick={() => act(shift, "cancelar")}>{busy === shift.id && <Loader2 className="h-4 w-4 animate-spin" />}Reservado · Cancelar</Button>
                          : <Button size="sm" className="rounded-full" disabled={busy === shift.id || full || blocked} onClick={() => act(shift, "reservar")}>{busy === shift.id && <Loader2 className="h-4 w-4 animate-spin" />}{full ? "Completo" : "Reservar"}</Button>}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
