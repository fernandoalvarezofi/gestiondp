import { useCallback, useEffect, useState } from "react";
import { BadgeCheck, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Stars } from "@/components/market/Stars";
import { formatDateTime } from "@/lib/delivery";
import { fetchOpiniones, OpinionesDeProducto, OpinionProducto, porcentajeBarra, promedioTexto } from "@/services/reviews";

/** Opiniones de un producto: promedio, distribución por estrellas y comentarios (solo de compradores). Se muestra en la ficha. */
export function ProductReviews({ productId, onResumen }: { productId: string; onResumen?: (promedio: number | null, cantidad: number) => void }) {
  const [data, setData] = useState<OpinionesDeProducto | null>(null);
  const [items, setItems] = useState<OpinionProducto[]>([]);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    try { const d = await fetchOpiniones(productId, 0); setData(d); setItems(d.items); setError(false); onResumen?.(d.resumen.promedio, d.resumen.cantidad); } catch { setError(true); }
  }, [productId]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { setData(null); load(); }, [load]);

  const verMas = async () => {
    setLoadingMore(true);
    try { const d = await fetchOpiniones(productId, items.length); setItems((actual) => [...actual, ...d.items.filter((n) => !actual.some((a) => a.id === n.id))]); } catch { setError(true); } finally { setLoadingMore(false); }
  };

  if (error && !data) return null;
  if (!data) return <div className="h-24 animate-pulse rounded-2xl bg-muted" aria-hidden />;
  const { resumen } = data;

  return (
    <section id="opiniones" aria-label="Opiniones del producto" className="scroll-mt-24">
      <h2 className="text-xl font-extrabold sm:text-2xl">Opiniones del producto</h2>
      {resumen.cantidad === 0 ? (
        <p className="mt-4 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Todavía no hay opiniones. Pueden dejarla quienes compraron y recibieron este producto.</p>
      ) : (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-6">
            <div className="text-center"><p className="font-display text-5xl font-black tabular-nums">{promedioTexto(resumen.promedio)}</p><Stars value={Number(resumen.promedio)} size={18} className="mt-1" /><p className="mt-1 text-sm text-muted-foreground">{resumen.cantidad} {resumen.cantidad === 1 ? "opinión" : "opiniones"}</p></div>
            <ul className="min-w-[200px] flex-1 space-y-1.5" aria-label="Distribución de puntajes">
              {([5, 4, 3, 2, 1] as const).map((n) => (
                <li key={n} className="flex items-center gap-2 text-sm">
                  <span className="w-3 text-right font-semibold tabular-nums">{n}</span>
                  <span className="h-2 flex-1 overflow-hidden rounded-full bg-muted"><span className="block h-full rounded-full bg-[#F5A524]" style={{ width: `${porcentajeBarra(resumen.distribucion[String(n) as "1"] ?? 0, resumen.cantidad)}%` }} /></span>
                  <span className="w-8 text-xs text-muted-foreground tabular-nums">{resumen.distribucion[String(n) as "1"] ?? 0}</span>
                </li>
              ))}
            </ul>
          </div>
          <ul className="mt-6 divide-y rounded-2xl border bg-card">
            {items.map((o) => (
              <li key={o.id} className="space-y-1.5 p-4 text-sm">
                <div className="flex flex-wrap items-center justify-between gap-2"><Stars value={o.puntaje} size={15} /><span className="text-xs text-muted-foreground">{formatDateTime(o.created_at)}</span></div>
                {o.comentario && <p className="leading-relaxed">{o.comentario}</p>}
                <p className="flex items-center gap-1 text-xs text-muted-foreground"><span className="font-semibold text-foreground">{o.autor}</span><BadgeCheck className="h-3.5 w-3.5 text-success" aria-hidden />Compra verificada</p>
                {o.respuesta && <p className="rounded-xl bg-muted p-3"><span className="font-bold">Respuesta del vendedor: </span>{o.respuesta}</p>}
              </li>
            ))}
          </ul>
          {items.length < resumen.cantidad && <div className="mt-4 flex justify-center"><Button variant="outline" className="rounded-full" onClick={verMas} disabled={loadingMore}>{loadingMore && <Loader2 className="h-4 w-4 animate-spin" />}Ver más opiniones</Button></div>}
        </>
      )}
    </section>
  );
}
