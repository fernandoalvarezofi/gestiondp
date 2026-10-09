import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { DeliveryProduct, ESTADO_PRODUCTO, EstadoProducto, formatDateTime, money } from "@/lib/delivery";
import { CAMPO_CAMBIO, CambioProducto, fetchCambios } from "@/services/catalogPro";

const MONEDA = new Set(["precio", "precio_anterior", "costo", "precio_promo"]);
const FECHA = new Set(["promo_desde", "promo_hasta"]);
/** Valor legible de un cambio: montos con $, fechas, estados y sí/no. */
export function valorCambio(campo: string, v: string | null): string {
  if (v == null || v === "") return "—";
  if (MONEDA.has(campo)) return money(Number(v));
  if (FECHA.has(campo)) return formatDateTime(v);
  if (campo === "estado") return ESTADO_PRODUCTO[v as EstadoProducto]?.texto ?? v;
  if (v === "true") return "Sí";
  if (v === "false") return "No";
  return v;
}

/** Historial de cambios relevantes de un producto (precio, costo, estado, SKU…), con fecha y si lo hizo el equipo o el sistema. */
export function ProductHistoryDialog({ storeId, product, onClose }: { storeId: string; product: DeliveryProduct | null; onClose: () => void }) {
  const [rows, setRows] = useState<CambioProducto[] | null>(null);
  useEffect(() => { if (!product) return; setRows(null); fetchCambios(storeId, product.id).then(setRows).catch(() => setRows([])); }, [storeId, product]);
  if (!product) return null;
  return (
    <Dialog open onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
        <DialogTitle className="flex items-center gap-2 text-xl font-extrabold"><History className="h-5 w-5 text-primary" />Historial de cambios</DialogTitle>
        <DialogDescription>{product.nombre}. Los cambios de stock están en el historial de stock de cada producto.</DialogDescription>
        {!rows ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-primary" /> : rows.length === 0 ? <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Todavía no hay cambios registrados.</p> : (
          <ol className="divide-y rounded-2xl border text-sm">
            {rows.map((r) => (
              <li key={r.id} className="p-3">
                <p><span className="font-bold">{CAMPO_CAMBIO[r.campo] ?? r.campo}</span>{r.variante_id && <span className="text-muted-foreground"> · {r.producto_nombre.split(" · ").slice(1).join(" · ")}</span>}: <span className="text-muted-foreground line-through">{valorCambio(r.campo, r.antes)}</span> → <span className="font-semibold">{valorCambio(r.campo, r.despues)}</span></p>
                <p className="text-xs text-muted-foreground">{formatDateTime(r.fecha)} · {r.usuario_id ? "Equipo" : "Automático (oferta o publicación programada)"}</p>
              </li>
            ))}
          </ol>
        )}
      </DialogContent>
    </Dialog>
  );
}
