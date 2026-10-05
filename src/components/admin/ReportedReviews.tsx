import { useCallback, useEffect, useState } from "react";
import { EyeOff, Loader2, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Stars } from "@/components/market/Stars";
import { Button } from "@/components/ui/button";
import { errorMessage, formatDateTime } from "@/lib/delivery";
import { fetchOpinionesReportadas, moderarOpinion, OpinionReportada } from "@/services/reviews";

/** Opiniones de productos que un comercio reportó: administración decide si se ocultan (cambia el promedio del producto) o se dejan. */
export function ReportedReviews({ onChange }: { onChange?: (n: number) => void }) {
  const [rows, setRows] = useState<OpinionReportada[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const load = useCallback(async () => {
    try { const r = await fetchOpinionesReportadas(); setRows(r); onChange?.(r.length); } catch (error) { toast.error(errorMessage(error)); setRows([]); }
  }, [onChange]);
  useEffect(() => { load(); }, [load]);

  const decidir = async (id: string, visible: boolean) => {
    setBusy(id);
    try { await moderarOpinion(id, visible); toast.success(visible ? "Se mantiene visible" : "Opinión oculta"); await load(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(null); }
  };

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (rows.length === 0) return <EmptyState icon={<ShieldCheck className="h-7 w-7" />} title="No hay opiniones reportadas" text="Cuando un comercio reporte una opinión abusiva, la vas a poder revisar acá." />;
  return (
    <ul className="space-y-3">
      {rows.map((r) => (
        <li key={r.id} className="rounded-3xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-extrabold">{r.producto} <span className="font-semibold text-muted-foreground">· {r.comercio}</span></p><Stars value={r.puntaje} size={15} /></div>
          <p className="text-xs text-muted-foreground">Reportada {formatDateTime(r.reportada_at)}{!r.visible && " · hoy está oculta"}</p>
          {r.comentario ? <p className="mt-2 rounded-xl bg-muted p-3 text-sm">“{r.comentario}”</p> : <p className="mt-2 text-sm text-muted-foreground">Sin comentario (solo puntaje).</p>}
          <p className="mt-2 text-sm"><span className="font-bold">Motivo del reporte: </span>{r.motivo}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Button size="sm" variant="destructive" className="rounded-full" disabled={busy === r.id} onClick={() => decidir(r.id, false)}><EyeOff className="h-4 w-4" />Ocultar opinión</Button>
            <Button size="sm" variant="outline" className="rounded-full" disabled={busy === r.id} onClick={() => decidir(r.id, true)}>Mantener visible</Button>
          </div>
        </li>
      ))}
    </ul>
  );
}
