import { KeyboardEvent, useMemo, useState } from "react";
import { Loader2, Undo2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { useAvisoSalida } from "@/hooks/useAvisoSalida";
import { db, DeliveryProduct, errorMessage, img, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Campo = "precio" | "precio_anterior" | "stock" | "disponible" | "estado";
type Cambio = Partial<Record<Campo, string | boolean>>;
type Fila = { clave: string; producto: DeliveryProduct; variante?: NonNullable<DeliveryProduct["variantes"]>[number]; esPadre?: boolean };

const ESTADOS = [{ id: "publicado", texto: "Publicado" }, { id: "borrador", texto: "Borrador" }, { id: "archivado", texto: "Archivado" }];
const num = (s: string) => { const t = s.trim().replace(/\./g, "").replace(",", "."); return t === "" ? null : Number(t); };

/**
 * Edición rápida en tabla: precio, precio anterior, stock, disponibilidad y estado de muchos productos (y de cada variante) sin abrir
 * cada ficha. Los cambios se marcan en la tabla y se guardan juntos en el servidor (todo o nada); el stock queda en el historial
 * de inventario. Enter baja a la fila siguiente en la misma columna.
 */
export function QuickEditTable({ storeId, products, onSaved }: { storeId: string; products: DeliveryProduct[]; onSaved: () => void }) {
  const [cambios, setCambios] = useState<Record<string, Cambio>>({});
  const [guardando, setGuardando] = useState(false);
  const n = Object.keys(cambios).length;
  useAvisoSalida(n > 0);

  const filas = useMemo<Fila[]>(() => products.flatMap((p) => (p.usa_variantes && p.variantes?.length
    ? [{ clave: p.id, producto: p, esPadre: true }, ...[...p.variantes].sort((a, b) => a.orden - b.orden).map((v) => ({ clave: `${p.id}:${v.id}`, producto: p, variante: v }))]
    : [{ clave: p.id, producto: p }])), [products]);

  const original = (f: Fila, campo: Campo): string | boolean => {
    const p = f.producto, v = f.variante;
    if (campo === "precio") return String(v ? v.precio ?? p.precio : p.precio);
    if (campo === "precio_anterior") return p.precio_anterior != null ? String(p.precio_anterior) : "";
    if (campo === "stock") { const s = v ? v.stock : p.stock; return s == null ? "" : String(s); }
    if (campo === "disponible") return v ? v.disponible : p.disponible !== false;
    return p.estado ?? "publicado";
  };
  const valor = (f: Fila, campo: Campo) => cambios[f.clave]?.[campo] ?? original(f, campo);
  const set = (f: Fila, campo: Campo, v: string | boolean) => setCambios((c) => {
    const actual = { ...(c[f.clave] ?? {}) };
    if (String(v) === String(original(f, campo))) delete actual[campo]; else actual[campo] = v;
    const next = { ...c };
    if (Object.keys(actual).length) next[f.clave] = actual; else delete next[f.clave];
    return next;
  });

  // Errores por celda antes de mandar nada al servidor.
  const errorDe = (f: Fila, campo: Campo): string | null => {
    const c = cambios[f.clave];
    if (!c || !(campo in c) && !(campo === "precio_anterior" && "precio" in c)) return null;
    if (campo === "precio") { const x = num(String(valor(f, "precio"))); return x == null || !Number.isFinite(x) || x < 0 ? "Precio inválido" : null; }
    if (campo === "stock") { const x = num(String(valor(f, "stock"))); return x != null && (!Number.isInteger(x) || x < 0) ? "Entero desde 0, o vacío" : null; }
    if (campo === "precio_anterior") {
      const a = num(String(valor(f, "precio_anterior"))), p = num(String(valor(f, "precio")));
      if (a == null) return null;
      return !Number.isFinite(a) || (p != null && a <= p) ? "Tiene que ser mayor que el precio" : null;
    }
    return null;
  };
  const errores = filas.flatMap((f) => (["precio", "precio_anterior", "stock"] as Campo[]).map((c) => errorDe(f, c)).filter(Boolean));

  const guardar = async () => {
    if (errores.length) { toast.error("Revisá las celdas marcadas en rojo"); return; }
    const lista = Object.entries(cambios).map(([clave, c]) => {
      const [id, variante] = clave.split(":");
      const out: Record<string, unknown> = { id, ...(variante ? { variante } : {}) };
      if ("precio" in c) out.precio = num(String(c.precio));
      if ("precio_anterior" in c) out.precio_anterior = num(String(c.precio_anterior));
      if ("stock" in c) out.stock = num(String(c.stock));
      if ("disponible" in c) out.disponible = c.disponible;
      if ("estado" in c) out.estado = c.estado;
      return out;
    });
    setGuardando(true);
    const { data, error } = await db.rpc("catalogo_edicion_rapida", { p_comercio: storeId, p_cambios: lista });
    setGuardando(false);
    if (error) { toast.error(errorMessage(error, "No pudimos guardar los cambios")); return; }
    toast.success(`Guardamos ${data} ${data === 1 ? "cambio" : "cambios"}`);
    setCambios({});
    onSaved();
  };

  const bajar = (e: KeyboardEvent<HTMLInputElement | HTMLSelectElement>) => {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const el = e.currentTarget;
    const col = el.dataset.col, fila = Number(el.dataset.fila);
    const siguiente = document.querySelector<HTMLElement>(`[data-col="${col}"][data-fila="${fila + 1}"]`);
    siguiente?.focus();
    if (siguiente instanceof HTMLInputElement) siguiente.select();
  };
  const celda = (f: Fila, i: number, campo: "precio" | "precio_anterior" | "stock", deshabilitado = false, ayuda?: string) => {
    const err = errorDe(f, campo);
    const cambiado = cambios[f.clave] && campo in cambios[f.clave]!;
    return (
      <td className="px-2 py-1.5">
        <input data-col={campo} data-fila={i} value={String(valor(f, campo))} disabled={deshabilitado} title={err ?? ayuda} aria-invalid={Boolean(err)} inputMode={campo === "stock" ? "numeric" : "decimal"}
          aria-label={`${campo === "precio" ? "Precio" : campo === "stock" ? "Stock" : "Precio anterior"} de ${f.producto.nombre}${f.variante ? ` ${f.variante.nombre}` : ""}`}
          placeholder={campo === "stock" ? "Sin control" : campo === "precio_anterior" ? "—" : ""} onKeyDown={bajar} onChange={(e) => set(f, campo, e.target.value)}
          className={cn("h-8 w-full min-w-[84px] rounded-md border bg-background px-2 text-right tabular-nums outline-none focus:ring-2 focus:ring-ring/30 disabled:cursor-not-allowed disabled:bg-muted/50 disabled:text-muted-foreground",
            cambiado && "border-brand-yellow bg-brand-yellow/10", err && "border-destructive bg-destructive/5")} />
      </td>
    );
  };

  return (
    <div className="mt-4">
      <div className="overflow-x-auto rounded-xl border bg-card">
        <table className="w-full min-w-[760px] text-sm">
          <thead className="sticky top-0 z-10 bg-muted/70 text-left text-xs font-bold uppercase tracking-wide text-muted-foreground backdrop-blur">
            <tr>
              <th className="px-3 py-2.5">Producto</th><th className="px-2 py-2.5 text-right">Precio</th><th className="px-2 py-2.5 text-right">Precio anterior</th>
              <th className="px-2 py-2.5 text-right">Stock</th><th className="px-2 py-2.5 text-center">Disponible</th><th className="px-2 py-2.5">Estado</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {filas.map((f, i) => {
              const p = f.producto;
              const promo = Boolean(p.promo_activa) && !f.variante;
              if (f.esPadre) {
                return (
                  <tr key={f.clave} className="bg-muted/30">
                    <td className="px-3 py-2" colSpan={4}><span className="flex items-center gap-2.5">{p.imagen_url ? <img src={img(p.imagen_url, 80)} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="h-8 w-8 rounded bg-muted" />}<span className="font-bold">{p.nombre}</span><span className="text-xs text-muted-foreground">{p.variantes?.length} variantes · {p.categoria}</span></span></td>
                    <td className="px-2 py-2 text-center"><input type="checkbox" className="h-4 w-4 accent-primary" checked={Boolean(valor(f, "disponible"))} onChange={(e) => set(f, "disponible", e.target.checked)} aria-label={`Disponible: ${p.nombre}`} /></td>
                    <td className="px-2 py-2">{selectorEstado(f, i)}</td>
                  </tr>
                );
              }
              return (
                <tr key={f.clave} className={cn(cambios[f.clave] && "bg-brand-yellow/[0.04]")}>
                  <td className="px-3 py-1.5">
                    {f.variante ? <span className="pl-10 text-[13px]">{f.variante.nombre}</span> : (
                      <span className="flex items-center gap-2.5">{p.imagen_url ? <img src={img(p.imagen_url, 80)} alt="" className="h-8 w-8 rounded object-cover" /> : <span className="h-8 w-8 rounded bg-muted" />}
                        <span className="min-w-0"><span className="block truncate font-semibold">{p.nombre}</span><span className="block truncate text-xs text-muted-foreground">{p.categoria}{p.sku ? ` · ${p.sku}` : ""}{promo ? ` · en oferta (${money(p.precio)})` : ""}</span></span></span>
                    )}
                  </td>
                  {celda(f, i, "precio", promo, promo ? "Tiene una oferta activa: cambiá el precio desde su ficha" : undefined)}
                  {f.variante ? <td className="px-2 py-1.5 text-right text-xs text-muted-foreground">—</td> : celda(f, i, "precio_anterior", promo)}
                  {celda(f, i, "stock")}
                  <td className="px-2 py-1.5 text-center"><input type="checkbox" className="h-4 w-4 accent-primary" checked={Boolean(valor(f, "disponible"))} onChange={(e) => set(f, "disponible", e.target.checked)} aria-label={`Disponible: ${p.nombre}${f.variante ? ` ${f.variante.nombre}` : ""}`} /></td>
                  <td className="px-2 py-1.5">{f.variante ? null : selectorEstado(f, i)}</td>
                </tr>
              );
            })}
            {filas.length === 0 && <tr><td colSpan={6} className="px-3 py-10 text-center text-muted-foreground">No hay productos con este filtro.</td></tr>}
          </tbody>
        </table>
      </div>
      {n > 0 && (
        <div className="sticky bottom-3 z-20 mt-3 flex flex-wrap items-center gap-2 rounded-xl border bg-card p-2 pl-4 shadow-pop">
          <span className="text-sm font-bold">{n} {n === 1 ? "producto modificado" : "productos modificados"}</span>
          {errores.length > 0 && <span className="text-sm font-semibold text-destructive">{errores.length} {errores.length === 1 ? "celda con error" : "celdas con error"}</span>}
          <Button variant="ghost" className="ml-auto rounded-full" disabled={guardando} onClick={() => setCambios({})}><Undo2 className="h-4 w-4" />Descartar</Button>
          <Button className="rounded-full font-bold" disabled={guardando || errores.length > 0} onClick={guardar}>{guardando && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cambios</Button>
        </div>
      )}
    </div>
  );

  function selectorEstado(f: Fila, i: number) {
    return (
      <select data-col="estado" data-fila={i} value={String(valor(f, "estado"))} onKeyDown={bajar} onChange={(e) => set(f, "estado", e.target.value)} aria-label={`Estado de ${f.producto.nombre}`}
        className={cn("h-8 rounded-md border bg-background px-2 text-sm", cambios[f.clave]?.estado !== undefined && "border-brand-yellow bg-brand-yellow/10")}>
        {ESTADOS.map((e) => <option key={e.id} value={e.id}>{e.texto}</option>)}
        {f.producto.estado === "programado" && <option value="programado" disabled>Programado</option>}
      </select>
    );
  }
}
