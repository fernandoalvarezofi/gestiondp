import { FormEvent, useCallback, useEffect, useState } from "react";
import { Copy, Loader2, Pencil, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { Bloqueo, DIAS, hhmm, isoALocal, localAIso, Profesional, Servicio, Tramo, tramosValidos, eliminarDeAgenda } from "@/services/bookings";

type Prof = Profesional & { servicios: string[] };
const ORDEN_DIAS = [1, 2, 3, 4, 5, 6, 0];

/** Equipo que atiende: datos, qué servicios hace, horarios de la semana y bloqueos (vacaciones, trámites). */
export function TeamTab({ storeId, servicios, profesionales, onChange }: { storeId: string; servicios: Servicio[]; profesionales: Prof[]; onChange: () => void }) {
  const [edit, setEdit] = useState<Prof | "nuevo" | null>(null);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Las personas que atienden. Cada una tiene sus servicios y su agenda semanal.</p>
        <Button className="shrink-0 rounded-full" onClick={() => setEdit("nuevo")}><Plus className="h-4 w-4" />Sumar profesional</Button>
      </div>
      {profesionales.length === 0 ? <EmptyState icon={<UserRound className="h-7 w-7" />} title="Todavía no sumaste a nadie" text="Cargá a quien atiende (puede ser solo vos) para abrir la agenda." />
        : (
          <ul className="divide-y rounded-3xl border bg-card">
            {profesionales.map((p) => (
              <li key={p.id} className={cn("flex flex-wrap items-center gap-3 p-4", !p.activo && "opacity-60")}>
                <div className="min-w-0 flex-1"><p className="font-extrabold">{p.nombre}{!p.activo && <span className="ml-2 text-xs font-bold text-muted-foreground">(inactivo)</span>}</p>
                  <p className="text-sm text-muted-foreground">{p.servicios.length === 0 ? "Sin servicios asignados" : servicios.filter((s) => p.servicios.includes(s.id)).map((s) => s.nombre).join(", ")}</p></div>
                <Button size="icon" variant="ghost" className="rounded-full" aria-label={`Editar ${p.nombre}`} onClick={() => setEdit(p)}><Pencil className="h-4 w-4" /></Button>
                <Button size="icon" variant="ghost" className="rounded-full text-destructive hover:bg-destructive/10 hover:text-destructive" aria-label={`Eliminar ${p.nombre}`} onClick={async () => { if (await eliminarDeAgenda("profesional", p)) onChange(); }}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      {edit && <ProfEditor storeId={storeId} servicios={servicios} prof={edit === "nuevo" ? null : edit} onClose={() => setEdit(null)} onSaved={() => { onChange(); }} />}
    </div>
  );
}

function ProfEditor({ storeId, servicios, prof, onClose, onSaved }: { storeId: string; servicios: Servicio[]; prof: Prof | null; onClose: () => void; onSaved: () => void }) {
  const [id, setId] = useState<string | null>(prof?.id ?? null);
  const [nombre, setNombre] = useState(prof?.nombre ?? "");
  const [bio, setBio] = useState(prof?.bio ?? "");
  const [activo, setActivo] = useState(prof?.activo ?? true);
  const [mis, setMis] = useState<string[]>(prof?.servicios ?? []);
  const [tramos, setTramos] = useState<Tramo[] | null>(id ? null : []);
  const [bloqueos, setBloqueos] = useState<Bloqueo[]>([]);
  const [saving, setSaving] = useState(false);
  const [nb, setNb] = useState({ desde: "", hasta: "", motivo: "" });

  const loadAgenda = useCallback(async () => {
    if (!id) return;
    const [{ data: d }, { data: b }] = await Promise.all([
      db.from("disponibilidad").select("id, dia_semana, desde, hasta").eq("profesional_id", id),
      db.from("bloqueos").select("*").eq("profesional_id", id).gte("hasta", new Date().toISOString()).order("desde"),
    ]);
    setTramos(((d ?? []) as Tramo[]).map((t) => ({ ...t, desde: hhmm(t.desde), hasta: hhmm(t.hasta) })));
    setBloqueos((b ?? []) as Bloqueo[]);
  }, [id]);
  useEffect(() => { loadAgenda(); }, [loadAgenda]);

  const saveData = async (event: FormEvent) => {
    event.preventDefault();
    if (nombre.trim().length < 2) return toast.error("Escribí el nombre");
    setSaving(true);
    const payload = { comercio_id: storeId, nombre: nombre.trim(), bio: bio.trim() || null, activo };
    const { data, error } = id ? await db.from("profesionales").update(payload).eq("id", id).select("id").single() : await db.from("profesionales").insert(payload).select("id").single();
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    if (!id) { setId(data.id); setTramos([]); toast.success("Profesional creado. Ahora asignale servicios y horarios."); } else toast.success("Datos guardados");
    onSaved();
  };
  const saveServicios = async () => {
    if (!id) return;
    const { error } = await db.rpc("profesional_servicios_guardar", { p_profesional: id, p_servicios: mis });
    if (error) return toast.error(errorMessage(error));
    toast.success("Servicios guardados"); onSaved();
  };
  const saveAgenda = async () => {
    if (!id || !tramos) return;
    const problema = tramosValidos(tramos);
    if (problema) return toast.error(problema);
    const { error } = await db.rpc("profesional_agenda_guardar", { p_profesional: id, p_tramos: tramos.map((t) => ({ dia_semana: t.dia_semana, desde: t.desde, hasta: t.hasta })) });
    if (error) return toast.error(errorMessage(error));
    toast.success("Horarios guardados"); onSaved();
  };
  const addBloqueo = async () => {
    if (!id || !nb.desde || !nb.hasta) return toast.error("Elegí desde y hasta cuándo");
    const { error } = await db.from("bloqueos").insert({ profesional_id: id, desde: localAIso(nb.desde), hasta: localAIso(nb.hasta), motivo: nb.motivo.trim() || null });
    if (error) return toast.error(errorMessage(error));
    setNb({ desde: "", hasta: "", motivo: "" }); toast.success("Bloqueo agregado"); loadAgenda();
  };
  const delBloqueo = async (b: Bloqueo) => { const { error } = await db.from("bloqueos").delete().eq("id", b.id); if (error) return toast.error(errorMessage(error)); loadAgenda(); };

  const setTramo = (idx: number, cambio: Partial<Tramo>) => setTramos((t) => (t ? t.map((x, i) => (i === idx ? { ...x, ...cambio } : x)) : t));
  const copiarLunes = () => setTramos((t) => { if (!t) return t; const lunes = t.filter((x) => x.dia_semana === 1); return [...t.filter((x) => x.dia_semana === 0 || x.dia_semana === 1 || x.dia_semana === 6), ...[2, 3, 4, 5].flatMap((d) => lunes.map((x) => ({ dia_semana: d, desde: x.desde, hasta: x.hasta }))) ]; });

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-2xl overflow-y-auto">
        <DialogTitle className="text-xl font-extrabold">{prof ? `Equipo · ${prof.nombre}` : id ? nombre : "Sumar profesional"}</DialogTitle>
        <form onSubmit={saveData} className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="p-nombre">Nombre</Label><Input id="p-nombre" required maxLength={80} value={nombre} onChange={(e) => setNombre(e.target.value)} /></div>
          <div className="space-y-1.5"><Label htmlFor="p-bio">Presentación (opcional)</Label><Input id="p-bio" maxLength={300} value={bio} onChange={(e) => setBio(e.target.value)} /></div>
          <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={activo} onCheckedChange={setActivo} />Atiende (visible para reservar)</label>
          <Button type="submit" className="rounded-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{id ? "Guardar datos" : "Crear"}</Button>
        </form>

        {id && (
          <>
            <section className="space-y-2 border-t pt-4" aria-label="Servicios del profesional">
              <h3 className="font-extrabold">Servicios que hace</h3>
              {servicios.length === 0 ? <p className="text-sm text-muted-foreground">Primero cargá servicios en la pestaña “Servicios”.</p> : (
                <div className="flex flex-wrap gap-2">
                  {servicios.map((s) => <button key={s.id} type="button" aria-pressed={mis.includes(s.id)} onClick={() => setMis((m) => (m.includes(s.id) ? m.filter((x) => x !== s.id) : [...m, s.id]))} className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", mis.includes(s.id) ? "border-primary bg-primary/10 text-primary" : "hover:bg-muted")}>{s.nombre}</button>)}
                </div>
              )}
              <Button size="sm" variant="outline" className="rounded-full" onClick={saveServicios}>Guardar servicios</Button>
            </section>

            <section className="space-y-2 border-t pt-4" aria-label="Horarios de la semana">
              <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="font-extrabold">Horarios de la semana</h3><Button size="sm" variant="ghost" className="rounded-full" onClick={copiarLunes}><Copy className="h-4 w-4" />Copiar el lunes a martes–viernes</Button></div>
              {!tramos ? <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
                <ul className="space-y-2">
                  {ORDEN_DIAS.map((dia) => {
                    const delDia = tramos.map((t, i) => ({ t, i })).filter(({ t }) => t.dia_semana === dia);
                    return (
                      <li key={dia} className="flex flex-wrap items-center gap-2 rounded-2xl border p-2.5">
                        <span className="w-24 text-sm font-bold">{DIAS[dia]}</span>
                        {delDia.length === 0 && <span className="text-sm text-muted-foreground">No atiende</span>}
                        {delDia.map(({ t, i }) => (
                          <span key={i} className="flex items-center gap-1">
                            <input type="time" aria-label={`${DIAS[dia]} desde`} value={t.desde} onChange={(e) => setTramo(i, { desde: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm" />
                            <span>–</span>
                            <input type="time" aria-label={`${DIAS[dia]} hasta`} value={t.hasta} onChange={(e) => setTramo(i, { hasta: e.target.value })} className="h-9 rounded-md border bg-background px-2 text-sm" />
                            <button type="button" aria-label={`Quitar tramo del ${DIAS[dia]}`} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted" onClick={() => setTramos((x) => (x ? x.filter((_, k) => k !== i) : x))}><Trash2 className="h-4 w-4" /></button>
                          </span>
                        ))}
                        <button type="button" className="ml-auto flex items-center gap-1 text-sm font-bold text-primary" onClick={() => setTramos((x) => [...(x ?? []), { dia_semana: dia, desde: "09:00", hasta: "13:00" }])}><Plus className="h-4 w-4" />Tramo</button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Button size="sm" className="rounded-full" onClick={saveAgenda}>Guardar horarios</Button>
            </section>

            <section className="space-y-2 border-t pt-4" aria-label="Bloqueos">
              <h3 className="font-extrabold">Bloqueos (vacaciones, trámites)</h3>
              {bloqueos.length > 0 && <ul className="divide-y rounded-2xl border">{bloqueos.map((b) => <li key={b.id} className="flex items-center gap-2 p-2.5 text-sm"><span className="min-w-0 flex-1">{formatDateTime(b.desde)} → {formatDateTime(b.hasta)}{b.motivo && <span className="text-muted-foreground"> · {b.motivo}</span>}</span><button type="button" aria-label="Quitar bloqueo" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-muted" onClick={() => delBloqueo(b)}><Trash2 className="h-4 w-4" /></button></li>)}</ul>}
              <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1fr_auto]">
                <input type="datetime-local" aria-label="Bloqueo desde" value={nb.desde} min={isoALocal(new Date().toISOString())} onChange={(e) => setNb({ ...nb, desde: e.target.value })} className="h-10 rounded-md border bg-background px-2 text-sm" />
                <input type="datetime-local" aria-label="Bloqueo hasta" value={nb.hasta} min={nb.desde || undefined} onChange={(e) => setNb({ ...nb, hasta: e.target.value })} className="h-10 rounded-md border bg-background px-2 text-sm" />
                <Input aria-label="Motivo del bloqueo" placeholder="Motivo (opcional)" maxLength={120} value={nb.motivo} onChange={(e) => setNb({ ...nb, motivo: e.target.value })} />
                <Button variant="outline" className="rounded-full" onClick={addBloqueo}>Bloquear</Button>
              </div>
            </section>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
