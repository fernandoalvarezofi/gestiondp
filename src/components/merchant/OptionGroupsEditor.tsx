import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { db, errorMessage, ProductGroup, ProductOption, sortGroups } from "@/lib/delivery";
import { confirmar } from "@/components/ui/dialogos";

const presets = [
  { label: "Tamaño (obligatorio)", nombre: "Tamaño", minimo: 1, maximo: 1, opciones: ["Chico", "Grande"] },
  { label: "Punto de la carne", nombre: "Punto de la carne", minimo: 1, maximo: 1, opciones: ["Jugosa", "A punto", "Bien cocida"] },
  { label: "Extras (opcional)", nombre: "Extras", minimo: 0, maximo: 3, opciones: ["Extra queso"] },
  { label: "Grupo vacío", nombre: "Nuevo grupo", minimo: 0, maximo: 1, opciones: [] as string[] },
];

/** Grupos de opciones de un producto. Cada cambio se guarda al momento (al salir del campo). */
export function OptionGroupsEditor({ productId, onChange }: { productId: string; onChange: () => void }) {
  const [groups, setGroups] = useState<ProductGroup[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_producto_grupos").select("*, opciones:delivery_producto_opciones(*)").eq("producto_id", productId);
    setGroups(sortGroups(data));
    setLoading(false);
  }, [productId]);

  useEffect(() => { load(); }, [load]);

  const run = async (request: PromiseLike<{ error: unknown }>, success?: string) => {
    const { error } = await request;
    if (error) { toast.error(errorMessage(error)); await load(); return false; }
    if (success) toast.success(success);
    await load();
    onChange();
    return true;
  };

  const addGroup = async (preset: typeof presets[number]) => {
    setAdding(true);
    const { data, error } = await db.from("delivery_producto_grupos").insert({ producto_id: productId, nombre: preset.nombre, minimo: preset.minimo, maximo: preset.maximo, orden: groups.length }).select("id").single();
    if (!error && preset.opciones.length) {
      await db.from("delivery_producto_opciones").insert(preset.opciones.map((nombre, orden) => ({ grupo_id: data.id, nombre, orden })));
    }
    setAdding(false);
    if (error) return toast.error(errorMessage(error));
    await load();
    onChange();
  };

  const updateGroup = (group: ProductGroup, patch: Partial<Pick<ProductGroup, "nombre" | "minimo" | "maximo">>) => {
    const next = { ...group, ...patch };
    if (next.maximo < next.minimo) next.maximo = next.minimo;
    if (next.maximo < 1) next.maximo = 1;
    run(db.from("delivery_producto_grupos").update({ nombre: next.nombre.trim() || group.nombre, minimo: next.minimo, maximo: next.maximo }).eq("id", group.id));
  };

  const updateOption = (option: ProductOption, patch: Partial<Pick<ProductOption, "nombre" | "precio_extra" | "disponible">>) =>
    run(db.from("delivery_producto_opciones").update(patch).eq("id", option.id));

  if (loading) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  return (
    <div className="mt-3 space-y-3">
      {groups.map((group) => (
        <div key={group.id} className="rounded-2xl border p-3">
          <div className="flex flex-wrap items-center gap-2">
            <Input defaultValue={group.nombre} maxLength={60} onBlur={(event) => event.target.value.trim() !== group.nombre && updateGroup(group, { nombre: event.target.value })} className="h-9 min-w-[140px] flex-1 font-bold" aria-label="Nombre del grupo" />
            <label className="flex items-center gap-1.5 text-xs font-semibold">
              <Switch checked={group.minimo > 0} onCheckedChange={(checked) => updateGroup(group, { minimo: checked ? 1 : 0 })} />Obligatorio
            </label>
            <label className="flex items-center gap-1.5 text-xs font-semibold">
              Hasta
              <select value={group.maximo} onChange={(event) => updateGroup(group, { maximo: Number(event.target.value) })} className="h-8 rounded-md border bg-background px-1 text-sm">
                {[1, 2, 3, 4, 5, 6, 8, 10].map((value) => <option key={value} value={value}>{value}</option>)}
              </select>
            </label>
            <Button type="button" size="icon" variant="ghost" aria-label="Eliminar grupo" onClick={async () => (await confirmar({ titulo: `¿Eliminar el grupo “${group.nombre}”?`, descripcion: "Se borran también todas sus opciones.", confirmar: "Eliminar", peligro: true })) && run(db.from("delivery_producto_grupos").delete().eq("id", group.id), "Grupo eliminado")}><Trash2 className="h-4 w-4" /></Button>
          </div>
          <ul className="mt-2 space-y-1.5">
            {group.opciones.map((option) => (
              <li key={option.id} className="flex items-center gap-2">
                <Input defaultValue={option.nombre} maxLength={60} onBlur={(event) => event.target.value.trim() && event.target.value.trim() !== option.nombre && updateOption(option, { nombre: event.target.value.trim() })} className="h-9 flex-1" aria-label="Opción" />
                <div className="flex h-9 w-28 items-center rounded-md border px-2 text-sm"><span className="text-muted-foreground">+$</span><input type="number" min={0} defaultValue={Number(option.precio_extra)} onBlur={(event) => Number(event.target.value) !== Number(option.precio_extra) && updateOption(option, { precio_extra: Math.max(0, Number(event.target.value) || 0) })} className="w-full bg-transparent pl-1 outline-none" aria-label="Precio extra" /></div>
                <Switch checked={option.disponible} onCheckedChange={(checked) => updateOption(option, { disponible: checked })} aria-label="Disponible" />
                <Button type="button" size="icon" variant="ghost" className="h-9 w-9" aria-label="Eliminar opción" onClick={() => run(db.from("delivery_producto_opciones").delete().eq("id", option.id))}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
          <Button type="button" size="sm" variant="ghost" className="mt-1" onClick={() => run(db.from("delivery_producto_opciones").insert({ grupo_id: group.id, nombre: "Nueva opción", orden: group.opciones.length }))}><Plus className="h-4 w-4" />Agregar opción</Button>
        </div>
      ))}
      <div className="flex flex-wrap gap-2">
        {presets.map((preset) => (
          <Button key={preset.label} type="button" size="sm" variant="outline" className="rounded-full" disabled={adding} onClick={() => addGroup(preset)}><Plus className="h-3.5 w-3.5" />{preset.label}</Button>
        ))}
      </div>
    </div>
  );
}
