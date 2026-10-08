import { ReactNode, useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

export function Campo({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Texto({ label, value, onChange, max, placeholder, multiline, hint }: { label: string; value?: string; onChange: (value: string) => void; max: number; placeholder?: string; multiline?: boolean; hint?: string }) {
  const id = useId();
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="text-sm font-semibold">{label}</Label>
      {multiline
        ? <Textarea id={id} value={value ?? ""} maxLength={max} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} className="min-h-[88px]" />
        : <Input id={id} value={value ?? ""} maxLength={max} placeholder={placeholder} onChange={(event) => onChange(event.target.value)} />}
      <p className="flex justify-between text-xs text-muted-foreground"><span>{hint}</span>{multiline && <span>{(value ?? "").length}/{max}</span>}</p>
    </div>
  );
}

/** Botones de opción excluyentes (más rápidos y claros que un desplegable). */
export function Opciones<T extends string | number | boolean>({ label, value, options, onChange, hint }: { label: string; value: T; options: { id: T; label: ReactNode }[]; onChange: (value: T) => void; hint?: string }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-sm font-semibold">{label}</Label>
      <div className="flex flex-wrap gap-1.5" role="radiogroup" aria-label={label}>
        {options.map((option) => (
          <button key={String(option.id)} type="button" role="radio" aria-checked={value === option.id} onClick={() => onChange(option.id)}
            className={cn("rounded-full border-2 px-3 py-1.5 text-sm font-semibold transition-colors", value === option.id ? "border-brand-yellow bg-brand-yellow/10" : "border-transparent bg-muted/60 hover:bg-muted")}>{option.label}</button>
        ))}
      </div>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function Interruptor({ label, hint, value, onChange }: { label: string; hint?: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-xl border p-3">
      <span><span className="block text-sm font-semibold">{label}</span>{hint && <span className="block text-xs text-muted-foreground">{hint}</span>}</span>
      <Switch checked={value} onCheckedChange={onChange} />
    </label>
  );
}

export function Numero({ label, value, min, max, onChange }: { label: string; value: number; min: number; max: number; onChange: (value: number) => void }) {
  return (
    <div className="space-y-1.5">
      <Label className="flex justify-between text-sm font-semibold"><span>{label}</span><span className="font-normal text-muted-foreground">{value}</span></Label>
      <input type="range" min={min} max={max} value={value} onChange={(event) => onChange(Number(event.target.value))} className="w-full accent-[hsl(var(--brand-yellow))]" aria-label={label} />
    </div>
  );
}
