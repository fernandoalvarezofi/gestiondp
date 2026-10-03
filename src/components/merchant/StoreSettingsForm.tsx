import { FormEvent, useState } from "react";
import { Loader2 } from "lucide-react";
import { ImageUpload } from "@/components/delivery/ImageUpload";
import { ClosuresEditor } from "@/components/merchant/ClosuresEditor";
import { ScheduleEditor } from "@/components/merchant/ScheduleEditor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { AddressSearch } from "@/components/maps/AddressSearch";
import { MapPicker } from "@/components/maps/LazyMaps";
import { Categoria, categoriaLabel, defaultSchedule, DeliveryStore, Horarios, money, scheduleSummary } from "@/lib/delivery";

export type StoreFormValues = Pick<DeliveryStore,
  "nombre" | "categoria" | "rubro" | "descripcion" | "direccion" | "telefono" | "horario" | "imagen_url" | "logo_url" |
  "tiempo_min" | "tiempo_max" | "costo_envio" | "pedido_minimo" | "envio_gratis_desde" | "promo_texto" | "esta_abierto"> & {
  acepta_retiro: boolean; acepta_programados: boolean; tiempo_preparacion_min: number;
  horarios: Horarios; latitud: number | null; longitud: number | null; radio_entrega_km: number; costo_por_km: number;
};

export const emptyStore: StoreFormValues = {
  nombre: "", categoria: "comida", rubro: "", descripcion: "", direccion: "", telefono: "", horario: "",
  imagen_url: "", logo_url: "", tiempo_min: 20, tiempo_max: 35, costo_envio: 990, pedido_minimo: 0, envio_gratis_desde: null, promo_texto: "", esta_abierto: true,
  acepta_retiro: true, acepta_programados: true, tiempo_preparacion_min: 20,
  horarios: defaultSchedule, latitud: null, longitud: null, radio_entrega_km: 5, costo_por_km: 200,
};

export function storeToFormValues(store: DeliveryStore): StoreFormValues {
  return {
    nombre: store.nombre, categoria: store.categoria, rubro: store.rubro || "", descripcion: store.descripcion || "", direccion: store.direccion, telefono: store.telefono || "",
    horario: store.horario || "", imagen_url: store.imagen_url || "", logo_url: store.logo_url || "", tiempo_min: store.tiempo_min, tiempo_max: store.tiempo_max,
    costo_envio: Number(store.costo_envio), pedido_minimo: Number(store.pedido_minimo), envio_gratis_desde: store.envio_gratis_desde ?? null, promo_texto: store.promo_texto || "",
    esta_abierto: store.esta_abierto, horarios: store.horarios || defaultSchedule,
    acepta_retiro: store.acepta_retiro ?? true, acepta_programados: store.acepta_programados ?? true, tiempo_preparacion_min: store.tiempo_preparacion_min ?? 20,
    latitud: store.latitud != null ? Number(store.latitud) : null, longitud: store.longitud != null ? Number(store.longitud) : null,
    radio_entrega_km: Number(store.radio_entrega_km ?? 5), costo_por_km: Number(store.costo_por_km ?? 0),
  };
}

const rubrosSugeridos = ["Hamburguesas", "Pizza", "Sushi", "Café", "Helados", "Saludable", "Parrilla", "Pastas", "Pollo", "Desayunos", "Sándwiches", "Supermercado", "Bebidas", "Farmacia", "Indumentaria", "Regalos"];

const toNumber = (value: string) => (value === "" ? 0 : Number(value));

export type SettingsSection = "general" | "horarios" | "entrega" | "operacion";

