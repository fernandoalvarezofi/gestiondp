import { Check } from "lucide-react";
import { COLORES, PLANTILLAS, Plantilla } from "@/lib/storefront";
import { cn } from "@/lib/utils";

/** Dibujo esquemático de cada plantilla para elegirla de un vistazo. */
export function Wireframe({ id, color }: { id: Plantilla; color: string }) {
  const block = "bg-muted-foreground/25";
  const products = (radius: string, cols = 4) => (
    <div className={cn("mt-1.5 grid gap-1", cols === 2 ? "grid-cols-2" : "grid-cols-4")}>
      {Array.from({ length: 4 }, (_, n) => <div key={n} className={cn(block, cols === 2 ? "h-2.5" : "aspect-[4/5]", radius)} />)}
    </div>
  );
  return (
    <div className="aspect-[4/3] w-full overflow-hidden rounded-lg border bg-background p-1.5" aria-hidden>
      {id === "boutique" && <><div className="h-[46%] rounded-sm" style={{ background: `linear-gradient(90deg, ${color}, ${color}99)` }} /><div className="-mt-1.5 mx-2 grid grid-cols-4 gap-px rounded bg-border p-px">{[0, 1, 2, 3].map((n) => <div key={n} className="h-1.5 bg-card" />)}</div>{products("rounded-[2px]")}</>}
      {id === "galeria" && <><div className="mx-auto mt-0.5 h-1 w-1/3 bg-foreground/60" /><div className="mx-auto mt-1 h-px w-5" style={{ background: color }} /><div className={cn("mt-1.5 h-[30%]", block)} />{products("")}</>}
      {id === "impacto" && <><div className="flex h-[42%] items-center gap-1 rounded-xl p-1.5" style={{ background: color }}><div className="h-2.5 w-1/2 rounded bg-white/80" /><div className="ml-auto h-full w-1/3 rotate-3 rounded-lg bg-white/30" /></div>{products("rounded-md")}</>}
      {id === "gourmet" && <><div className="flex h-[42%] items-center gap-1.5 px-1"><div className="flex-1 space-y-1"><div className="h-1 w-1/3" style={{ background: color }} /><div className="h-1.5 w-4/5 bg-foreground/60" /></div><div className="h-full w-[28%] rounded-t-full rounded-b-sm" style={{ background: `${color}55` }} /></div>{products("rounded-[3px]", 2)}</>}
    </div>
  );
}

/** Las 4 plantillas para elegir, con su dibujo, para qué rubro sirve y una frase. */
export function TemplateGrid({ value, color, onChange }: { value: Plantilla; color: string; onChange: (id: Plantilla) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3" role="radiogroup" aria-label="Plantilla">
      {PLANTILLAS.map((item) => (
        <button key={item.id} type="button" role="radio" aria-checked={value === item.id} onClick={() => onChange(item.id)}
          className={cn("rounded-2xl border-2 p-2.5 text-left transition-colors", value === item.id ? "border-brand-orange bg-brand-orange/5" : "border-transparent bg-muted/40 hover:bg-muted")}>
          <Wireframe id={item.id} color={color} />
          <span className="mt-2 block text-sm font-bold">{item.nombre}</span>
          <span className="block text-[11px] font-semibold text-brand-orange">{item.ideal}</span>
          <span className="mt-0.5 block text-[11px] leading-tight text-muted-foreground">{item.detalle}</span>
        </button>
      ))}
    </div>
  );
}

/** Colores sugeridos más un selector libre. */
export function ColorSwatches({ value, onChange }: { value: string; onChange: (color: string) => void }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      {COLORES.map((color) => (
        <button key={color} type="button" aria-label={`Color ${color}`} aria-pressed={value === color} onClick={() => onChange(color)}
          className={cn("flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow ring-2 transition", value === color ? "ring-brand-orange" : "ring-transparent hover:ring-border")} style={{ background: color }}>
          {value === color && <Check className="h-4 w-4 text-white mix-blend-difference" />}
        </button>
      ))}
      <label className="ml-1 flex items-center gap-2 text-sm font-semibold">
        <input type="color" value={value} onChange={(event) => onChange(event.target.value.toUpperCase())} className="h-9 w-9 cursor-pointer rounded-full border-0 bg-transparent p-0" aria-label="Elegir otro color" />
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </label>
    </div>
  );
}
