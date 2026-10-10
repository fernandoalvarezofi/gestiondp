import { KeyboardEvent, useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Plus, Trash2, Wand2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { confirmar } from "@/components/ui/dialogos";
import { db, EjeVariante, errorMessage, money, ProductVariant } from "@/lib/delivery";
import { cn } from "@/lib/utils";

const MAX_EJES = 3, MAX_VALORES = 30, MAX_VARIANTES = 100;
const SEP = " / ";

/** Todas las combinaciones de los valores de cada opción ("M / Negro"). */
export function combinar(ejes: EjeVariante[]): string[] {
  const conValores = ejes.filter((e) => e.valores.length > 0);
  if (!conValores.length) return [];
  return conValores.reduce<string[]>((acc, eje) => (acc.length ? acc.flatMap((a) => eje.valores.map((v) => `${a}${SEP}${v}`)) : [...eje.valores]), []);
}
/** Si el producto tiene variantes pero no opciones guardadas, se deducen de los nombres ("M / Negro" → dos opciones). */
export function deducirEjes(nombres: string[]): EjeVariante[] {
  if (!nombres.length) return [];
  const partes = nombres.map((n) => n.split(SEP).map((p) => p.trim()));
  const largo = partes[0].length;
  if (largo > MAX_EJES || partes.some((p) => p.length !== largo)) return [{ nombre: "Opción", valores: [...new Set(nombres)].slice(0, MAX_VALORES) }];
  return Array.from({ length: largo }, (_, i) => ({ nombre: largo === 1 ? "Opción" : `Opción ${i + 1}`, valores: [...new Set(partes.map((p) => p[i]))].slice(0, MAX_VALORES) }));
}

function ValoresInput({ valores, onChange, placeholder }: { valores: string[]; onChange: (v: string[]) => void; placeholder: string }) {
  const [texto, setTexto] = useState("");
  const agregar = (raw: string) => {
    const nuevos = raw.split(",").map((s) => s.trim()).filter(Boolean).filter((s) => !valores.some((v) => v.toLowerCase() === s.toLowerCase()));
    if (nuevos.length) onChange([...valores, ...nuevos].slice(0, MAX_VALORES));
    setTexto("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") { e.preventDefault(); agregar(texto); }
    else if (e.key === "Backspace" && !texto && valores.length) onChange(valores.slice(0, -1));
  };
  return (
    <div className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-md border bg-background px-2 py-1.5 focus-within:ring-2 focus-within:ring-ring/30">
      {valores.map((v) => (
        <span key={v} className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-0.5 text-sm font-semibold">{v}
          <button type="button" aria-label={`Quitar ${v}`} onClick={() => onChange(valores.filter((x) => x !== v))} className="text-muted-foreground hover:text-foreground"><X className="h-3 w-3" /></button>
        </span>
      ))}
      <input value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={onKey} onBlur={() => texto.trim() && agregar(texto)} placeholder={valores.length ? "" : placeholder} aria-label="Agregar valor" className="min-w-[8rem] flex-1 bg-transparent text-sm outline-none" />
    </div>
  );
}

/**
 * Variantes como en Shopify: hasta 3 opciones con nombre (Talle, Color, Material) y sus valores; las combinaciones se generan solas.
 * Cada variante tiene SKU, código de barras, precio, costo, stock, mínimo y si se vende. Se puede aplicar precio, costo o stock a
 * varias a la vez. El stock que se fija acá queda en el historial de inventario.
 */
export function VariantesPanel({ storeId, productId, precioBase, ejesGuardados, onChange }: { storeId: string; productId: string; precioBase: number; ejesGuardados: EjeVariante[]; onChange: () => void }) {
  const [usa, setUsa] = useState(false);
  const [variantes, setVariantes] = useState<ProductVariant[]>([]);
  const [ejes, setEjes] = useState<EjeVariante[]>(ejesGuardados);
  const [cargando, setCargando] = useState(true);
  const [busy, setBusy] = useState(false);
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [masivo, setMasivo] = useState({ precio: "", costo: "", stock: "" });

  const cargar = useCallback(async () => {
    const [p, l] = await Promise.all([
      db.from("delivery_productos").select("usa_variantes, variantes_ejes").eq("id", productId).maybeSingle(),
      db.from("delivery_producto_variantes").select("*").eq("producto_id", productId).order("orden").order("created_at"),
    ]);
    const lista = (l.data || []) as ProductVariant[];
    setUsa(Boolean(p.data?.usa_variantes));
    setVariantes(lista);
    const guardados = (p.data?.variantes_ejes ?? []) as EjeVariante[];
    setEjes(guardados.length ? guardados : deducirEjes(lista.map((v) => v.nombre)));
    setCargando(false);
  }, [productId]);
  useEffect(() => { void cargar(); }, [cargar]);

  const run = async (request: PromiseLike<{ error: unknown }>, ok?: string) => {
    setBusy(true);
    const { error } = await request;
    setBusy(false);
    if (error) { toast.error(errorMessage(error)); await cargar(); return false; }
    if (ok) toast.success(ok);
    await cargar(); onChange();
    return true;
  };

  const combos = useMemo(() => combinar(ejes), [ejes]);
  const existentes = new Set(variantes.map((v) => v.nombre.toLowerCase()));
  const faltantes = combos.filter((c) => !existentes.has(c.toLowerCase()));
  const sobrantes = variantes.filter((v) => combos.length > 0 && !combos.some((c) => c.toLowerCase() === v.nombre.toLowerCase()));
  const ejesCambiados = JSON.stringify(ejes) !== JSON.stringify(ejesGuardados);

  const generar = async () => {
    const limpios = ejes.map((e) => ({ nombre: e.nombre.trim() || "Opción", valores: e.valores })).filter((e) => e.valores.length);
    if (!limpios.length) return toast.error("Agregá al menos un valor");
    if (variantes.length + faltantes.length > MAX_VARIANTES) return toast.error(`Un producto puede tener hasta ${MAX_VARIANTES} variantes (estas opciones generan ${combos.length})`);
    setBusy(true);
    const { error: e1 } = await db.from("delivery_productos").update({ variantes_ejes: limpios, usa_variantes: true }).eq("id", productId);
    if (e1) { setBusy(false); return toast.error(errorMessage(e1)); }
    if (faltantes.length) {
      const base = variantes.length;
      const { error } = await db.from("delivery_producto_variantes").insert(faltantes.map((nombre, i) => ({ producto_id: productId, nombre, orden: base + i })));
      if (error) { setBusy(false); await cargar(); return toast.error(errorMessage(error)); }
    }
    setBusy(false);
    toast.success(faltantes.length ? `${faltantes.length} ${faltantes.length === 1 ? "variante creada" : "variantes creadas"}` : "Opciones guardadas");
    await cargar(); onChange();
    if (sobrantes.length && await confirmar({ titulo: `${sobrantes.length} ${sobrantes.length === 1 ? "variante ya no corresponde" : "variantes ya no corresponden"} a las opciones`, descripcion: sobrantes.map((v) => v.nombre).join(", ") + ". ¿Las eliminamos? Los pedidos anteriores no cambian.", confirmar: "Eliminar", cancelar: "Dejarlas", peligro: true })) {
      await run(db.from("delivery_producto_variantes").delete().in("id", sobrantes.map((v) => v.id)), "Variantes eliminadas");
    }
  };

  const activar = async (valor: boolean) => {
    if (valor && variantes.length === 0) { setUsa(true); if (!ejes.length) setEjes([{ nombre: "Talle", valores: [] }]); return; }
    if (!valor && variantes.length && !(await confirmar({ titulo: "¿Dejar de usar variantes?", descripcion: "Las variantes se conservan pero dejan de venderse: el producto vuelve a tener un solo precio y stock.", confirmar: "Dejar de usar" }))) return;
    await run(db.from("delivery_productos").update({ usa_variantes: valor }).eq("id", productId));
  };
  const guardar = (v: ProductVariant, cambios: Partial<ProductVariant>) => run(db.from("delivery_producto_variantes").update(cambios).eq("id", v.id));
  const borrar = async (v: ProductVariant) => {
    if (!(await confirmar({ titulo: `¿Eliminar la variante “${v.nombre}”?`, descripcion: "Su stock se pierde. Los pedidos anteriores no cambian.", confirmar: "Eliminar", peligro: true }))) return;
    const ok = await run(db.from("delivery_producto_variantes").delete().eq("id", v.id));
    if (ok && variantes.length === 1) await run(db.from("delivery_productos").update({ usa_variantes: false }).eq("id", productId));
  };
  const numero = (t: string): number | null => { const l = t.trim().replace(",", "."); if (l === "") return null; const n = Number(l); return Number.isFinite(n) && n >= 0 ? n : NaN; };

  const aplicarMasivo = async () => {
    const ids = sel.size ? [...sel] : variantes.map((v) => v.id);
    const cambios: Record<string, unknown> = {};
    for (const k of ["precio", "costo", "stock"] as const) {
      if (masivo[k].trim() === "") continue;
      const n = numero(masivo[k]);
      if (n == null || Number.isNaN(n) || (k === "stock" && !Number.isInteger(n))) return toast.error(`Revisá el ${k}`);
      cambios[k] = n;
    }
    if (!Object.keys(cambios).length) return toast.error("Escribí un precio, costo o stock para aplicar");
    if (!(await confirmar({ titulo: `¿Aplicar a ${ids.length} ${ids.length === 1 ? "variante" : "variantes"}?`, confirmar: "Aplicar" }))) return;
    setBusy(true);
    // Precio y stock por la edición rápida del catálogo (stock con historial); el costo, directo.
    const lote = ids.map((id) => ({ id: productId, variante: id, ...("precio" in cambios ? { precio: cambios.precio } : {}), ...("stock" in cambios ? { stock: cambios.stock } : {}) }));
    const r1 = "precio" in cambios || "stock" in cambios ? await db.rpc("catalogo_edicion_rapida", { p_comercio: storeId, p_cambios: lote }) : { error: null };
    const r2 = "costo" in cambios ? await db.from("delivery_producto_variantes").update({ costo: cambios.costo }).in("id", ids) : { error: null };
    setBusy(false);
    if (r1.error || r2.error) { toast.error(errorMessage(r1.error || r2.error)); await cargar(); return; }
    toast.success("Listo"); setMasivo({ precio: "", costo: "", stock: "" }); setSel(new Set()); await cargar(); onChange();
  };

  if (cargando) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>;

  return (
    <div className="space-y-5">
      <label className="flex items-center gap-2.5 text-sm font-semibold"><Switch checked={usa} disabled={busy} onCheckedChange={activar} />Este producto tiene variantes (talle, color, material…)</label>
      {usa && (
        <>
          <div className="space-y-3">
            {ejes.map((eje, i) => (
              <div key={i} className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[180px_minmax(0,1fr)_auto]">
                <Input aria-label={`Nombre de la opción ${i + 1}`} value={eje.nombre} maxLength={30} placeholder="Talle" onChange={(e) => setEjes(ejes.map((x, j) => (j === i ? { ...x, nombre: e.target.value } : x)))} />
                <ValoresInput valores={eje.valores} placeholder={i === 0 ? "S, M, L, XL (Enter o coma)" : "Negro, Blanco"} onChange={(valores) => setEjes(ejes.map((x, j) => (j === i ? { ...x, valores } : x)))} />
                <Button type="button" size="icon" variant="ghost" aria-label={`Quitar la opción ${eje.nombre || i + 1}`} onClick={() => setEjes(ejes.filter((_, j) => j !== i))}><Trash2 className="h-4 w-4" /></Button>
              </div>
            ))}
            <div className="flex flex-wrap items-center gap-2">
              {ejes.length < MAX_EJES && <Button type="button" variant="outline" size="sm" onClick={() => setEjes([...ejes, { nombre: ejes.length === 0 ? "Talle" : ejes.length === 1 ? "Color" : "Material", valores: [] }])}><Plus className="h-4 w-4" />Agregar opción</Button>}
              {(faltantes.length > 0 || ejesCambiados) && combos.length > 0 && (
                <Button type="button" size="sm" disabled={busy} onClick={generar}><Wand2 className="h-4 w-4" />{faltantes.length ? `Crear ${faltantes.length} ${faltantes.length === 1 ? "variante" : "variantes"}` : "Guardar opciones"}</Button>
              )}
              <span className="text-xs text-muted-foreground">{combos.length} {combos.length === 1 ? "combinación" : "combinaciones"} · máximo {MAX_VARIANTES}</span>
            </div>
          </div>

          {variantes.length > 0 && (
            <>
              <div className="flex flex-wrap items-end gap-2 rounded-lg bg-muted/60 p-3">
                <p className="w-full text-xs font-bold uppercase tracking-wide text-muted-foreground">Aplicar a {sel.size ? `${sel.size} seleccionadas` : "todas"}</p>
                <Input aria-label="Precio para varias" inputMode="decimal" placeholder={`Precio (${money(precioBase)})`} value={masivo.precio} onChange={(e) => setMasivo({ ...masivo, precio: e.target.value })} className="h-9 w-36 bg-background" />
                <Input aria-label="Costo para varias" inputMode="decimal" placeholder="Costo" value={masivo.costo} onChange={(e) => setMasivo({ ...masivo, costo: e.target.value })} className="h-9 w-28 bg-background" />
                <Input aria-label="Stock para varias" inputMode="numeric" placeholder="Stock" value={masivo.stock} onChange={(e) => setMasivo({ ...masivo, stock: e.target.value })} className="h-9 w-28 bg-background" />
                <Button type="button" size="sm" variant="outline" className="bg-background" disabled={busy} onClick={aplicarMasivo}>Aplicar</Button>
              </div>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full min-w-[860px] text-sm">
                  <thead className="bg-muted/60 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground">
                    <tr>
                      <th className="w-8 px-3 py-2"><input type="checkbox" aria-label="Seleccionar todas" className="h-4 w-4 accent-primary" checked={sel.size === variantes.length} onChange={(e) => setSel(e.target.checked ? new Set(variantes.map((v) => v.id)) : new Set())} /></th>
                      <th className="px-2 py-2">Variante</th><th className="px-2 py-2">Precio</th><th className="px-2 py-2">Costo</th><th className="px-2 py-2">Stock</th><th className="px-2 py-2">Mínimo</th><th className="px-2 py-2">SKU</th><th className="px-2 py-2">Cód. barras</th><th className="px-2 py-2">Se vende</th><th className="w-10" />
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {variantes.map((v) => {
                      const sobra = sobrantes.includes(v);
                      return (
                        <tr key={v.id} className={cn(sel.has(v.id) && "bg-primary/5", !v.disponible && "text-muted-foreground")}>
                          <td className="px-3 py-1.5"><input type="checkbox" aria-label={`Seleccionar ${v.nombre}`} className="h-4 w-4 accent-primary" checked={sel.has(v.id)} onChange={() => setSel((s) => { const n = new Set(s); if (n.has(v.id)) n.delete(v.id); else n.add(v.id); return n; })} /></td>
                          <td className="px-2 py-1.5"><span className="font-semibold">{v.nombre}</span>{sobra && <span className="ml-1.5 rounded bg-warning/20 px-1.5 text-[10px] font-bold">fuera de las opciones</span>}</td>
                          <td className="px-2 py-1.5"><Input defaultValue={v.precio ?? ""} key={`p${v.precio}`} inputMode="decimal" aria-label={`Precio de ${v.nombre}`} placeholder={String(precioBase)} className="h-8 w-24" onBlur={(e) => { const n = numero(e.target.value); if (Number.isNaN(n)) { toast.error("Precio inválido"); e.target.value = v.precio == null ? "" : String(v.precio); return; } if (n !== (v.precio == null ? null : Number(v.precio))) guardar(v, { precio: n }); }} /></td>
                          <td className="px-2 py-1.5"><Input defaultValue={v.costo ?? ""} key={`c${v.costo}`} inputMode="decimal" aria-label={`Costo de ${v.nombre}`} placeholder="—" className="h-8 w-24" onBlur={(e) => { const n = numero(e.target.value); if (Number.isNaN(n)) return; if (n !== (v.costo == null ? null : Number(v.costo))) guardar(v, { costo: n }); }} /></td>
                          <td className="px-2 py-1.5"><Input defaultValue={v.stock ?? ""} key={`s${v.stock}`} inputMode="numeric" aria-label={`Stock de ${v.nombre}`} placeholder="Sin control" className="h-8 w-24" onBlur={async (e) => {
                            const n = numero(e.target.value);
                            if (Number.isNaN(n) || (n != null && !Number.isInteger(n))) { toast.error("Stock inválido"); e.target.value = v.stock == null ? "" : String(v.stock); return; }
                            if (n === v.stock) return;
                            await run(db.rpc("catalogo_edicion_rapida", { p_comercio: storeId, p_cambios: [{ id: productId, variante: v.id, stock: n }] }));
                          }} /></td>
                          <td className="px-2 py-1.5"><Input defaultValue={v.stock_minimo ?? ""} key={`m${v.stock_minimo}`} inputMode="numeric" aria-label={`Stock mínimo de ${v.nombre}`} placeholder="—" className="h-8 w-20" onBlur={(e) => { const n = numero(e.target.value); if (Number.isNaN(n)) return; const ent = n == null ? null : Math.floor(n); if (ent !== (v.stock_minimo ?? null)) guardar(v, { stock_minimo: ent }); }} /></td>
                          <td className="px-2 py-1.5"><Input defaultValue={v.sku ?? ""} key={`k${v.sku}`} maxLength={40} aria-label={`SKU de ${v.nombre}`} placeholder="—" className="h-8 w-28" onBlur={(e) => { const t = e.target.value.trim(); if ((t || null) !== (v.sku ?? null)) guardar(v, { sku: t || null }); }} /></td>
                          <td className="px-2 py-1.5"><Input defaultValue={v.codigo_barras ?? ""} key={`b${v.codigo_barras}`} maxLength={32} aria-label={`Código de barras de ${v.nombre}`} placeholder="—" className="h-8 w-32" onBlur={(e) => { const t = e.target.value.trim(); if ((t || null) === (v.codigo_barras ?? null)) return; if (t && !/^[0-9A-Za-z-]{4,32}$/.test(t)) { toast.error("Código de barras inválido"); e.target.value = v.codigo_barras ?? ""; return; } guardar(v, { codigo_barras: t || null }); }} /></td>
                          <td className="px-2 py-1.5"><Switch checked={v.disponible} onCheckedChange={(c) => guardar(v, { disponible: c })} aria-label={`Se vende ${v.nombre}`} /></td>
                          <td className="px-1 py-1.5"><Button type="button" size="icon" variant="ghost" className="h-8 w-8" aria-label={`Eliminar ${v.nombre}`} onClick={() => borrar(v)}><Trash2 className="h-4 w-4" /></Button></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              <p className="text-xs text-muted-foreground">Precio vacío: usa el del producto. Stock vacío: sin control. El stock se descuenta por variante al vender y vuelve si el pedido se cancela; cada cambio queda en el historial de inventario.</p>
            </>
          )}
        </>
      )}
    </div>
  );
}
