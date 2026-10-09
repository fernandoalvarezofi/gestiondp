import { FormEvent, useCallback, useEffect, useState } from "react";
import { CalendarOff, DoorOpen, Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { db, errorMessage } from "@/lib/delivery";
import { AjustesAgenda, Cierre, fetchAjustesAgenda, hoyLocal, Recurso } from "@/services/bookings";

const fechaCorta = (d: string) => `${Number(d.slice(8))}/${Number(d.slice(5, 7))}/${d.slice(0, 4)}`;

/** Salas y recursos, cierres del local (feriados, vacaciones) y reglas de la agenda (recordatorios, reprogramación, lista de espera). */
export function AgendaSettingsTab({ storeId, recursos, onChange }: { storeId: string; recursos: Recurso[]; onChange: () => void }) {
  const [cierres, setCierres] = useState<Cierre[] | null>(null);
  const [ajustes, setAjustes] = useState<AjustesAgenda | null>(null);
  const [nuevoRecurso, setNuevoRecurso] = useState("");
  const [cierre, setCierre] = useState({ desde: hoyLocal(), hasta: hoyLocal(), motivo: "" });
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    const [{ data }, a] = await Promise.all([
      db.from("agenda_cierres").select("*").eq("comercio_id", storeId).gte("hasta", hoyLocal()).order("desde"),
      fetchAjustesAgenda(storeId),
    ]);
    setCierres((data ?? []) as Cierre[]);
    setAjustes(a);
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const run = async (fn: () => PromiseLike<{ error: unknown }>, ok: string, recargarRecursos = false) => {
    setBusy(true);
    const { error } = await fn();
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return false; }
    toast.success(ok);
    if (recargarRecursos) onChange(); else load();
    return true;
  };
  const agregarRecurso = async (e: FormEvent) => {
    e.preventDefault();
    if (nuevoRecurso.trim().length < 2) return toast.error("Escribí el nombre (por ejemplo, Sala 1 o Camilla)");
    if (await run(() => db.from("recursos").insert({ comercio_id: storeId, nombre: nuevoRecurso.trim(), orden: recursos.length }), "Sala agregada", true)) setNuevoRecurso("");
  };
  const agregarCierre = async (e: FormEvent) => {
    e.preventDefault();
    if (!cierre.desde || !cierre.hasta || cierre.hasta < cierre.desde) return toast.error("Revisá las fechas: la de fin no puede ser anterior a la de inicio");
    if (await run(() => db.from("agenda_cierres").insert({ comercio_id: storeId, desde: cierre.desde, hasta: cierre.hasta, motivo: cierre.motivo.trim() || null }), "Cierre agregado: esos días no se ofrecen turnos")) setCierre({ desde: hoyLocal(), hasta: hoyLocal(), motivo: "" });
  };
  const guardarAjustes = async (cambio: Partial<AjustesAgenda>) => {
    if (!ajustes) return;
    const next = { ...ajustes, ...cambio };
    setAjustes(next);
    await run(() => db.from("agenda_ajustes").upsert({ ...next, updated_at: new Date().toISOString() }, { onConflict: "comercio_id" }), "Ajustes guardados");
  };

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <section className="rounded-3xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-extrabold"><CalendarOff className="h-5 w-5 text-primary" />Feriados, vacaciones y cierres</h3>
        <p className="mt-1 text-sm text-muted-foreground">Esos días no se ofrece ningún turno. Para la ausencia de una sola persona usá sus bloqueos en Equipo.</p>
        <form onSubmit={agregarCierre} className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="c-desde">Desde</Label><Input id="c-desde" type="date" min={hoyLocal()} value={cierre.desde} onChange={(e) => setCierre({ ...cierre, desde: e.target.value, hasta: e.target.value > cierre.hasta ? e.target.value : cierre.hasta })} /></div>
          <div className="space-y-1.5"><Label htmlFor="c-hasta">Hasta</Label><Input id="c-hasta" type="date" min={cierre.desde} value={cierre.hasta} onChange={(e) => setCierre({ ...cierre, hasta: e.target.value })} /></div>
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="c-mot">Motivo (opcional)</Label><Input id="c-mot" maxLength={120} placeholder="Feriado, vacaciones, inventario…" value={cierre.motivo} onChange={(e) => setCierre({ ...cierre, motivo: e.target.value })} /></div>
          <Button type="submit" className="rounded-full sm:col-span-2" disabled={busy}><Plus className="h-4 w-4" />Agregar cierre</Button>
        </form>
        {!cierres ? <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" /> : cierres.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">No hay cierres próximos.</p> : (
          <ul className="mt-4 divide-y rounded-2xl border">
            {cierres.map((c) => (
              <li key={c.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span><span className="font-bold">{c.desde === c.hasta ? fechaCorta(c.desde) : `${fechaCorta(c.desde)} al ${fechaCorta(c.hasta)}`}</span>{c.motivo && <span className="text-muted-foreground"> · {c.motivo}</span>}</span>
                <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive" aria-label="Quitar cierre" disabled={busy} onClick={() => run(() => db.from("agenda_cierres").delete().eq("id", c.id), "Cierre quitado")}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border bg-card p-5">
        <h3 className="flex items-center gap-2 font-extrabold"><DoorOpen className="h-5 w-5 text-primary" />Salas y recursos</h3>
        <p className="mt-1 text-sm text-muted-foreground">Boxes, camillas, salas o canchas. Si un servicio usa una sala, dos turnos no pueden ocuparla a la vez aunque los atiendan personas distintas.</p>
        <form onSubmit={agregarRecurso} className="mt-4 flex gap-2"><Input aria-label="Nombre de la sala" maxLength={60} placeholder="Ej.: Sala 1" value={nuevoRecurso} onChange={(e) => setNuevoRecurso(e.target.value)} /><Button type="submit" className="shrink-0 rounded-full" disabled={busy}><Plus className="h-4 w-4" />Agregar</Button></form>
        {recursos.length === 0 ? <p className="mt-4 text-sm text-muted-foreground">Sin salas cargadas.</p> : (
          <ul className="mt-4 divide-y rounded-2xl border">
            {recursos.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 p-3 text-sm">
                <span className="font-bold">{r.nombre}{!r.activo && <span className="ml-1 font-normal text-muted-foreground">(inactiva)</span>}</span>
                <span className="flex items-center gap-2">
                  <Switch checked={r.activo} aria-label={`Activa ${r.nombre}`} onCheckedChange={(v) => run(() => db.from("recursos").update({ activo: v }).eq("id", r.id), v ? "Sala activada" : "Sala desactivada", true)} />
                  <Button size="icon" variant="ghost" className="h-8 w-8 rounded-full text-destructive" aria-label={`Eliminar ${r.nombre}`} disabled={busy} onClick={() => window.confirm(`¿Eliminar ${r.nombre}? Los servicios que la usaban quedan sin sala.`) && run(() => db.from("recursos").delete().eq("id", r.id), "Sala eliminada", true)}><Trash2 className="h-4 w-4" /></Button>
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="rounded-3xl border bg-card p-5 lg:col-span-2">
        <h3 className="font-extrabold">Avisos y reglas para tus clientes</h3>
        {!ajustes ? <Loader2 className="mt-4 h-5 w-5 animate-spin text-muted-foreground" /> : (
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <label className="flex items-start gap-3 text-sm font-semibold"><Switch checked={ajustes.recordatorio_24h} onCheckedChange={(v) => guardarAjustes({ recordatorio_24h: v })} /><span>Recordatorio el día anterior<span className="block text-xs font-normal text-muted-foreground">Notificación y push 24 h antes.</span></span></label>
            <label className="flex items-start gap-3 text-sm font-semibold"><Switch checked={ajustes.recordatorio_2h} onCheckedChange={(v) => guardarAjustes({ recordatorio_2h: v })} /><span>Recordatorio 2 horas antes</span></label>
            <label className="flex items-start gap-3 text-sm font-semibold"><Switch checked={ajustes.cliente_reprograma} onCheckedChange={(v) => guardarAjustes({ cliente_reprograma: v })} /><span>El cliente puede cambiar el horario desde la app<span className="block text-xs font-normal text-muted-foreground">Respeta el plazo de cancelación de cada servicio.</span></span></label>
            <div className="space-y-1.5"><Label htmlFor="aj-max">Cambios de horario permitidos por turno</Label><Input id="aj-max" type="number" min={0} max={10} value={ajustes.max_reprogramaciones} onChange={(e) => setAjustes({ ...ajustes, max_reprogramaciones: Math.max(0, Math.min(10, Number(e.target.value) || 0)) })} onBlur={() => guardarAjustes({})} /></div>
            <label className="flex items-start gap-3 text-sm font-semibold"><Switch checked={ajustes.lista_espera} onCheckedChange={(v) => guardarAjustes({ lista_espera: v })} /><span>Lista de espera<span className="block text-xs font-normal text-muted-foreground">Si un día está completo, la persona se anota y le avisamos apenas se libere un horario.</span></span></label>
          </div>
        )}
        <p className="mt-4 rounded-2xl bg-muted p-3 text-xs text-muted-foreground">Señas y pagos anticipados: se habilitan cuando Mercado Pago esté configurado en tu cuenta. Por ahora los turnos se cobran en el local.</p>
      </section>
    </div>
  );
}
