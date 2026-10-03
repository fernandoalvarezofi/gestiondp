import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarClock, Loader2, Pencil, Plus, Target } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { argentinaDateKey, db, errorMessage, money } from "@/lib/delivery";
import { goalWindow, shiftDayLabel } from "@/lib/incentives";
import { cn } from "@/lib/utils";

type Meta = { id: string; nombre: string; periodo: "dia" | "semana"; objetivo: number; bono: number; hora_desde: string | null; hora_hasta: string | null; activa: boolean };
type AdminShift = { id: string; fecha: string; desde: string; hasta: string; nota: string | null; cupos: number; activo: boolean; pasado: boolean; duracion: number; repartidores: { id: string; nombre: string | null; minutos: number }[] };
const emptyMeta = { id: null as string | null, nombre: "", periodo: "dia" as Meta["periodo"], objetivo: "5", bono: "1000", franja: false, desde: "20:00", hasta: "23:00", activa: true };

/** Incentivos: metas con bono y turnos reservables, con la cobertura y la asistencia de cada turno. */
export function IncentivesManager() {
  const [tab, setTab] = useState<"metas" | "turnos">("metas");
  const [metas, setMetas] = useState<Meta[] | null>(null);
  const [shifts, setShifts] = useState<AdminShift[] | null>(null);
  const [form, setForm] = useState<typeof emptyMeta | null>(null);
  const [saving, setSaving] = useState(false);
  const [turno, setTurno] = useState({ fecha: argentinaDateKey(), desde: "20:00", hasta: "23:00", cupos: "10", nota: "", repetir: "0" });

  const load = useCallback(async () => {
    const [{ data: goals }, { data: turns }] = await Promise.all([db.from("delivery_metas").select("*").order("created_at", { ascending: false }), db.rpc("delivery_admin_turnos")]);
    setMetas(((goals || []) as Meta[]).map((item) => ({ ...item, bono: Number(item.bono) })));
    setShifts((turns || []) as AdminShift[]);
  }, []);
  useEffect(() => { load(); }, [load]);

  const saveGoal = async (event: FormEvent) => {
    event.preventDefault();
    if (!form) return;
    setSaving(true);
    const { error } = await db.rpc("delivery_admin_guardar_meta", {
      p_id: form.id, p_nombre: form.nombre, p_periodo: form.periodo, p_objetivo: Number(form.objetivo), p_bono: Number(form.bono),
      p_hora_desde: form.franja ? form.desde : null, p_hora_hasta: form.franja ? form.hasta : null, p_activa: form.activa,
    });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Meta guardada");
    setForm(null);
    load();
  };
  const toggleGoal = async (meta: Meta, activa: boolean) => {
    const { error } = await db.rpc("delivery_admin_guardar_meta", { p_id: meta.id, p_nombre: meta.nombre, p_periodo: meta.periodo, p_objetivo: meta.objetivo, p_bono: meta.bono, p_hora_desde: meta.hora_desde, p_hora_hasta: meta.hora_hasta, p_activa: activa });
    if (error) return toast.error(errorMessage(error));
    load();
  };
  const createShift = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { data, error } = await db.rpc("delivery_admin_crear_turno", { p_fecha: turno.fecha, p_desde: turno.desde, p_hasta: turno.hasta, p_cupos: Number(turno.cupos), p_nota: turno.nota, p_repetir_dias: Number(turno.repetir) });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(Number(data) === 0 ? "Ya existían esos turnos" : `Se crearon ${data} turnos`);
    load();
  };
  const toggleShift = async (shift: AdminShift, activo: boolean) => {
    const { error } = await db.rpc("delivery_admin_turno_activo", { p_id: shift.id, p_activo: activo });
    if (error) return toast.error(errorMessage(error));
    load();
  };

  if (!metas || !shifts) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const byDay = new Map<string, AdminShift[]>();
  for (const shift of shifts) byDay.set(shift.fecha, [...(byDay.get(shift.fecha) ?? []), shift]);

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {([["metas", "Metas con bono", Target], ["turnos", "Turnos", CalendarClock]] as const).map(([id, label, Icon]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold", tab === id ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}><Icon className="h-4 w-4" />{label}</button>
        ))}
      </div>

      {tab === "metas" && (
        <>
          <div className="flex items-center justify-between gap-3">
            <p className="max-w-xl text-sm text-muted-foreground">Cuando un repartidor llega a la cantidad de entregas dentro del período (y la franja, si la hay), el bono se acredita solo a sus ganancias. Cuenta pedidos y envíos de paquetes.</p>
            <Button className="shrink-0 rounded-full" onClick={() => setForm({ ...emptyMeta })}><Plus className="h-4 w-4" />Nueva meta</Button>
          </div>
          {metas.length === 0 ? <EmptyState icon={<Target className="h-7 w-7" />} title="Todavía no hay metas" text="Creá una, por ejemplo: 10 entregas en la semana y $5.000 de bono." /> : (
            <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
              {metas.map((meta) => (
                <li key={meta.id} className="flex flex-wrap items-center gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-bold">{meta.nombre}</p>
                    <p className="text-xs text-muted-foreground">{meta.objetivo} entregas {goalWindow(meta)} · {meta.periodo === "dia" ? "por día" : "por semana"} · bono {money(meta.bono)}</p>
                  </div>
                  <label className="flex items-center gap-2 text-xs font-semibold">Activa<Switch checked={meta.activa} onCheckedChange={(checked) => toggleGoal(meta, checked)} /></label>
                  <Button size="icon" variant="ghost" aria-label="Editar meta" onClick={() => setForm({ id: meta.id, nombre: meta.nombre, periodo: meta.periodo, objetivo: String(meta.objetivo), bono: String(meta.bono), franja: Boolean(meta.hora_desde), desde: meta.hora_desde?.slice(0, 5) ?? "20:00", hasta: meta.hora_hasta?.slice(0, 5) ?? "23:00", activa: meta.activa })}><Pencil className="h-4 w-4" /></Button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === "turnos" && (
        <>
          <form onSubmit={createShift} className="grid gap-3 rounded-3xl border bg-card p-4 sm:grid-cols-3 lg:grid-cols-6">
            <div className="space-y-1"><Label htmlFor="t-fecha">Día</Label><Input id="t-fecha" type="date" value={turno.fecha} min={argentinaDateKey()} onChange={(event) => setTurno({ ...turno, fecha: event.target.value })} required /></div>
            <div className="space-y-1"><Label htmlFor="t-desde">Desde</Label><Input id="t-desde" type="time" value={turno.desde} onChange={(event) => setTurno({ ...turno, desde: event.target.value })} required /></div>
            <div className="space-y-1"><Label htmlFor="t-hasta">Hasta</Label><Input id="t-hasta" type="time" value={turno.hasta} onChange={(event) => setTurno({ ...turno, hasta: event.target.value })} required /></div>
            <div className="space-y-1"><Label htmlFor="t-cupos">Lugares</Label><Input id="t-cupos" type="number" min={1} max={200} value={turno.cupos} onChange={(event) => setTurno({ ...turno, cupos: event.target.value })} required /></div>
            <div className="space-y-1"><Label htmlFor="t-rep">Repetir (días más)</Label><Input id="t-rep" type="number" min={0} max={30} value={turno.repetir} onChange={(event) => setTurno({ ...turno, repetir: event.target.value })} /></div>
            <div className="space-y-1"><Label htmlFor="t-nota">Nota</Label><Input id="t-nota" maxLength={100} value={turno.nota} placeholder="Ej.: hora pico" onChange={(event) => setTurno({ ...turno, nota: event.target.value })} /></div>
            <Button type="submit" className="rounded-full sm:col-span-3 lg:col-span-6 lg:w-fit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Publicar turnos</Button>
          </form>
          {shifts.length === 0 ? <EmptyState icon={<CalendarClock className="h-7 w-7" />} title="No hay turnos publicados" /> : (
            <div className="space-y-4">
              {[...byDay.entries()].map(([day, list]) => (
                <div key={day}>
                  <p className="mb-2 text-sm font-extrabold">{shiftDayLabel(day)} <span className="font-normal text-muted-foreground">· {day}</span></p>
                  <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
                    {list.map((shift) => (
                      <li key={shift.id} className={cn("p-3", !shift.activo && "opacity-60")}>
                        <div className="flex flex-wrap items-center gap-3">
                          <p className="font-extrabold tabular-nums">{shift.desde} a {shift.hasta}</p>
                          <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", shift.repartidores.length >= shift.cupos ? "bg-success/10 text-success" : "bg-muted")}>{shift.repartidores.length} de {shift.cupos} lugares</span>
                          {shift.nota && <span className="text-xs text-muted-foreground">{shift.nota}</span>}
                          {!shift.pasado && <label className="ml-auto flex items-center gap-2 text-xs font-semibold">Publicado<Switch checked={shift.activo} onCheckedChange={(checked) => toggleShift(shift, checked)} /></label>}
                        </div>
                        {shift.repartidores.length > 0 && (
                          <ul className="mt-2 flex flex-wrap gap-1.5">
                            {shift.repartidores.map((rider) => {
                              const pct = Math.min(100, Math.round((rider.minutos / Math.max(shift.duracion, 1)) * 100));
                              return <li key={rider.id} className={cn("rounded-full border px-2.5 py-0.5 text-xs font-semibold", shift.pasado && (pct >= 70 ? "border-success/40 bg-success/5" : "border-destructive/40 bg-destructive/5"))}>{rider.nombre || "Repartidor"}{shift.pasado && ` · ${pct}% conectado`}</li>;
                            })}
                          </ul>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      <Dialog open={Boolean(form)} onOpenChange={(open) => !open && !saving && setForm(null)}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-black">{form?.id ? "Editar meta" : "Nueva meta"}</DialogTitle>
          <DialogDescription>El bono se acredita una sola vez por período a cada repartidor que cumpla.</DialogDescription>
          {form && (
            <form onSubmit={saveGoal} className="space-y-3">
              <div className="space-y-1"><Label htmlFor="m-nombre">Nombre</Label><Input id="m-nombre" value={form.nombre} maxLength={60} required placeholder="Ej.: Semana productiva" onChange={(event) => setForm({ ...form, nombre: event.target.value })} /></div>
              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1"><Label htmlFor="m-periodo">Período</Label>
                  <select id="m-periodo" value={form.periodo} onChange={(event) => setForm({ ...form, periodo: event.target.value as Meta["periodo"] })} className="h-10 w-full rounded-md border bg-background px-2 text-sm"><option value="dia">Por día</option><option value="semana">Por semana</option></select></div>
                <div className="space-y-1"><Label htmlFor="m-obj">Entregas</Label><Input id="m-obj" type="number" min={1} max={500} value={form.objetivo} onChange={(event) => setForm({ ...form, objetivo: event.target.value })} required /></div>
                <div className="space-y-1"><Label htmlFor="m-bono">Bono ($)</Label><Input id="m-bono" type="number" min={50} max={100000} value={form.bono} onChange={(event) => setForm({ ...form, bono: event.target.value })} required /></div>
              </div>
              <label className="flex items-center justify-between gap-3 rounded-xl border p-3 text-sm font-bold">Solo cuentan las entregas de una franja horaria<Switch checked={form.franja} onCheckedChange={(checked) => setForm({ ...form, franja: checked })} /></label>
              {form.franja && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1"><Label htmlFor="m-desde">Desde</Label><Input id="m-desde" type="time" value={form.desde} onChange={(event) => setForm({ ...form, desde: event.target.value })} /></div>
                  <div className="space-y-1"><Label htmlFor="m-hasta">Hasta</Label><Input id="m-hasta" type="time" value={form.hasta} onChange={(event) => setForm({ ...form, hasta: event.target.value })} /></div>
                </div>
              )}
              <Button type="submit" className="w-full rounded-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar meta</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
