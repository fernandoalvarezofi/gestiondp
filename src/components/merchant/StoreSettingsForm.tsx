import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Categoria, categoriaLabel, DeliveryStore, img } from "@/lib/delivery";

export type StoreFormValues = Pick<DeliveryStore,
  "nombre" | "categoria" | "rubro" | "descripcion" | "direccion" | "telefono" | "horario" | "imagen_url" | "logo_url" |
  "tiempo_min" | "tiempo_max" | "costo_envio" | "pedido_minimo" | "envio_gratis_desde" | "promo_texto" | "esta_abierto">;

export const emptyStore: StoreFormValues = {
  nombre: "", categoria: "comida", rubro: "", descripcion: "", direccion: "", telefono: "", horario: "Todos los días de 10 a 23 h",
  imagen_url: "", logo_url: "", tiempo_min: 20, tiempo_max: 35, costo_envio: 990, pedido_minimo: 0, envio_gratis_desde: null, promo_texto: "", esta_abierto: true,
};

const rubrosSugeridos = ["Hamburguesas", "Pizza", "Sushi", "Café", "Helados", "Saludable", "Parrilla", "Pastas", "Pollo", "Desayunos", "Sándwiches", "Supermercado", "Bebidas", "Farmacia", "Indumentaria", "Regalos"];

const toNumber = (value: string) => (value === "" ? 0 : Number(value));

export function StoreSettingsForm({ initial, submitLabel, onSubmit }: { initial: StoreFormValues; submitLabel: string; onSubmit: (values: StoreFormValues) => Promise<void> }) {
  const [values, setValues] = useState<StoreFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof StoreFormValues>(key: K, value: StoreFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    await onSubmit({
      ...values,
      nombre: values.nombre.trim(),
      direccion: values.direccion.trim(),
      rubro: values.rubro?.trim() || null,
      descripcion: values.descripcion?.trim() || null,
      telefono: values.telefono?.trim() || null,
      imagen_url: values.imagen_url?.trim() || null,
      logo_url: values.logo_url?.trim() || null,
      promo_texto: values.promo_texto?.trim() || null,
      tiempo_max: Math.max(values.tiempo_max, values.tiempo_min),
    });
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="space-y-6">
      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-extrabold">Datos del comercio</legend>
        <div className="space-y-1.5"><Label htmlFor="s-nombre">Nombre</Label><Input id="s-nombre" required maxLength={80} value={values.nombre} onChange={(event) => set("nombre", event.target.value)} /></div>
        <div className="space-y-1.5">
          <Label htmlFor="s-categoria">Categoría</Label>
          <select id="s-categoria" value={values.categoria} onChange={(event) => set("categoria", event.target.value as Categoria)} className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
            {(Object.keys(categoriaLabel) as Categoria[]).map((key) => <option key={key} value={key}>{categoriaLabel[key]}</option>)}
          </select>
        </div>
        <div className="space-y-1.5"><Label htmlFor="s-rubro">Rubro</Label><Input id="s-rubro" list="rubros" maxLength={40} value={values.rubro || ""} onChange={(event) => set("rubro", event.target.value)} placeholder="Ej.: Hamburguesas" /><datalist id="rubros">{rubrosSugeridos.map((item) => <option key={item} value={item} />)}</datalist></div>
        <div className="space-y-1.5"><Label htmlFor="s-telefono">Teléfono</Label><Input id="s-telefono" maxLength={40} value={values.telefono || ""} onChange={(event) => set("telefono", event.target.value)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-direccion">Dirección</Label><Input id="s-direccion" required maxLength={200} value={values.direccion} onChange={(event) => set("direccion", event.target.value)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-descripcion">Descripción</Label><Textarea id="s-descripcion" maxLength={300} value={values.descripcion || ""} onChange={(event) => set("descripcion", event.target.value)} className="min-h-[72px]" /></div>
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-3 text-base font-extrabold">Imágenes</legend>
        <div className="space-y-1.5"><Label htmlFor="s-imagen">Foto de portada (URL)</Label><Input id="s-imagen" type="url" value={values.imagen_url || ""} onChange={(event) => set("imagen_url", event.target.value)} placeholder="https://…" /></div>
        <div className="space-y-1.5"><Label htmlFor="s-logo">Logo (URL, opcional)</Label><Input id="s-logo" type="url" value={values.logo_url || ""} onChange={(event) => set("logo_url", event.target.value)} placeholder="https://…" /></div>
        {values.imagen_url && <img src={img(values.imagen_url, 600)} alt="Vista previa de la portada" className="aspect-[16/9] w-full rounded-2xl object-cover sm:col-span-2 sm:max-w-sm" />}
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-base font-extrabold">Entrega y horarios</legend>
        <div className="space-y-1.5"><Label htmlFor="s-tmin">Tiempo mínimo (min)</Label><Input id="s-tmin" type="number" min={5} max={180} value={values.tiempo_min} onChange={(event) => set("tiempo_min", toNumber(event.target.value))} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-tmax">Tiempo máximo (min)</Label><Input id="s-tmax" type="number" min={5} max={240} value={values.tiempo_max} onChange={(event) => set("tiempo_max", toNumber(event.target.value))} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-horario">Horario</Label><Input id="s-horario" maxLength={80} value={values.horario || ""} onChange={(event) => set("horario", event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-envio">Costo de envío ($)</Label><Input id="s-envio" type="number" min={0} value={values.costo_envio} onChange={(event) => set("costo_envio", toNumber(event.target.value))} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-minimo">Pedido mínimo ($)</Label><Input id="s-minimo" type="number" min={0} value={values.pedido_minimo} onChange={(event) => set("pedido_minimo", toNumber(event.target.value))} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-gratis">Envío gratis desde ($)</Label><Input id="s-gratis" type="number" min={0} value={values.envio_gratis_desde ?? ""} onChange={(event) => set("envio_gratis_desde", event.target.value === "" ? null : Number(event.target.value))} placeholder="Opcional" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-promo">Promoción destacada</Label><Input id="s-promo" maxLength={40} value={values.promo_texto || ""} onChange={(event) => set("promo_texto", event.target.value)} placeholder="Ej.: 20% OFF en combos" /></div>
        <label className="flex items-center justify-between gap-3 rounded-xl border p-3 sm:mt-6"><span className="text-sm font-bold">Abierto ahora</span><Switch checked={values.esta_abierto} onCheckedChange={(checked) => set("esta_abierto", checked)} /></label>
      </fieldset>

      <Button type="submit" className="rounded-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}</Button>
    </form>
  );
}
