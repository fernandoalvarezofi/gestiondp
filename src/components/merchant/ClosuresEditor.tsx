import { useState } from "react";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { argentinaDateKey, Cierre, getClosures, Horarios, withClosures } from "@/lib/delivery";

const formatDay = (key: string) => new Date(`${key}T12:00:00`).toLocaleDateString("es-AR", { day: "numeric", month: "short", year: "numeric" });

/** Cierres especiales (feriados, vacaciones, refacciones): ese día el local no recibe pedidos aunque esté en horario. */
export function ClosuresEditor({ value, onChange }: { value: Horarios; onChange: (value: Horarios) => void }) {
  const today = argentinaDateKey();
  const closures = getClosures(value).filter((item) => item.hasta >= today).sort((a, b) => a.desde.localeCompare(b.desde));
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [reason, setReason] = useState("");

  const add = () => {
    if (!from) return toast.error("Elegí desde qué día cerrás");
    const until = to || from;
    if (from < today) return toast.error("El cierre tiene que empezar hoy o más adelante");
    if (until < from) return toast.error("La fecha final no puede ser anterior a la inicial");
    const next: Cierre = { desde: from, hasta: until, ...(reason.trim() ? { motivo: reason.trim().slice(0, 60) } : {}) };
    onChange(withClosures(value, [...closures, next]));
    setFrom(""); setTo(""); setReason("");
  };

  return (
    <div className="mt-6">
      <h4 className="flex items-center gap-2 text-base font-extrabold"><CalendarOff className="h-5 w-5 text-primary" />Cierres especiales</h4>
      <p className="mb-3 text-sm text-muted-foreground">Cargá feriados, vacaciones o días de refacción. Esos días no se reciben pedidos (tampoco programados). Acordate de guardar los cambios.</p>
      {closures.length > 0 && (
        <ul className="mb-3 divide-y rounded-2xl border">
          {closures.map((item) => (
            <li key={`${item.desde}-${item.hasta}`} className="flex items-center gap-3 p-3">
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-bold">{item.desde === item.hasta ? formatDay(item.desde) : `${formatDay(item.desde)} al ${formatDay(item.hasta)}`}</span>
                {item.motivo && <span className="block text-xs text-muted-foreground">{item.motivo}</span>}
              </span>
              <Button type="button" size="icon" variant="ghost" aria-label="Quitar cierre" onClick={() => onChange(withClosures(value, closures.filter((other) => other !== item)))}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      <div className="grid gap-2 sm:grid-cols-[1fr_1fr_1.4fr_auto]">
        <Input type="date" value={from} min={today} onChange={(event) => setFrom(event.target.value)} aria-label="Desde" />
        <Input type="date" value={to} min={from || today} onChange={(event) => setTo(event.target.value)} aria-label="Hasta (opcional)" />
        <Input value={reason} maxLength={60} onChange={(event) => setReason(event.target.value)} placeholder="Motivo (ej.: Navidad)" aria-label="Motivo" />
        <Button type="button" variant="outline" className="rounded-full" onClick={add}><Plus className="h-4 w-4" />Agregar</Button>
      </div>
    </div>
  );
}
