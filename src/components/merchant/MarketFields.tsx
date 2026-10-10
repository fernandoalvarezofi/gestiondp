import { Plus, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { AtributoFila, MAX_ATRIBUTOS, useCategorias } from "@/services/categories";

export type MarketValues = { categoria_id: string; marca: string; atributos: AtributoFila[]; en_market: boolean; en_tienda: boolean };

/** Datos para el marketplace de un producto: categoría, marca, atributos (talle, color…) y dónde se muestra (Market, Tienda o los dos). */
export function MarketFields({ values, onChange, sinCanales }: { values: MarketValues; onChange: (next: MarketValues) => void; /** Los canales se eligen en otro lado (editor de producto). */ sinCanales?: boolean }) {
  const { arbol } = useCategorias();
  const set = <K extends keyof MarketValues>(key: K, value: MarketValues[K]) => onChange({ ...values, [key]: value });
  const setFila = (index: number, patch: Partial<AtributoFila>) => set("atributos", values.atributos.map((f, i) => (i === index ? { ...f, ...patch } : f)));

  return (
    <fieldset className={sinCanales ? "space-y-4 rounded-xl border bg-card p-4 sm:p-5" : "space-y-4 rounded-2xl border p-4 sm:col-span-2"}>
      <legend className={sinCanales ? "float-left mb-4 w-full text-[15px] font-extrabold" : "px-1 text-sm font-extrabold"}>Marketplace</legend>
      <div className={sinCanales ? "grid gap-4" : "grid gap-4 sm:grid-cols-2"}>
        <div className="space-y-1.5">
          <Label htmlFor="p-categoria">Categoría</Label>
          <select id="p-categoria" value={values.categoria_id} onChange={(event) => set("categoria_id", event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
            <option value="">Sin categoría</option>
            {arbol.map((raiz) => (
              <optgroup key={raiz.id} label={raiz.nombre}>
                {raiz.hijas.length === 0 && <option value={raiz.id}>{raiz.nombre}</option>}
                {raiz.hijas.map((hija) => <option key={hija.id} value={hija.id}>{hija.nombre}</option>)}
              </optgroup>
            ))}
          </select>
          <p className="text-xs text-muted-foreground">Ayuda a que lo encuentren en el buscador y los filtros.</p>
        </div>
        <div className="space-y-1.5"><Label htmlFor="p-marca">Marca</Label><Input id="p-marca" maxLength={60} value={values.marca} onChange={(event) => set("marca", event.target.value)} /></div>
      </div>

      <div className="space-y-2">
        <p className="text-sm font-semibold">Características <span className="font-normal text-muted-foreground">(opcional, hasta {MAX_ATRIBUTOS}: color, material, talle…)</span></p>
        {values.atributos.map((fila, index) => (
          <div key={index} className="flex items-center gap-2">
            <Input aria-label={`Característica ${index + 1}`} placeholder="Ej.: Color" maxLength={30} value={fila.clave} onChange={(event) => setFila(index, { clave: event.target.value })} />
            <Input aria-label={`Valor ${index + 1}`} placeholder="Ej.: Rojo" maxLength={60} value={fila.valor} onChange={(event) => setFila(index, { valor: event.target.value })} />
            <button type="button" aria-label={`Quitar característica ${index + 1}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full hover:bg-muted" onClick={() => set("atributos", values.atributos.filter((_, i) => i !== index))}><X className="h-4 w-4" /></button>
          </div>
        ))}
        {values.atributos.length < MAX_ATRIBUTOS && <button type="button" className="flex items-center gap-1 text-sm font-bold text-primary" onClick={() => set("atributos", [...values.atributos, { clave: "", valor: "" }])}><Plus className="h-4 w-4" />Agregar característica</button>}
      </div>

      {!sinCanales && <div className="space-y-2">
        <p className="text-sm font-semibold">¿Dónde se muestra?</p>
        <div className="flex flex-col gap-3 sm:flex-row sm:gap-6">
          <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={values.en_market} onCheckedChange={(checked) => set("en_market", checked || !values.en_tienda)} />En el marketplace de Woref</label>
          <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={values.en_tienda} onCheckedChange={(checked) => set("en_tienda", checked || !values.en_market)} />En mi tienda online</label>
        </div>
        <p className="text-xs text-muted-foreground">Tiene que estar al menos en uno. Para ocultarlo de todos lados, usá “Disponible”.</p>
      </div>}
    </fieldset>
  );
}
