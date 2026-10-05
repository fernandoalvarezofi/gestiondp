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
import { duracionTexto, Modalidad, MODALIDAD, Servicio } from "@/services/bookings";

type Draft = { id?: string; nombre: string; descripcion: string; duracion_min: string; precio: string; modalidad: Modalidad; anticipacion_horas: string; cancelar_hasta_horas: string; activo: boolean };
const VACIO: Draft = { nombre: "", descripcion: "", duracion_min: "30", precio: "", modalidad: "en_local", anticipacion_horas: "2", cancelar_hasta_horas: "12", activo: true };
const aDraft = (s: Servicio): Draft => ({ id: s.id, nombre: s.nombre, descripcion: s.descripcion ?? "", duracion_min: String(s.duracion_min), precio: String(s.precio), modalidad: s.modalidad, anticipacion_horas: String(s.anticipacion_horas), cancelar_hasta_horas: String(s.cancelar_hasta_horas), activo: s.activo });

/** Catálogo de servicios del local: nombre, duración, precio, modalidad y reglas de reserva/cancelación. */
export function ServicesTab({ storeId, servicios, onChange }: { storeId: string; servicios: Servicio[]; onChange: () => void }) {
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
    const payload = { comercio_id: storeId, nombre: draft.nombre.trim(), descripcion: draft.descripcion.trim() || null, duracion_min: duracion, precio, modalidad: draft.modalidad, anticipacion_horas: Math.max(0, Math.floor(Number(draft.anticipacion_horas) || 0)), cancelar_hasta_horas: Math.max(0, Math.floor(Number(draft.cancelar_hasta_horas) || 0)), activo: draft.activo };
    setSaving(true);
    const { error } = draft.id ? await db.from("servicios").update(payload).eq("id", draft.id) : await db.from("servicios").insert({ ...payload, orden: servicios.length + 1 });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(draft.id ? "Servicio actualizado" : "Servicio creado. Asignáselo a alguien del equipo para que se pueda reservar.");
    setDraft(null);
    onChange();
  };
  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => setDraft((d) => (d ? { ...d, [key]: value } : d));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">Lo que ofrecés. Para que se pueda reservar, cada servicio tiene que estar asignado a alguien del equipo con horarios cargados.</p>
        <Button className="shrink-0 rounded-full" onClick={() => setDraft(VACIO)}><Plus className="h-4 w-4" />Nuevo servicio</Button>
      </div>
      {servicios.length === 0 ? <EmptyState icon={<Clock3 className="h-7 w-7" />} title="Todavía no cargaste servicios" text="Por ejemplo: Corte de pelo (30 min), Consulta (45 min), Service del auto (2 h)." />
        : (
          <ul className="divide-y rounded-3xl border bg-card">
            {servicios.map((s) => (
              <li key={s.id} className={cn("flex flex-wrap items-center gap-3 p-4", !s.activo && "opacity-60")}>
                <div className="min-w-0 flex-1"><p className="font-extrabold">{s.nombre}{!s.activo && <span className="ml-2 text-xs font-bold text-muted-foreground">(oculto)</span>}</p><p className="text-sm text-muted-foreground">{duracionTexto(s.duracion_min)} · {MODALIDAD[s.modalidad]} · cancelación hasta {s.cancelar_hasta_horas} hs antes</p></div>
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
              <div className="space-y-1.5"><Label htmlFor="s-precio">Precio ($, 0 = a consultar)</Label><Input id="s-precio" type="number" min={0} value={draft.precio} onChange={(e) => set("precio", e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="s-mod">Modalidad</Label>
                <select id="s-mod" value={draft.modalidad} onChange={(e) => set("modalidad", e.target.value as Modalidad)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{(Object.keys(MODALIDAD) as Modalidad[]).map((m) => <option key={m} value={m}>{MODALIDAD[m]}</option>)}</select></div>
              <div className="space-y-1.5"><Label htmlFor="s-ant">Reservar con (hs de anticipación)</Label><Input id="s-ant" type="number" min={0} max={720} value={draft.anticipacion_horas} onChange={(e) => set("anticipacion_horas", e.target.value)} /></div>
              <div className="space-y-1.5"><Label htmlFor="s-can">Cancelar sin costo hasta (hs antes)</Label><Input id="s-can" type="number" min={0} max={720} value={draft.cancelar_hasta_horas} onChange={(e) => set("cancelar_hasta_horas", e.target.value)} /></div>
              <label className="flex items-center gap-2 text-sm font-semibold sm:col-span-2"><Switch checked={draft.activo} onCheckedChange={(v) => set("activo", v)} />Visible para reservar</label>
              <Button type="submit" className="rounded-full sm:col-span-2" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{draft.id ? "Guardar" : "Crear servicio"}</Button>
            </form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
