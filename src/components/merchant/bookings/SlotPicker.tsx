import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import { fetchHorarios, horaLocal, hoyLocal, HorarioLibre, localAIso, Profesional, Servicio } from "@/services/bookings";

export type SlotValue = { servicio: string; profesional: string; fecha: string; hora: string };

/**
 * Elegir servicio, profesional, día y hora para un turno del panel. Muestra los horarios libres reales del día (los mismos
 * que ve el cliente) y permite escribir otra hora: el servidor decide si se puede (agenda, cierres, superposición).
 */
export function SlotPicker({ servicios, profesionales, value, onChange, fijarServicio }: {
  servicios: Servicio[]; profesionales: (Profesional & { servicios: string[] })[]; value: SlotValue; onChange: (v: SlotValue) => void; fijarServicio?: boolean;
}) {
  const [libres, setLibres] = useState<HorarioLibre[] | null>(null);
  const aptos = profesionales.filter((p) => p.activo && (!value.servicio || p.servicios.includes(value.servicio)));
  const set = (patch: Partial<SlotValue>) => onChange({ ...value, ...patch });

  useEffect(() => {
    if (!value.servicio || !value.profesional || !value.fecha) { setLibres(null); return; }
    let vivo = true;
    setLibres(null);
    fetchHorarios(value.servicio, value.profesional, value.fecha, 1)
      .then((dias) => { if (vivo) setLibres(dias.find((d) => d.fecha === value.fecha)?.horarios ?? []); })
      .catch(() => { if (vivo) setLibres([]); });
    return () => { vivo = false; };
  }, [value.servicio, value.profesional, value.fecha]);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="space-y-1.5">
        <Label htmlFor="sp-serv">Servicio</Label>
        <select id="sp-serv" disabled={fijarServicio} value={value.servicio} onChange={(e) => set({ servicio: e.target.value, profesional: "" })} className="h-10 w-full rounded-md border bg-background px-3 text-sm disabled:opacity-70">
          <option value="">Elegí un servicio</option>
          {servicios.filter((s) => s.activo || s.id === value.servicio).map((s) => <option key={s.id} value={s.id}>{s.nombre}</option>)}
        </select>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="sp-prof">Profesional</Label>
        <select id="sp-prof" value={value.profesional} onChange={(e) => set({ profesional: e.target.value })} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
          <option value="">Elegí quién atiende</option>
          {aptos.map((p) => <option key={p.id} value={p.id}>{p.nombre}</option>)}
        </select>
        {value.servicio && aptos.length === 0 && <p className="text-xs text-destructive">Nadie del equipo tiene asignado este servicio.</p>}
      </div>
      <div className="space-y-1.5"><Label htmlFor="sp-fecha">Día</Label><Input id="sp-fecha" type="date" min={hoyLocal()} value={value.fecha} onChange={(e) => set({ fecha: e.target.value })} /></div>
      <div className="space-y-1.5"><Label htmlFor="sp-hora">Hora</Label><Input id="sp-hora" type="time" step={300} value={value.hora} onChange={(e) => set({ hora: e.target.value })} /></div>
      {value.servicio && value.profesional && value.fecha && (
        <div className="sm:col-span-2">
          <p className="mb-1.5 text-xs font-bold text-muted-foreground">Horarios libres ese día</p>
          {!libres ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            : libres.length === 0 ? <p className="text-xs text-muted-foreground">No quedan horarios libres según la agenda. Podés escribir otra hora y el sistema verifica si entra.</p>
            : (
              <div className="flex max-h-32 flex-wrap gap-1.5 overflow-y-auto">
                {libres.map((h) => { const hora = horaLocal(h.inicio); return (
                  <button key={h.inicio} type="button" onClick={() => set({ hora })} className={cn("rounded-full border px-3 py-1 text-xs font-bold tabular-nums", value.hora === hora ? "border-primary bg-primary text-primary-foreground" : "bg-card hover:bg-muted")}>
                    {hora}{h.lugares != null && <span className="ml-1 font-normal opacity-80">· {h.lugares} lug.</span>}
                  </button>
                ); })}
              </div>
            )}
        </div>
      )}
    </div>
  );
}

/** ISO del turno elegido, o null si falta algo. */
export const slotIso = (v: SlotValue) => (v.fecha && /^\d{2}:\d{2}$/.test(v.hora) ? localAIso(`${v.fecha}T${v.hora}`) : null);
