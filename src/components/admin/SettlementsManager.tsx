import { useCallback, useEffect, useState } from "react";
import { FilePlus2, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PayoutForm } from "@/components/account/PayoutForm";
import { EmptyState, StatCard } from "@/components/delivery/Common";
import { periodLabel, Settlement, SettlementDetail } from "@/components/finance/SettlementDetail";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/ui/dialogos";

/** Liquidaciones de todos los comercios: generarlas, ver el detalle y marcar cuándo se saldaron. */
export function SettlementsManager() {
  const [rows, setRows] = useState<Settlement[] | null>(null);
  const [filter, setFilter] = useState<"pendiente" | "todas">("pendiente");
  const [generating, setGenerating] = useState(false);
  const [detail, setDetail] = useState<Settlement | null>(null);
  const [paying, setPaying] = useState<Settlement | null>(null);
  const [reference, setReference] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_liquidaciones").select("*, comercio:delivery_comercios(nombre)").order("created_at", { ascending: false }).limit(300);
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const generate = async () => {
    if (!(await confirmar({ titulo: "¿Cerrar el período de liquidación?", descripcion: "Se genera la liquidación de todos los comercios con pedidos entregados sin liquidar hasta este momento. Los pedidos incluidos ya no entran en la próxima.", confirmar: "Cerrar período" }))) return;
    setGenerating(true);
    const { data, error } = await db.rpc("delivery_admin_generar_todas", { p_hasta: new Date().toISOString() });
    setGenerating(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(data ? `Se generaron ${data} liquidaciones` : "No había pedidos sin liquidar");
    load();
  };
  const settle = async () => {
    if (!paying) return;
    setSaving(true);
    const { error } = await db.rpc("delivery_admin_marcar_liquidacion", { p_liquidacion: paying.id, p_referencia: reference.trim() || null });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Liquidación saldada");
    setPaying(null); setReference("");
    load();
  };

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const open = rows.filter((row) => row.estado === "pendiente");
  const toPay = open.filter((row) => Number(row.balance) > 0).reduce((total, row) => total + Number(row.balance), 0);
  const toCollect = open.filter((row) => Number(row.balance) < 0).reduce((total, row) => total + Math.abs(Number(row.balance)), 0);
  const visible = filter === "pendiente" ? open : rows;

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="A pagar a comercios" value={money(toPay)} hint={`${open.filter((row) => Number(row.balance) > 0).length} liquidaciones pendientes`} />
        <StatCard label="A cobrar a comercios" value={money(toCollect)} hint={`${open.filter((row) => Number(row.balance) < 0).length} liquidaciones pendientes`} />
        <StatCard label="Comisión pendiente" value={money(open.reduce((total, row) => total + Number(row.comision), 0))} hint="De las liquidaciones sin saldar" />
        <div className="flex items-center rounded-2xl border border-dashed p-4"><Button className="w-full rounded-full" onClick={generate} disabled={generating}>{generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FilePlus2 className="h-4 w-4" />}Generar liquidaciones</Button></div>
      </div>

      <div className="flex gap-2">
        {(["pendiente", "todas"] as const).map((value) => <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-full border px-4 py-2 text-sm font-bold", filter === value ? "border-foreground bg-foreground text-background" : "bg-card")}>{value === "pendiente" ? `Pendientes (${open.length})` : "Todas"}</button>)}
      </div>

      {visible.length === 0 ? <EmptyState title={filter === "pendiente" ? "No hay liquidaciones pendientes" : "Todavía no hay liquidaciones"} text="Usá “Generar liquidaciones” para cerrar el período de los comercios con pedidos entregados." /> : (
        <div className="overflow-x-auto rounded-3xl border bg-card">
          <table className="w-full min-w-[820px] text-sm">
            <thead className="border-b text-left text-muted-foreground"><tr><th className="p-3">Comercio</th><th className="p-3">Período</th><th className="p-3 text-right">Pedidos</th><th className="p-3 text-right">Ventas</th><th className="p-3 text-right">Comisión</th><th className="p-3 text-right">Balance</th><th className="p-3">Estado</th><th className="p-3" /></tr></thead>
            <tbody className="divide-y">
              {visible.map((row) => (
                <tr key={row.id}>
                  <td className="p-3 font-bold">{row.comercio?.nombre ?? "—"}</td>
                  <td className="p-3">{periodLabel(row)}</td>
                  <td className="p-3 text-right tabular-nums">{row.pedidos}</td>
                  <td className="p-3 text-right tabular-nums">{money(row.ventas)}</td>
                  <td className="p-3 text-right tabular-nums">{money(row.comision)} <span className="text-xs text-muted-foreground">({row.comision_pct}%)</span></td>
                  <td className={cn("p-3 text-right font-bold tabular-nums", Number(row.balance) < 0 && "text-destructive")}>{money(Math.abs(Number(row.balance)))}<span className="block text-[11px] font-normal text-muted-foreground">{Number(row.balance) >= 0 ? "Pagar al comercio" : "Cobrar al comercio"}</span></td>
                  <td className="p-3"><span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", row.estado === "pagada" ? "bg-success/10 text-success" : "bg-warning/20")}>{row.estado === "pagada" ? "Saldada" : "Pendiente"}</span>{row.referencia && <span className="block text-[11px] text-muted-foreground">{row.referencia}</span>}{row.pagada_at && <span className="block text-[11px] text-muted-foreground">{formatDateTime(row.pagada_at)}</span>}</td>
                  <td className="space-x-1 p-3 text-right"><Button size="sm" variant="outline" className="rounded-full" onClick={() => setDetail(row)}>Detalle</Button>{row.estado === "pendiente" && <Button size="sm" className="rounded-full" onClick={() => { setPaying(row); setReference(""); }}>Saldar</Button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <SettlementDetail settlement={detail} open={Boolean(detail)} onOpenChange={(value) => !value && setDetail(null)} title={detail?.comercio?.nombre} />

      <Dialog open={Boolean(paying)} onOpenChange={(value) => !value && setPaying(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-xl font-black">Saldar liquidación</DialogTitle>
          <DialogDescription>{paying && `${paying.comercio?.nombre} · ${Number(paying.balance) >= 0 ? "Le pagaste" : "Le cobraste"} ${money(Math.abs(Number(paying.balance)))}`}</DialogDescription>
          {paying?.comercio_id && <div className="rounded-2xl border p-3"><p className="mb-2 text-sm font-bold">Dónde depositar</p><PayoutForm entidad="comercio" entidadId={paying.comercio_id} canEdit={false} reveal /></div>}
          <label htmlFor="settle-ref" className="text-sm font-bold">Referencia del pago (opcional)</label>
          <Input id="settle-ref" value={reference} maxLength={200} onChange={(event) => setReference(event.target.value)} placeholder="Ej.: transferencia 0001234" />
          <Button className="rounded-full" onClick={settle} disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Marcar como saldada</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
