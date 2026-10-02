import { useEffect, useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Ajuste, useAjustes } from "@/hooks/useAjustes";
import { db, errorMessage } from "@/lib/delivery";

function SettingRow({ item, onSaved }: { item: Ajuste; onSaved: () => void }) {
  const [value, setValue] = useState(String(item.valor));
  const [saving, setSaving] = useState(false);
  useEffect(() => { setValue(String(item.valor)); }, [item.valor]);
  const changed = Number(value) !== item.valor;

  const save = async () => {
    setSaving(true);
    const { error } = await db.rpc("delivery_admin_guardar_ajuste", { p_clave: item.clave, p_valor: Number(value) });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Ajuste guardado: ya rige para los pedidos nuevos");
    onSaved();
  };

  return (
    <li className="flex flex-wrap items-center gap-4 p-4">
      <div className="min-w-[220px] flex-1">
        <p className="font-bold">{item.etiqueta}</p>
        {item.ayuda && <p className="text-sm text-muted-foreground">{item.ayuda}</p>}
        <p className="mt-0.5 text-xs text-muted-foreground">Permitido: {item.minimo} a {item.maximo} {item.unidad}</p>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative">
          <Input type="number" inputMode="decimal" min={item.minimo} max={item.maximo} step="any" value={value} onChange={(event) => setValue(event.target.value)} className="w-28 pr-9" aria-label={item.etiqueta} />
          <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-muted-foreground">{item.unidad}</span>
        </div>
        <Button className="rounded-full" size="sm" disabled={!changed || saving || value === ""} onClick={save}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}Guardar</Button>
      </div>
    </li>
  );
}

/** Parámetros de la plataforma que antes estaban fijos: tarifa de servicio, comisión por defecto y tiempos de respuesta. */
export function PlatformSettings() {
  const { ajustes, isLoading, refresh } = useAjustes();
  if (isLoading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="max-w-3xl space-y-4">
      <p className="text-sm text-muted-foreground">Los cambios rigen para los pedidos nuevos; los pedidos ya creados no se modifican.</p>
      <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
        {ajustes.map((item) => <SettingRow key={item.clave} item={item} onSaved={refresh} />)}
      </ul>
    </div>
  );
}
