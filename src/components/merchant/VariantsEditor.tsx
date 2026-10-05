import { useCallback, useEffect, useState } from "react";
import { Loader2, Plus, Trash2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { db, errorMessage, ProductVariant } from "@/lib/delivery";

const lista = (text: string) => [...new Set(text.split(",").map((part) => part.trim()).filter(Boolean))].slice(0, 20);

/** Combina listas (talles × colores…) en nombres de variante: "M / Negro". */
export function combinarVariantes(ejes: string[][]): string[] {
  const conDatos = ejes.filter((eje) => eje.length > 0);
  if (!conDatos.length) return [];
  return conDatos.reduce<string[]>((acc, eje) => (acc.length ? acc.flatMap((a) => eje.map((b) => `${a} / ${b}`)) : eje), []).slice(0, 100);
}

/** Variantes de un producto (talle, color…) con SKU, precio y stock propios. Cada cambio se guarda al salir del campo. */
export function VariantsEditor({ productId, onChange }: { productId: string; onChange: () => void }) {
  const [usa, setUsa] = useState(false);
  const [variantes, setVariantes] = useState<ProductVariant[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [nueva, setNueva] = useState("");
  const [ejeA, setEjeA] = useState("");
  const [ejeB, setEjeB] = useState("");

  const load = useCallback(async () => {
    const [producto, lista] = await Promise.all([
      db.from("delivery_productos").select("usa_variantes").eq("id", productId).maybeSingle(),
      db.from("delivery_producto_variantes").select("*").eq("producto_id", productId).order("orden").order("created_at"),
    ]);
    setUsa(Boolean(producto.data?.usa_variantes));
    setVariantes((lista.data || []) as ProductVariant[]);
    setLoading(false);
  }, [productId]);
  useEffect(() => { load(); }, [load]);

  const run = async (request: PromiseLike<{ error: unknown }>, ok?: string) => {
    setBusy(true);
    const { error } = await request;
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); await load(); return false; }
    if (ok) toast.success(ok);
    await load();
    onChange();
    return true;
  };

  const activar = (valor: boolean) => {
    if (valor && variantes.length === 0) { setUsa(true); return; }
    return run(db.from("delivery_productos").update({ usa_variantes: valor }).eq("id", productId));
  };

  const agregarNombres = async (nombres: string[]) => {
    const existentes = new Set(variantes.map((v) => v.nombre.toLowerCase()));
    const nuevas = nombres.filter((n) => !existentes.has(n.toLowerCase()));
    if (!nuevas.length) { toast.info("Esas variantes ya existen"); return; }
    if (variantes.length + nuevas.length > 100) { toast.error("Un producto puede tener hasta 100 variantes"); return; }
    const base = variantes.length;
    const ok = await run(db.from("delivery_producto_variantes").insert(nuevas.map((nombre, i) => ({ producto_id: productId, nombre, orden: base + i }))));
    if (ok) await run(db.from("delivery_productos").update({ usa_variantes: true }).eq("id", productId), `${nuevas.length} variante${nuevas.length === 1 ? "" : "s"} agregada${nuevas.length === 1 ? "" : "s"}`);
  };

  const guardar = (v: ProductVariant, cambios: Partial<Pick<ProductVariant, "nombre" | "sku" | "precio" | "stock" | "disponible">>) =>
    run(db.from("delivery_producto_variantes").update(cambios).eq("id", v.id));

  const borrar = async (v: ProductVariant) => {
    if (!window.confirm(`¿Eliminar la variante “${v.nombre}”?`)) return;
    const quedan = variantes.length - 1;
    const ok = await run(db.from("delivery_producto_variantes").delete().eq("id", v.id));
    if (ok && quedan === 0) await run(db.from("delivery_productos").update({ usa_variantes: false }).eq("id", productId));
  };

  const numero = (texto: string): number | null => {
    const limpio = texto.trim().replace(",", ".");
    if (limpio === "") return null;
    const n = Number(limpio);
    return Number.isFinite(n) && n >= 0 ? n : null;
  };

  if (loading) return <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  const combos = combinarVariantes([lista(ejeA), lista(ejeB)]);

  return (
    <div className="mt-3 space-y-4">
      <label className="flex items-center gap-2 text-sm font-semibold">
        <Switch checked={usa} disabled={busy} onCheckedChange={activar} />Este producto tiene variantes (talle, color, sabor…)
      </label>

      {usa && (
        <>
          {variantes.length > 0 && (
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[560px] text-sm">
                <thead className="bg-muted text-left text-xs font-bold text-muted-foreground">
                  <tr><th className="px-3 py-2">Variante</th><th className="px-2 py-2">SKU</th><th className="px-2 py-2">Precio</th><th className="px-2 py-2">Stock</th><th className="px-2 py-2">Activa</th><th className="w-10" /></tr>
                </thead>
                <tbody className="divide-y">
                  {variantes.map((v) => (
                    <tr key={v.id}>
                      <td className="px-3 py-1.5"><Input defaultValue={v.nombre} maxLength={80} aria-label="Nombre de la variante" className="h-9" onBlur={(e) => { const t = e.target.value.trim(); if (t && t !== v.nombre) guardar(v, { nombre: t }); else e.target.value = v.nombre; }} /></td>
                      <td className="px-2 py-1.5"><Input defaultValue={v.sku ?? ""} maxLength={40} aria-label="SKU" placeholder="—" className="h-9 w-28" onBlur={(e) => { const t = e.target.value.trim(); if ((t || null) !== (v.sku ?? null)) guardar(v, { sku: t || null }); }} /></td>
                      <td className="px-2 py-1.5"><Input defaultValue={v.precio ?? ""} inputMode="decimal" aria-label="Precio" placeholder="Igual" className="h-9 w-24" onBlur={(e) => { const n = numero(e.target.value); if (n !== (v.precio == null ? null : Number(v.precio))) guardar(v, { precio: n }); }} /></td>
                      <td className="px-2 py-1.5"><Input defaultValue={v.stock ?? ""} inputMode="numeric" aria-label="Stock" placeholder="Sin límite" className="h-9 w-24" onBlur={(e) => { const n = numero(e.target.value); const entero = n == null ? null : Math.floor(n); if (entero !== v.stock) guardar(v, { stock: entero }); }} /></td>
                      <td className="px-2 py-1.5"><Switch checked={v.disponible} onCheckedChange={(c) => guardar(v, { disponible: c })} aria-label="Variante activa" /></td>
                      <td className="px-1 py-1.5"><Button type="button" size="icon" variant="ghost" aria-label="Eliminar variante" onClick={() => borrar(v)}><Trash2 className="h-4 w-4" /></Button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          {variantes.length > 0 && <p className="text-xs text-muted-foreground">Precio vacío: usa el del producto. Stock vacío: sin límite. El stock se descuenta por variante y se devuelve si el pedido se cancela.</p>}

          <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const n = nueva.trim(); if (n) { agregarNombres([n]); setNueva(""); } }}>
            <Input value={nueva} onChange={(e) => setNueva(e.target.value)} maxLength={80} placeholder="Nueva variante (ej.: M / Negro)" aria-label="Nueva variante" />
            <Button type="submit" variant="outline" disabled={busy || !nueva.trim()}><Plus className="h-4 w-4" />Agregar</Button>
          </form>

          <div className="rounded-2xl bg-muted p-3">
            <p className="flex items-center gap-1.5 text-sm font-extrabold"><Wand2 className="h-4 w-4" />Generar combinaciones</p>
            <div className="mt-2 grid gap-2 sm:grid-cols-2">
              <Input value={ejeA} onChange={(e) => setEjeA(e.target.value)} placeholder="Talles: S, M, L, XL" aria-label="Primer atributo" />
              <Input value={ejeB} onChange={(e) => setEjeB(e.target.value)} placeholder="Colores: Negro, Blanco" aria-label="Segundo atributo" />
            </div>
            <Button type="button" size="sm" className="mt-2" disabled={busy || combos.length === 0} onClick={() => { agregarNombres(combos); setEjeA(""); setEjeB(""); }}>
              {combos.length ? `Crear ${combos.length} variante${combos.length === 1 ? "" : "s"}` : "Escribí al menos un atributo"}
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