/** Sin `section` muestra todo (alta de un comercio nuevo); con `section` muestra solo esa parte de la configuración. */
export function StoreSettingsForm({ initial, submitLabel, onSubmit, section }: { initial: StoreFormValues; submitLabel: string; onSubmit: (values: StoreFormValues) => Promise<void>; section?: SettingsSection }) {
  const show = (name: SettingsSection) => !section || section === name;
  const [values, setValues] = useState<StoreFormValues>(initial);
  const [saving, setSaving] = useState(false);
  const set = <K extends keyof StoreFormValues>(key: K, value: StoreFormValues[K]) => setValues((current) => ({ ...current, [key]: value }));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (values.latitud == null || values.longitud == null) {
      toast.error("Marcá la ubicación del local en el mapa (sección Ubicación y zona de entrega)");
      document.getElementById("store-location")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }
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
      horario: scheduleSummary(values.horarios),
    });
    setSaving(false);
  };

  return (
    <form onSubmit={submit} className="space-y-8">
      {show("general") && (<>
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
        <div className="space-y-1.5"><Label htmlFor="s-telefono">Teléfono del local</Label><Input id="s-telefono" type="tel" maxLength={40} value={values.telefono || ""} onChange={(event) => set("telefono", event.target.value)} placeholder="11 5555-5555" /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-direccion">Dirección</Label><Input id="s-direccion" required maxLength={200} value={values.direccion} onChange={(event) => set("direccion", event.target.value)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="s-descripcion">Descripción</Label><Textarea id="s-descripcion" maxLength={300} value={values.descripcion || ""} onChange={(event) => set("descripcion", event.target.value)} className="min-h-[72px]" placeholder="Qué vendés y qué te hace especial" /></div>
      </fieldset>
      <fieldset className="grid gap-6 sm:grid-cols-[1fr_auto]">
        <legend className="mb-3 text-base font-extrabold">Fotos</legend>
        <ImageUpload label="Foto de portada" folder="comercios" value={values.imagen_url} onChange={(url) => set("imagen_url", url)} className="max-w-md" />
        <ImageUpload label="Logo" folder="comercios" shape="round" value={values.logo_url} onChange={(url) => set("logo_url", url)} />
      </fieldset>
      </>)}
      {show("horarios") && (<>
      <fieldset>
        <legend className="mb-3 text-base font-extrabold">Horarios de atención</legend>
        <ScheduleEditor value={values.horarios} onChange={(horarios) => set("horarios", horarios)} />
        <ClosuresEditor value={values.horarios} onChange={(horarios) => set("horarios", horarios)} />
        <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border p-3">
          <span><span className="block text-sm font-bold">Recibir pedidos</span><span className="block text-xs text-muted-foreground">Apagalo para pausar el local aunque esté en horario (por ejemplo, si se cortó la luz).</span></span>
          <Switch checked={values.esta_abierto} onCheckedChange={(checked) => set("esta_abierto", checked)} />
        </label>
      </fieldset>
      </>)}
      {show("entrega") && (<>
      <fieldset id="store-location" className="space-y-3">
        <legend className="mb-3 text-base font-extrabold">Ubicación y zona de entrega</legend>
        <AddressSearch placeholder="Buscá la dirección del local" onPick={(found) => setValues((current) => ({ ...current, latitud: found.lat, longitud: found.lng, direccion: current.direccion || found.label }))} />
        {values.latitud != null && values.longitud != null ? (
          <MapPicker value={{ lat: values.latitud, lng: values.longitud }} onChange={(point) => setValues((current) => ({ ...current, latitud: point.lat, longitud: point.lng }))} className="h-60" />
        ) : <p className="rounded-xl bg-warning/15 p-3 text-sm font-semibold">Todavía no marcaste dónde está el local. Buscá la dirección arriba para ubicarlo en el mapa.</p>}
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5"><Label htmlFor="s-radio">Entregás hasta (km)</Label><Input id="s-radio" type="number" min={0.5} max={50} step={0.5} value={values.radio_entrega_km} onChange={(event) => set("radio_entrega_km", toNumber(event.target.value))} /></div>
          <div className="space-y-1.5"><Label htmlFor="s-km">Costo extra por km ($)</Label><Input id="s-km" type="number" min={0} value={values.costo_por_km} onChange={(event) => set("costo_por_km", toNumber(event.target.value))} /></div>
        </div>
        <p className="text-xs text-muted-foreground">Ejemplo: con envío base de {money(values.costo_envio)} y {money(values.costo_por_km)} por km, a 3 km el envío cuesta {money(Math.round((values.costo_envio + values.costo_por_km * 3) / 10) * 10)}.</p>
      </fieldset>
      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-3 text-base font-extrabold">Entrega</legend>
        <div className="space-y-1.5"><Label htmlFor="s-tmin">Tiempo mínimo (min)</Label><Input id="s-tmin" type="number" min={5} max={180} value={values.tiempo_min} onChange={(event) => set("tiempo_min", toNumber(event.target.value))} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-tmax">Tiempo máximo (min)</Label><Input id="s-tmax" type="number" min={5} max={240} value={values.tiempo_max} onChange={(event) => set("tiempo_max", toNumber(event.target.value))} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-envio">Envío base ($)</Label><Input id="s-envio" type="number" min={0} value={values.costo_envio} onChange={(event) => set("costo_envio", toNumber(event.target.value))} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-minimo">Pedido mínimo ($)</Label><Input id="s-minimo" type="number" min={0} value={values.pedido_minimo} onChange={(event) => set("pedido_minimo", toNumber(event.target.value))} /></div>
        <div className="space-y-1.5"><Label htmlFor="s-gratis">Envío gratis desde ($)</Label><Input id="s-gratis" type="number" min={0} value={values.envio_gratis_desde ?? ""} onChange={(event) => set("envio_gratis_desde", event.target.value === "" ? null : Number(event.target.value))} placeholder="Opcional" /></div>
        <div className="space-y-1.5"><Label htmlFor="s-promo">Promoción destacada</Label><Input id="s-promo" maxLength={40} value={values.promo_texto || ""} onChange={(event) => set("promo_texto", event.target.value)} placeholder="Ej.: 20% OFF en combos" /></div>
      </fieldset>
      </>)}
      {show("operacion") && (<>
      <fieldset className="space-y-3">
        <legend className="mb-3 text-base font-extrabold">Cómo recibís pedidos</legend>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border p-3">
          <span><span className="block text-sm font-bold">Ofrecer retiro en el local</span><span className="block text-xs text-muted-foreground">El cliente puede pasar a buscar su pedido, sin costo de envío ni repartidor.</span></span>
          <Switch checked={values.acepta_retiro} onCheckedChange={(checked) => set("acepta_retiro", checked)} />
        </label>
        <label className="mt-3 flex items-center justify-between gap-3 rounded-xl border p-3">
          <span><span className="block text-sm font-bold">Aceptar pedidos programados</span><span className="block text-xs text-muted-foreground">Los clientes pueden pedir para más tarde o para otro día, dentro de tus horarios.</span></span>
          <Switch checked={values.acepta_programados} onCheckedChange={(checked) => set("acepta_programados", checked)} />
        </label>

        <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5"><Label htmlFor="s-prep">Preparación habitual (min)</Label><Input id="s-prep" type="number" min={5} max={120} value={values.tiempo_preparacion_min} onChange={(event) => set("tiempo_preparacion_min", Math.min(120, Math.max(5, toNumber(event.target.value))))} /><p className="text-xs text-muted-foreground">Es lo que se sugiere al aceptar un pedido.</p></div>
        </div>
      </fieldset>
      </>)}

      <Button type="submit" className="rounded-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}{submitLabel}</Button>
    </form>
  );
}
