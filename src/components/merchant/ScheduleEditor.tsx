import { Copy, Plus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { diasSemana, getClosures, Horarios, scheduleSummary, withClosures } from "@/lib/delivery";

const order = [1, 2, 3, 4, 5, 6, 0];

/** Editor de horarios por día: abierto/cerrado, hasta dos turnos (ej. mediodía y noche) y "copiar a todos". */
export function ScheduleEditor({ value, onChange }: { value: Horarios; onChange: (value: Horarios) => void }) {
  const setDay = (day: number, turnos: Horarios[string]) => onChange({ ...value, [String(day)]: turnos });
  const copyToAll = (day: number) => onChange(withClosures(Object.fromEntries([0, 1, 2, 3, 4, 5, 6].map((target) => [String(target), (value[String(day)] || []).map((turno) => ({ ...turno }))])), getClosures(value)));

  return (
    <div className="space-y-2">
      {order.map((day) => {
        const turnos = value[String(day)] || [];
        const open = turnos.length > 0;
        return (
          <div key={day} className="flex flex-wrap items-center gap-3 rounded-xl border p-3">
            <label className="flex w-36 items-center gap-2 text-sm font-bold">
              <Switch checked={open} onCheckedChange={(checked) => setDay(day, checked ? [{ abre: "10:00", cierra: "23:00" }] : [])} aria-label={`Abierto los ${diasSemana[day]}`} />
              {diasSemana[day]}
            </label>
            {open ? (
              <div className="flex flex-1 flex-wrap items-center gap-2">
                {turnos.map((turno, index) => (
                  <div key={index} className="flex items-center gap-1.5 rounded-lg bg-muted px-2 py-1">
                    <input type="time" value={turno.abre} onChange={(event) => setDay(day, turnos.map((item, i) => (i === index ? { ...item, abre: event.target.value } : item)))} className="bg-transparent text-sm tabular-nums outline-none" aria-label="Abre" />
                    <span className="text-muted-foreground">a</span>
                    <input type="time" value={turno.cierra} onChange={(event) => setDay(day, turnos.map((item, i) => (i === index ? { ...item, cierra: event.target.value } : item)))} className="bg-transparent text-sm tabular-nums outline-none" aria-label="Cierra" />
                    {turnos.length > 1 && <button type="button" aria-label="Quitar turno" onClick={() => setDay(day, turnos.filter((_, i) => i !== index))}><X className="h-3.5 w-3.5" /></button>}
                  </div>
                ))}
                {turnos.length < 2 && <Button type="button" size="sm" variant="ghost" onClick={() => setDay(day, [...turnos, { abre: "20:00", cierra: "23:59" }])}><Plus className="h-3.5 w-3.5" />Turno</Button>}
                <Button type="button" size="sm" variant="ghost" className="ml-auto" onClick={() => copyToAll(day)}><Copy className="h-3.5 w-3.5" />Copiar a todos</Button>
              </div>
            ) : <span className="text-sm text-muted-foreground">Cerrado</span>}
          </div>
        );
      })}
      <p className="text-xs text-muted-foreground">Resumen: {scheduleSummary(value)}. Si un turno cierra después de medianoche (ej. 20:00 a 02:00), se respeta igual.</p>
    </div>
  );
}
