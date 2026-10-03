import { useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { downloadCsv, toCsv } from "@/lib/csv";
import { db, errorMessage, formatDateTime, metodoPagoLabel, money, shortId } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export type Settlement = {
  id: string; desde: string; hasta: string; pedidos: number; ventas: number; descuentos_comercio: number; comision_pct: number; comision: number;
  neto: number; cobrado_directo: number; balance: number; estado: "pendiente" | "pagada"; referencia?: string | null; pagada_at?: string | null; created_at: string;
  comercio?: { nombre: string } | null; comercio_id?: string;
};
type Line = { pedido_id: string; fecha: string; tipo_entrega: string; metodo_pago: string; ventas: number; descuento_comercio: number; comision: number; neto: number; cobrado_directo: number; balance: number };

const day = (value: string) => new Date(value).toLocaleDateString("es-AR", { timeZone: "America/Argentina/Buenos_Aires", day: "2-digit", month: "2-digit", year: "2-digit" });
export const periodLabel = (item: Pick<Settlement, "desde" | "hasta">) => `${day(item.desde)} al ${day(item.hasta)}`;

/** Detalle de una liquidación, pedido por pedido, con descarga en CSV. */
export function SettlementDetail({ settlement, open, onOpenChange, title }: { settlement: Settlement | null; open: boolean; onOpenChange: (open: boolean) => void; title?: string }) {
  const [lines, setLines] = useState<Line[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open || !settlement) return;
    let active = true;
    setLines(null);
    setError(null);
    db.rpc("delivery_liquidacion_detalle", { p_liquidacion: settlement.id }).then(({ data, error: failure }: { data: Line[] | null; error: unknown }) => {
      if (!active) return;
      if (failure) setError(errorMessage(failure)); else setLines(data || []);
    });
    return () => { active = false; };
  }, [open, settlement]);

  const download = () => {
    if (!settlement || !lines) return;
    const csv = toCsv(
      ["Pedido", "Fecha", "Tipo", "Pago", "Ventas", "Descuento del comercio", "Comisión", "Neto", "Cobrado en mano", "Balance"],
      lines.map((line) => [shortId(line.pedido_id), formatDateTime(line.fecha), line.tipo_entrega === "retiro" ? "Retiro" : "Envío", metodoPagoLabel[line.metodo_pago as keyof typeof metodoPagoLabel] ?? line.metodo_pago, line.ventas, line.descuento_comercio, line.comision, line.neto, line.cobrado_directo, line.balance]),
    );
    downloadCsv(`liquidacion-${day(settlement.desde).replace(/\//g, "-")}-${settlement.id.slice(0, 6)}.csv`, csv);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-y-auto">
        <DialogTitle className="text-xl font-black">Liquidación {settlement ? periodLabel(settlement) : ""}</DialogTitle>
        <DialogDescription>{title ?? ""}{settlement && ` ${settlement.pedidos} pedidos · comisión ${settlement.comision_pct}%`}</DialogDescription>
        {error && <p className="rounded-xl bg-destructive/10 p-3 text-sm text-destructive">{error}</p>}
        {!lines && !error && <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>}
        {lines && (
          <>
            <div className="overflow-x-auto rounded-2xl border">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="border-b bg-muted/50 text-left text-muted-foreground"><tr><th className="p-2.5">Pedido</th><th className="p-2.5">Fecha</th><th className="p-2.5">Tipo</th><th className="p-2.5 text-right">Ventas</th><th className="p-2.5 text-right">Comisión</th><th className="p-2.5 text-right">Neto</th><th className="p-2.5 text-right">Cobrado en mano</th><th className="p-2.5 text-right">Balance</th></tr></thead>
                <tbody className="divide-y">
                  {lines.map((line) => (
                    <tr key={line.pedido_id}>
                      <td className="p-2.5 font-bold">{shortId(line.pedido_id)}</td>
                      <td className="p-2.5">{formatDateTime(line.fecha)}</td>
                      <td className="p-2.5">{line.tipo_entrega === "retiro" ? "Retiro" : "Envío"} · {metodoPagoLabel[line.metodo_pago as keyof typeof metodoPagoLabel] ?? line.metodo_pago}</td>
                      <td className="p-2.5 text-right tabular-nums">{money(line.ventas)}</td>
                      <td className="p-2.5 text-right tabular-nums">−{money(line.comision)}</td>
                      <td className="p-2.5 text-right tabular-nums">{money(line.neto)}</td>
                      <td className="p-2.5 text-right tabular-nums">{Number(line.cobrado_directo) ? money(line.cobrado_directo) : "—"}</td>
                      <td className={cn("p-2.5 text-right font-bold tabular-nums", Number(line.balance) < 0 && "text-destructive")}>{money(line.balance)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <Button variant="outline" className="w-fit rounded-full" onClick={download}><Download className="h-4 w-4" />Descargar CSV</Button>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
