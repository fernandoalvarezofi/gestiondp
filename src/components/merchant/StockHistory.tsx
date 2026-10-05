import { useEffect, useState } from "react";
import { History, Loader2 } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { cn } from "@/lib/utils";

type Movimiento = { id: number; fecha: string; producto: string; variante: string | null; delta: number | null; stock_antes: number | null; stock_despues: number | null; motivo: string };

export const MOTIVO_STOCK: Record<string, string> = {
  alta: "Stock inicial", venta: "Venta", cancelacion: "Pedido cancelado (se devolvió)", impago: "Pedido sin pagar (se devolvió)",
  vencido: "Pedido sin respuesta (se devolvió)", ajuste_pedido: "Ajuste por falta de stock", ajuste: "Ajuste manual",
};

/** Historial de movimientos de stock de un producto: quién, cuándo, cuánto y por qué. Lo ve quien puede editar el catálogo del local. */
export function StockHistoryButton({ storeId, productId }: { storeId: string; productId: string }) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Movimiento[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setRows(null); setError(null);
    db.rpc("delivery_inventario_movimientos", { p_comercio: storeId, p_producto: productId, p_limite: 100 }).then(({ data, error: failure }: { data: Movimiento[] | null; error: unknown }) => {
      if (failure) setError(errorMessage(failure, "No pudimos cargar el historial"));
      else setRows(data ?? []);
    });
  }, [open, storeId, productId]);

  return (
    <>
      <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => setOpen(true)}><History className="h-4 w-4" />Historial de stock</Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[85vh] max-w-lg overflow-y-auto">
          <DialogTitle className="text-xl font-extrabold">Historial de stock</DialogTitle>
          <DialogDescription>Cada cambio queda registrado y no se puede borrar.</DialogDescription>
          {error ? <p className="rounded-xl bg-destructive/10 p-3 text-sm font-semibold text-destructive">{error}</p>
            : !rows ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
            : rows.length === 0 ? <p className="rounded-xl bg-muted p-3 text-sm text-muted-foreground">Todavía no hay movimientos. Se registran cuando el producto tiene stock cargado.</p>
            : (
              <ul className="divide-y rounded-2xl border">
                {rows.map((row) => (
                  <li key={row.id} className="flex items-center gap-3 p-3 text-sm">
                    <span className="min-w-0 flex-1">
                      <span className="block font-bold">{MOTIVO_STOCK[row.motivo] ?? row.motivo}{row.variante && <span className="font-semibold text-muted-foreground"> · {row.variante}</span>}</span>
                      <span className="block text-xs text-muted-foreground">{formatDateTime(row.fecha)} · {row.stock_antes ?? "∞"} → {row.stock_despues ?? "∞"}</span>
                    </span>
                    {row.delta != null && <span className={cn("shrink-0 text-base font-black tabular-nums", row.delta > 0 ? "text-success" : "text-destructive")}>{row.delta > 0 ? "+" : ""}{row.delta}</span>}
                  </li>
                ))}
              </ul>
            )}
        </DialogContent>
      </Dialog>
    </>
  );
}
