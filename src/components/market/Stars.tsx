import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { promedioTexto } from "@/services/reviews";

/** Estrellas de solo lectura (promedio con decimales: cada estrella se llena según el puntaje). */
export function Stars({ value, size = 16, className }: { value: number; size?: number; className?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-0.5", className)} role="img" aria-label={`${promedioTexto(value)} de 5 estrellas`}>
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = Math.max(0, Math.min(1, value - (n - 1)));
        return (
          <span key={n} className="relative inline-block" style={{ width: size, height: size }}>
            <Star width={size} height={size} className="absolute inset-0 text-muted-foreground/40" strokeWidth={1.8} />
            <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}><Star width={size} height={size} className="fill-[#F5A524] text-[#F5A524]" strokeWidth={1.8} /></span>
          </span>
        );
      })}
    </span>
  );
}

/** Selector de puntaje (1 a 5) accesible con teclado. */
export function StarPicker({ value, onChange, label }: { value: number; onChange: (n: number) => void; label: string }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" role="radio" aria-checked={value === n} aria-label={`${n} ${n === 1 ? "estrella" : "estrellas"}`} onClick={() => onChange(n)} className="rounded p-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary">
          <Star className={cn("h-7 w-7 transition-colors", n <= value ? "fill-[#F5A524] text-[#F5A524]" : "text-muted-foreground/40")} strokeWidth={1.8} />
        </button>
      ))}
    </div>
  );
}
