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
      {id === "atelier" && <div className="flex h-full gap-1.5" style={{ background: "#FAF7F2" }}><div className="flex w-[38%] flex-col justify-center gap-1 pl-1"><div className="h-0.5 w-1/3 bg-foreground/50" /><div className="h-2 w-full bg-foreground/70" /><div className="h-2 w-3/4 bg-foreground/70" /><div className="mt-1 h-px w-1/2" style={{ background: color }} /></div><div className="flex-1 bg-muted-foreground/30" /></div>}
      {id === "urbano" && <div className="flex h-full flex-col justify-end gap-1 rounded-sm p-1.5" style={{ background: "#0A0A0B" }}><div className="h-1.5 w-1/4" style={{ background: color }} /><div className="h-3 w-4/5 bg-white/85" /><div className="h-3 w-1/2 bg-white/85" /><div className="mt-1 h-2 w-8" style={{ background: color }} /></div>}
      {id === "estudio" && <div className="flex h-full items-center gap-1.5 px-1" style={{ background: "#FBF7F4" }}><div className="flex flex-1 flex-col gap-1"><div className="h-1 w-1/3 rounded-full" style={{ background: color }} /><div className="h-2 w-full rounded-full bg-foreground/60" /><div className="h-2 w-2/3 rounded-full bg-foreground/60" /><div className="mt-1 h-2.5 w-1/2 rounded-full" style={{ background: color }} /></div><div className="relative h-[85%] w-[38%] rounded-full" style={{ background: `${color}55` }}><div className="absolute -left-2 bottom-2 h-3 w-8 rounded bg-card shadow" /></div></div>}
      {id === "taller" && <div className="relative h-full" style={{ background: "#F3ECE0" }}><div className="absolute left-1 top-2 space-y-1"><div className="h-2 w-12 bg-foreground/60" /><div className="h-2 w-9 bg-foreground/60" /><div className="h-1.5 w-6" style={{ background: color }} /></div><div className="absolute right-6 top-1.5 h-9 w-8 -rotate-6 bg-white p-0.5 pb-2 shadow"><div className="h-full bg-muted-foreground/30" /></div><div className="absolute right-1 top-4 h-9 w-8 rotate-6 bg-white p-0.5 pb-2 shadow"><div className="h-full" style={{ background: `${color}66` }} /></div></div>}
      {id === "mercado" && <><div className="grid h-[58%] grid-cols-3 gap-1"><div className="col-span-2 rounded-sm" style={{ background: color }} /><div className="grid gap-1"><div className="rounded-sm bg-muted-foreground/30" /><div className="rounded-sm bg-muted-foreground/20" /></div></div><div className="mt-1.5 grid grid-cols-5 gap-1">{Array.from({ length: 5 }, (_, n) => <div key={n} className="aspect-square rounded-sm bg-muted-foreground/25" />)}</div></>}
    </div>
  );
}

/** Las plantillas para elegir, con su dibujo, para qué rubro sirve y una frase. */
export function TemplateGrid({ value, color, onChange }: { value: Plantilla; color: string; onChange: (id: Plantilla) => void }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3" role="radiogroup" aria-label="Plantilla">
      {PLANTILLAS.map((item) => (
        <button key={item.id} type="button" role="radio" aria-checked={value === item.id} onClick={() => onChange(item.id)}
          className={cn("rounded-2xl border-2 p-2.5 text-left transition-colors", value === item.id ? "border-brand-yellow bg-brand-yellow/5" : "border-transparent bg-muted/40 hover:bg-muted")}>
          <Wireframe id={item.id} color={color} />
          <span className="mt-2 block text-sm font-bold">{item.nombre}</span>
          <span className="block text-[11px] font-semibold text-primary">{item.ideal}</span>
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
          className={cn("flex h-9 w-9 items-center justify-center rounded-full border-2 border-white shadow ring-2 transition", value === color ? "ring-brand-yellow" : "ring-transparent hover:ring-border")} style={{ background: color }}>
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
