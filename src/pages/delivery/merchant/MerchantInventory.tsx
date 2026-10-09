import { FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Boxes, Loader2, PackageSearch, Search } from "lucide-react";
import { toast } from "sonner";
import { MOTIVO_STOCK } from "@/components/merchant/StockHistory";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { DeliveryProduct, errorMessage, formatDateTime, img, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { ajustarStock, fetchMovimientos, fetchResumenCatalogo, MotivoAjuste, MOTIVOS_AJUSTE, Movimiento, ResumenCatalogo } from "@/services/catalogPro";
import { useMerchant } from "./context";

type Fila = { key: string; producto: DeliveryProduct; varianteId: string | null; nombre: string; sku: string | null; stock: number | null; minimo: number | null; costo: number | null };

/** Inventario del local: alertas de stock bajo, valor del inventario, ajustes con motivo y movimientos auditables. */
export default function MerchantInventory() {
  const { store, products, loadProducts } = useMerchant();
  const [resumen, setResumen] = useState<ResumenCatalogo | null>(null);
  const [movs, setMovs] = useState<Movimiento[] | null>(null);
  const [vista, setVista] = useState<"alertas" | "todo" | "movimientos">("alertas");
  const [busca, setBusca] = useState("");
  const [ajuste, setAjuste] = useState<Fila | null>(null);

  const load = useCallback(() => {
    fetchResumenCatalogo(store.id).then(setResumen);
    fetchMovimientos(store.id, 150).then(setMovs).catch(() => setMovs([]));
  }, [store.id]);
  useEffect(() => { load(); }, [load]);

  // Una fila por producto simple o por variante, solo de lo que lleva stock.
  const filas = useMemo<Fila[]>(() => products.filter((p) => (p.estado ?? "publicado") !== "archivado").flatMap((p) => (p.usa_variantes
    ? (p.variantes ?? []).map((v) => ({ key: v.id, producto: p, varianteId: v.id, nombre: `${p.nombre} · ${v.nombre}`, sku: v.sku, stock: v.stock, minimo: v.stock_minimo ?? p.stock_minimo ?? null, costo: v.costo ?? p.costo ?? null }))
    : [{ key: p.id, producto: p, varianteId: null, nombre: p.nombre, sku: p.sku ?? null, stock: p.stock ?? null, minimo: p.stock_minimo ?? null, costo: p.costo ?? null }])), [products]);
  const bajo = (f: Fila) => f.stock != null && (f.stock === 0 || (f.minimo != null && f.stock <= f.minimo));
  const q = busca.trim().toLowerCase();
  const visibles = filas.filter((f) => (vista === "alertas" ? bajo(f) : true) && (!q || `${f.nombre} ${f.sku ?? ""}`.toLowerCase().includes(q)))
    .sort((a, b) => (vista === "alertas" ? (a.stock ?? 0) - (b.stock ?? 0) : a.nombre.localeCompare(b.nombre, "es")));

  return (
    <div className="mx-auto max-w-5xl space-y-5">
      <div>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><Boxes className="h-6 w-6 text-primary" />Inventario</h1>
        <p className="text-sm text-muted-foreground">Stock de productos y variantes, alertas y cada movimiento con su motivo. Las ventas descuentan y las cancelaciones devuelven solas.</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Stock bajo o agotado", resumen ? String(filas.filter(bajo).length) : "…", "productos o variantes"],
          ["Valor del inventario", resumen ? money(resumen.valor_inventario) : "…", "a costo (si lo cargaste)"],
          ["Publicados", resumen ? String(resumen.publicados) : "…", `${resumen?.agotados ?? 0} agotados`],
          ["Sin foto", resumen ? String(resumen.sin_foto) : "…", "se venden menos"],
        ].map(([k, v, s]) => <div key={k} className="rounded-3xl border bg-card p-4"><dt className="text-xs font-bold text-muted-foreground">{k}</dt><dd className="mt-1 text-2xl font-black tabular-nums">{v}</dd><p className="text-xs text-muted-foreground">{s}</p></div>)}
      </dl>
      <div className="flex flex-wrap items-center gap-2">
        <div role="tablist" aria-label="Vista" className="flex rounded-full border bg-card p-1">
          {([["alertas", "Alertas"], ["todo", "Todo el stock"], ["movimientos", "Movimientos"]] as const).map(([v, l]) => <button key={v} type="button" role="tab" aria-selected={vista === v} onClick={() => setVista(v)} className={cn("h-8 rounded-full px-3.5 text-sm font-bold", vista === v ? "bg-foreground text-background" : "hover:bg-muted")}>{l}</button>)}
        </div>
        {vista !== "movimientos" && <label className="flex h-9 min-w-[200px] flex-1 items-center gap-2 rounded-full border bg-card px-3 text-sm"><Search className="h-4 w-4 text-muted-foreground" /><input value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar por nombre o SKU" aria-label="Buscar en el inventario" className="min-w-0 flex-1 bg-transparent outline-none" /></label>}
      </div>

      {vista === "movimientos" ? (
        !movs ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /> : movs.length === 0 ? <p className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">Todavía no hay movimientos.</p> : (
          <div className="overflow-x-auto rounded-3xl border bg-card">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-muted/60 text-left text-xs font-bold text-muted-foreground"><tr><th className="px-3 py-2">Fecha</th><th className="px-3 py-2">Producto</th><th className="px-3 py-2">Motivo</th><th className="px-3 py-2 text-right">Cambio</th><th className="px-3 py-2 text-right">Queda</th></tr></thead>
              <tbody className="divide-y">
                {movs.map((m) => (
                  <tr key={m.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">{formatDateTime(m.fecha)}</td>
                    <td className="px-3 py-2 font-semibold">{m.producto}{m.variante && <span className="font-normal text-muted-foreground"> · {m.variante}</span>}</td>
                    <td className="px-3 py-2">{MOTIVO_STOCK[m.motivo] ?? m.motivo}{m.nota && <span className="block text-xs text-muted-foreground">{m.nota}</span>}</td>
                    <td className={cn("px-3 py-2 text-right font-bold tabular-nums", (m.delta ?? 0) < 0 ? "text-destructive" : "text-success")}>{m.delta == null ? "—" : m.delta > 0 ? `+${m.delta}` : m.delta}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{m.stock_despues ?? "∞"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      ) : visibles.length === 0 ? (
        <div className="rounded-3xl border border-dashed p-8 text-center text-sm text-muted-foreground">{vista === "alertas" ? <><PackageSearch className="mx-auto mb-2 h-7 w-7" />Nada por reponer. Configurá el “stock mínimo” de cada producto para recibir alertas.</> : "No hay productos con ese nombre."}</div>
      ) : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
          {visibles.map((f) => (
            <li key={f.key} className="flex items-center gap-3 p-3">
              <img src={img(f.producto.imagen_url, 120)} alt="" loading="lazy" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-bold">{f.nombre}</p>
                <p className="text-xs text-muted-foreground">{f.sku ? `SKU ${f.sku} · ` : ""}{f.minimo != null ? `mínimo ${f.minimo}` : "sin mínimo"}{f.costo != null ? ` · costo ${money(f.costo)}` : ""}</p>
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-sm font-black tabular-nums", f.stock == null ? "bg-muted text-muted-foreground" : bajo(f) ? "bg-destructive/10 text-destructive" : "bg-success/10 text-success")}>{f.stock == null ? "Ilimitado" : f.stock}{bajo(f) && <AlertTriangle className="ml-1 inline h-3.5 w-3.5" />}</span>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAjuste(f)}>Ajustar</Button>
            </li>
          ))}
        </ul>
      )}
      <AjusteDialog fila={ajuste} onClose={() => setAjuste(null)} onDone={() => { setAjuste(null); loadProducts(); load(); }} />
    </div>
  );
}

function AjusteDialog({ fila, onClose, onDone }: { fila: Fila | null; onClose: () => void; onDone: () => void }) {
  const [modo, setModo] = useState<"sumar" | "fijar">("sumar");
  const [cantidad, setCantidad] = useState("");
  const [motivo, setMotivo] = useState<MotivoAjuste>("recepcion");
  const [nota, setNota] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (fila) { setModo("sumar"); setCantidad(""); setMotivo("recepcion"); setNota(""); } }, [fila]);
  if (!fila) return null;
  const n = Math.trunc(Number(cantidad));
  const resultado = cantidad === "" || !Number.isFinite(n) ? null : modo === "fijar" ? n : (fila.stock ?? 0) + n;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (resultado == null) return toast.error("Escribí una cantidad");
    if (resultado < 0) return toast.error("El stock no puede quedar negativo");
    setBusy(true);
    try { const nuevo = await ajustarStock(fila.producto.id, fila.varianteId, modo, n, motivo, nota); toast.success(`Stock actualizado: ${nuevo}`); onDone(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(false); }
  };
  return (
    <Dialog open onOpenChange={(v) => !v && !busy && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle className="text-xl font-extrabold">Ajustar stock</DialogTitle>
        <DialogDescription>{fila.nombre} · hoy hay {fila.stock ?? "stock ilimitado"}.</DialogDescription>
        <form onSubmit={submit} className="space-y-3">
          <div className="flex rounded-full border p-1">{([["sumar", "Sumar o restar"], ["fijar", "Fijar lo contado"]] as const).map(([v, l]) => <button key={v} type="button" aria-pressed={modo === v} onClick={() => setModo(v)} className={cn("h-8 flex-1 rounded-full text-sm font-bold", modo === v ? "bg-foreground text-background" : "")}>{l}</button>)}</div>
          <div className="space-y-1.5"><Label htmlFor="aj-cant">{modo === "sumar" ? "Cantidad (negativa para restar)" : "Stock contado"}</Label><Input id="aj-cant" type="number" inputMode="numeric" value={cantidad} onChange={(e) => setCantidad(e.target.value)} autoFocus /></div>
          <div className="space-y-1.5"><Label htmlFor="aj-mot">Motivo</Label><select id="aj-mot" value={motivo} onChange={(e) => setMotivo(e.target.value as MotivoAjuste)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">{(Object.keys(MOTIVOS_AJUSTE) as MotivoAjuste[]).map((m) => <option key={m} value={m}>{MOTIVOS_AJUSTE[m]}</option>)}</select></div>
          <div className="space-y-1.5"><Label htmlFor="aj-nota">Nota (opcional)</Label><Input id="aj-nota" maxLength={200} value={nota} onChange={(e) => setNota(e.target.value)} placeholder="Remito 0001-234, proveedor…" /></div>
          {resultado != null && <p className={cn("rounded-xl p-2 text-sm font-bold", resultado < 0 ? "bg-destructive/10 text-destructive" : "bg-muted")}>Va a quedar: {resultado}</p>}
          <Button type="submit" className="w-full rounded-full" disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Guardar ajuste</Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
