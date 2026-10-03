import { useCallback, useEffect, useState } from "react";
import { Loader2, Store } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Input } from "@/components/ui/input";
import { db, errorMessage } from "@/lib/delivery";
import { DirectorioAdminItem, DirectorioEstado, estadoLabel, normalize } from "@/lib/directorio";
import { cn } from "@/lib/utils";

const ESTADOS = Object.keys(estadoLabel) as DirectorioEstado[];

/** Embudo comercial: comercios de Lincoln para invitar, ordenados por cuántos vecinos los piden. */
export function DirectorioManager() {
  const [items, setItems] = useState<DirectorioAdminItem[] | null>(null);
  const [filter, setFilter] = useState<DirectorioEstado | "todos">("todos");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    const { data, error } = await db.rpc("delivery_admin_directorio");
    if (error) { toast.error(errorMessage(error)); setItems([]); return; }
    setItems(((data || []) as DirectorioAdminItem[]).map((item) => ({ ...item, quieren_pedir: Number(item.quieren_pedir), reclamos: Number(item.reclamos) })));
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (item: DirectorioAdminItem, estado: DirectorioEstado, nota: string | null) => {
    const { error } = await db.rpc("delivery_admin_directorio_estado", { p_id: item.id, p_estado: estado, p_nota: nota });
    if (error) return toast.error(errorMessage(error));
    setItems((current) => (current || []).map((row) => (row.id === item.id ? { ...row, estado, nota } : row)));
  };

  if (!items) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const count = (state: DirectorioEstado) => items.filter((item) => item.estado === state).length;
  const visible = items.filter((item) => (filter === "todos" || item.estado === filter) && (!query.trim() || normalize(`${item.nombre} ${item.rubro}`).includes(normalize(query.trim()))));

  return (
    <div className="space-y-4">
      <p className="max-w-2xl text-sm text-muted-foreground">Los comercios salen de OpenStreetMap y de altas manuales. Los vecinos votan "Quiero pedir acá" y los dueños piden sumarse con "Es mi comercio": llamá primero a los más pedidos y registrá en qué quedó. Los que marques como "Se sumó" o "Descartado" dejan de verse en el directorio público.</p>
      <div className="flex flex-wrap items-center gap-2">
        {(["todos", ...ESTADOS] as const).map((state) => (
          <button key={state} type="button" onClick={() => setFilter(state)} className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", filter === state ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>{state === "todos" ? `Todos (${items.length})` : `${estadoLabel[state]} (${count(state)})`}</button>
        ))}
        <Input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Buscar" aria-label="Buscar comercio" className="ml-auto h-9 max-w-[200px] rounded-full" />
      </div>
      {visible.length === 0 ? <EmptyState icon={<Store className="h-7 w-7" />} title="Nada para mostrar" /> : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
          {visible.map((item) => (
            <li key={item.id} className="grid gap-3 p-3 sm:grid-cols-[1fr_auto]">
              <div className="min-w-0">
                <p className="font-bold">{item.nombre} <span className="text-xs font-semibold text-muted-foreground">· {item.rubro}</span></p>
                <p className="text-xs text-muted-foreground">{item.direccion || "Sin dirección"} · {item.telefono || "sin teléfono"}</p>
                <p className="mt-1 text-xs font-bold">{item.quieren_pedir} {item.quieren_pedir === 1 ? "vecino lo quiere" : "vecinos lo quieren"}{item.reclamos > 0 && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-primary">{item.reclamos} pidió sumarlo (dueño)</span>}</p>
                <Input defaultValue={item.nota ?? ""} maxLength={300} placeholder="Nota: con quién hablaste, qué dijo…" aria-label={`Nota de ${item.nombre}`} className="mt-2 h-9" onBlur={(event) => { const value = event.target.value.trim() || null; if (value !== (item.nota ?? null)) save(item, item.estado, value); }} />
              </div>
              <select aria-label={`Estado de ${item.nombre}`} value={item.estado} onChange={(event) => save(item, event.target.value as DirectorioEstado, item.nota)} className="h-9 self-start rounded-full border bg-background px-3 text-sm font-bold">
                {ESTADOS.map((state) => <option key={state} value={state}>{estadoLabel[state]}</option>)}
              </select>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
