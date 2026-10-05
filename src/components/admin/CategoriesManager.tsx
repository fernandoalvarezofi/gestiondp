import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { db, errorMessage } from "@/lib/delivery";
import { armarArbol, Categoria } from "@/services/categories";

type Fila = Categoria & { activa: boolean };
const slugDe = (texto: string) => texto.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80);

/** Categorías del Market (dos niveles): administración las crea, renombra, ordena y las desactiva (no se borran: hay productos que las usan). */
export function CategoriesManager() {
  const [rows, setRows] = useState<Fila[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [nueva, setNueva] = useState<{ parent: string | null; nombre: string } | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await db.from("categorias").select("id, parent_id, slug, nombre, orden, activa").order("orden");
    if (error) { toast.error(errorMessage(error)); setRows([]); return; }
    setRows((data ?? []) as Fila[]);
  }, []);
  useEffect(() => { load(); }, [load]);
  const arbol = useMemo(() => armarArbol(rows ?? []) as (Fila & { hijas: Fila[] })[], [rows]);

  const guardar = async (c: Partial<Fila> & { nombre: string; slug: string; parent_id: string | null }) => {
    setBusy(true);
    const { error } = await db.rpc("delivery_admin_guardar_categoria", { p_id: c.id ?? null, p_parent: c.parent_id, p_slug: c.slug, p_nombre: c.nombre, p_orden: c.orden ?? 0, p_activa: c.activa ?? true });
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); return false; }
    toast.success("Categoría guardada");
    await load();
    return true;
  };

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const fila = (c: Fila, nivel: 0 | 1) => (
    <li key={c.id} className={nivel ? "ml-6" : ""}>
      <div className="flex flex-wrap items-center gap-2 py-1.5">
        <Input aria-label={`Nombre de ${c.nombre}`} defaultValue={c.nombre} maxLength={60} className="h-9 max-w-xs" onBlur={(e) => { const v = e.target.value.trim(); if (v && v !== c.nombre) guardar({ ...c, nombre: v }); }} />
        <Input aria-label={`Orden de ${c.nombre}`} type="number" defaultValue={c.orden} className="h-9 w-20" onBlur={(e) => { const v = Number(e.target.value); if (Number.isFinite(v) && v !== c.orden) guardar({ ...c, orden: v }); }} />
        <label className="flex items-center gap-2 text-sm font-semibold"><Switch checked={c.activa} disabled={busy} onCheckedChange={(activa) => guardar({ ...c, activa })} aria-label={`Activa: ${c.nombre}`} />{c.activa ? "Activa" : "Oculta"}</label>
        {nivel === 0 && <Button size="sm" variant="ghost" className="rounded-full" onClick={() => setNueva({ parent: c.id, nombre: "" })}><Plus className="h-4 w-4" />Subcategoría</Button>}
      </div>
    </li>
  );

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">Dos niveles. Los comercios eligen una al cargar un producto y los clientes filtran por ellas en el buscador. Ocultar una categoría la saca de los filtros sin tocar los productos.</p>
      <ul className="divide-y rounded-3xl border bg-card p-4">
        {arbol.map((raiz) => (
          <li key={raiz.id}><ul>{fila(raiz, 0)}{raiz.hijas.map((h) => fila(h, 1))}</ul></li>
        ))}
      </ul>
      {nueva ? (
        <form className="flex flex-wrap items-center gap-2" onSubmit={async (e) => { e.preventDefault(); const nombre = nueva.nombre.trim(); const padre = rows.find((r) => r.id === nueva.parent); const slug = slugDe(`${padre ? padre.nombre + " " : ""}${nombre}`); if (nombre.length < 2 || slug.length < 2) return; if (await guardar({ parent_id: nueva.parent, nombre, slug, orden: 99 })) setNueva(null); }}>
          <Input autoFocus aria-label="Nombre de la nueva categoría" placeholder={nueva.parent ? "Nombre de la subcategoría" : "Nombre de la categoría"} value={nueva.nombre} maxLength={60} onChange={(e) => setNueva({ ...nueva, nombre: e.target.value })} className="max-w-xs" />
          <Button type="submit" className="rounded-full" disabled={busy || nueva.nombre.trim().length < 2}>Crear</Button>
          <Button type="button" variant="ghost" className="rounded-full" onClick={() => setNueva(null)}>Cancelar</Button>
        </form>
      ) : <Button variant="outline" className="rounded-full" onClick={() => setNueva({ parent: null, nombre: "" })}><Plus className="h-4 w-4" />Nueva categoría</Button>}
    </div>
  );
}
