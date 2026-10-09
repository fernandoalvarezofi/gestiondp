import { FormEvent, useState } from "react";
import { Clock3, Loader2, Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { duracionTexto, Modalidad, MODALIDAD, Recurso, Servicio } from "@/services/bookings";

type Draft = {
  id?: string; nombre: string; descripcion: string; duracion_min: string; precio: string; modalidad: Modalidad; anticipacion_horas: string; cancelar_hasta_horas: string; activo: boolean;
  buffer_antes_min: string; buffer_despues_min: string; intervalo_min: string; reserva_max_dias: string; capacidad: string; requiere_confirmacion: boolean; recurso_id: string; color: string;
};
const INTERVALOS = [5, 10, 15, 20, 30, 45, 60, 90, 120];
const COLORES = ["", "#2B9778", "#2563EB", "#BE185D", "#B45309", "#7C3AED", "#0F766E", "#DC2626"];
const VACIO: Draft = {
  nombre: "", descripcion: "", duracion_min: "30", precio: "", modalidad: "en_local", anticipacion_horas: "2", cancelar_hasta_horas: "12", activo: true,
  buffer_antes_min: "0", buffer_despues_min: "0", intervalo_min: "15", reserva_max_dias: "60", capacidad: "1", requiere_confirmacion: false, recurso_id: "", color: "",
};
const aDraft = (s: Servicio): Draft => ({
  id: s.id, nombre: s.nombre, descripcion: s.descripcion ?? "", duracion_min: String(s.duracion_min), precio: String(s.precio), modalidad: s.modalidad,
  anticipacion_horas: String(s.anticipacion_horas), cancelar_hasta_horas: String(s.cancelar_hasta_horas), activo: s.activo,
  buffer_antes_min: String(s.buffer_antes_min ?? 0), buffer_despues_min: String(s.buffer_despues_min ?? 0), intervalo_min: String(s.intervalo_min ?? 15),
  reserva_max_dias: String(s.reserva_max_dias ?? 60), capacidad: String(s.capacidad ?? 1), requiere_confirmacion: Boolean(s.requiere_confirmacion), recurso_id: s.recurso_id ?? "", color: s.color ?? "",
});
/** Minutos redondeados de a 5, entre 0 y 120 (lo que acepta la base para preparación y limpieza). */
export const cincoMin = (v: string) => Math.min(120, Math.max(0, Math.round((Number(v) || 0) / 5) * 5));

/** Catálogo de servicios del local: duración, precio, modalidad, reglas de reserva y cancelación, y cómo ocupa la agenda. */
export function ServicesTab({ storeId, servicios, recursos, onChange }: { storeId: string; servicios: Servicio[]; recursos: Recurso[]; onChange: () => void }) {
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!draft) return;
    const duracion = Number(draft.duracion_min);
    const precio = Number(draft.precio || 0);
    if (draft.nombre.trim().length < 2) return toast.error("Escribí el nombre del servicio");
    if (!Number.isInteger(duracion) || duracion < 10 || duracion > 480 || duracion % 5 !== 0) return toast.error("La duración va de 10 a 480 minutos, de a 5");
    if (!(precio >= 0)) return toast.error("El precio no es válido");
    const payload = {
      comercio_id: storeId, nombre: draft.nombre.trim(), descripcion: draft.descripcion.trim() || null, duracion_min: duracion, precio, modalidad: draft.modalidad,
      anticipacion_horas: Math.max(0, Math.floor(Number(draft.anticipacion_horas) || 0)), cancelar_hasta_horas: Math.max(0, Math.floor(Number(draft.cancelar_hasta_horas) || 0)), activo: draft.activo,
      buffer_antes_min: cincoMin(draft.buffer_antes_min), buffer_despues_min: cincoMin(draft.buffer_despues_min), intervalo_min: Number(draft.intervalo_min) || 15,
      reserva_max_dias: Math.min(365, Math.max(1, Math.floor(Number(draft.reserva_max_dias) || 60))), capacidad: Math.min(100, Math.max(1, Math.floor(Number(draft.capacidad) || 1))),
      requiere_confirmacion: draft.requiere_confirmacion, recurso_id: draft.recurso_id || null, color: draft.color || null,
    };
    setSaving(true);
    const { error } = draft.id ? await db.from("servicios").update(payload).eq("id", draft.id) : await db.from("servicios").insert({ ...payload, orden: servicios.length + 1 });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(draft.id ? "Servicio actualizado" : "Servicio creado. Asignáselo a alguien del equipo para que se pueda reservar.");
    setDraft(null);
    onChange();
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));
  const detalle = (s: Servicio) => [
    duracionTexto(s.duracion_min), MODALIDAD[s.modalidad],
    (s.capacidad ?? 1) > 1 ? `grupal (${s.capacidad} por horario)` : null,
    s.requiere_confirmacion ? "confirmás vos" : null,
    s.recurso_id ? recursos.find((r) => r.id === s.recurso_id)?.nombre ?? "sala" : null,
    `cancelación hasta ${s.cancelar_hasta_horas} hs antes`,
  ].filter(Boolean).join(" · ");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Lo que ofrecés. Para que se pueda reservar, cada servicio tiene que estar asignado a alguien del equipo con horarios cargados.</p>
        <Button className="shrink-0 rounded-full" onClick={() => setDraft(VACIO)}><Plus className="h-4 w-4" />Nuevo servicio</Button>
      </div>
      {servicios.length === 0 ? <EmptyState icon={<Clock3 className="h-7 w-7" />} title="Todavía no cargaste servicios" text="Por ejemplo: Corte de pelo (30 min), Consulta (45 min), Clase grupal (1 h, 10 personas)." />
        : (
          <ul className="divide-y rounded-3xl border bg-card">
            {servicios.map((s) => (
              <li key={s.id} className={cn("flex flex-wrap items-center gap-3 p-4", !s.activo && "opacity-60")}>
                <span aria-hidden className="h-9 w-1.5 shrink-0 rounded-full" style={{ background: s.color || "hsl(var(--muted))" }} />
                <div className="min-w-0 flex-1"><p className="font-extrabold">{s.nombre}{!s.activo && <span className="ml-2 text-xs font-bold text-muted-foreground">(oculto)</span>}</p><p className="text-sm text-muted-foreground">{detalle(s)}</p></div>
                <span className="font-black tabular-nums">{s.precio > 0 ? money(s.precio) : "Consultar"}</span>
                <Button size="icon" variant="ghost" className="rounded-full" aria-label={`Editar ${s.nombre}`} onClick={() => setDraft(aDraft(s))}><Pencil className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      <Dialog open={Boolean(draft)} onOpenChange={(open) => !open && !saving && setDraft(null)}>
        <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto">
          <DialogTitle className="text-xl font-extrabold">{draft?.id ? "Editar servicio" : "Nuevo servicio"}</DialogTitle>
          {draft && (
            <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-nombre">Nombre</Label><Input id="s-nombre" required maxLength={80} value={draft.nombre} onChange={(e) => set("nombre", e.target.value)} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-desc">Descripción (opcional)</Label><Textarea id="s-desc" maxLength={500} value={draft.descripcion} onChange={(e) => set("descripcion", e.target.value)} className="min-h-[64px]" /></div>
              <div className="space-y-1.5"><Label htmlFor="s-dur">Duración (minutos)</Label><Input id="s-dur" type="number" min={10} max={480} step={5} value={draft.duracion_min} onChange={(e) => set("duracion_min", e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="s-precio">Precio por persona ($, 0 = a consultar)</Label><Input id="s-precio" type="number" min={0} value={draft.precio} onChange={(e) => set("precio", e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="s-mod">Modalidad</Label>
                <select id="s-mod" value={draft.modalidad} onChange={(e) => set("modalidad", e.target.value as Modalidad)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{(Object.keys(MODALIDAD) as Modalidad[]).map((m) => <option key={m} value={m}>{MODALIDAD[m]}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="s-ant">Reservar con (hs de anticipación)</Label><Input id="s-ant" type="number" min={0} max={720} value={draft.anticipacion_horas} onChange={(e) => set("anticipacion_horas", e.target.value)} /></div>
              <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-can">Cancelar o cambiar sin costo hasta (hs antes)</Label><Input id="s-can" type="number" min={0} max={720} value={draft.cancelar_hasta_horas} onChange={(e) => set("cancelar_hasta_horas", e.target.value)} /></div>
              <fieldset className="grid gap-4 rounded-2xl border p-3 sm:col-span-2 sm:grid-cols-2">
                <legend className="px-1 text-sm font-extrabold">Cómo ocupa la agenda</legend>
                <div className="space-y-1.5"><Label htmlFor="s-pre">Preparación antes (min)</Label><Input id="s-pre" type="number" min={0} max={120} step={5} value={draft.buffer_antes_min} onChange={(e) => set("buffer_antes_min", e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="s-post">Limpieza después (min)</Label><Input id="s-post" type="number" min={0} max={120} step={5} value={draft.buffer_despues_min} onChange={(e) => set("buffer_despues_min", e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="s-int">Ofrecer un horario cada</Label><select id="s-int" value={draft.intervalo_min} onChange={(e) => set("intervalo_min", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{INTERVALOS.map((m) => <option key={m} value={m}>{duracionTexto(m)}</option>)}</select></div>
                <div className="space-y-1.5"><Label htmlFor="s-max">Reservar hasta (días antes)</Label><Input id="s-max" type="number" min={1} max={365} value={draft.reserva_max_dias} onChange={(e) => set("reserva_max_dias", e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="s-cap">Personas por horario (1 = individual)</Label><Input id="s-cap" type="number" min={1} max={100} value={draft.capacidad} onChange={(e) => set("capacidad", e.target.value)} /></div>
                <div className="space-y-1.5"><Label htmlFor="s-rec">Sala o recurso que ocupa</Label>
                  <select id="s-rec" value={draft.recurso_id} onChange={(e) => set("recurso_id", e.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm"><option value="">Ninguno</option>{recursos.filter((r) => r.activo || r.id === draft.recurso_id).map((r) => <option key={r.id} value={r.id}>{r.nombre}</option>)}</select></div>
                <div className="space-y-1.5 sm:col-span-2"><span className="text-sm font-semibold">Color en la agenda</span>
                  <div className="flex flex-wrap gap-2">{COLORES.map((c) => <button key={c || "auto"} type="button" aria-label={c ? `Color ${c}` : "Color automático"} aria-pressed={draft.color === c} onClick={() => set("color", c)} className={cn("h-8 w-8 rounded-full border-2", draft.color === c ? "border-foreground" : "border-transparent")} style={{ background: c || "repeating-linear-gradient(45deg,#ddd 0 4px,#fff 4px 8px)" }} />)}</div></div>
                <label className="flex items-start gap-2 text-sm font-semibold sm:col-span-2"><Switch checked={draft.requiere_confirmacion} onCheckedChange={(v) => set("requiere_confirmacion", v)} />
                  <span>Confirmo cada turno a mano<span className="block text-xs font-normal text-muted-foreground">El turno queda “por confirmar” hasta que lo aceptes. Si no lo confirmás antes de la hora, se cancela solo y le avisamos a la persona.</span></span></label>
              </fieldset>
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><Switch checked={draft.activo} onCheckedChange={(v) => set("activo", v)} />Visible para reservar</label>
              <Button type="submit" className="rounded-full sm:col-span-2" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{draft.id ? "Guardar" : "Crear servicio"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
