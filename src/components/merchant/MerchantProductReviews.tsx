import { useCallback, useEffect, useState } from "react";
import { Flag, Loader2, MessageSquare } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Stars } from "@/components/market/Stars";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { errorMessage, formatDateTime } from "@/lib/delivery";
import { fetchOpinionesComercio, OpinionComercio, reportarOpinion, responderOpinion } from "@/services/reviews";

/** Opiniones de los productos del local (solo de compradores): se responden y, si son abusivas, se reportan a administración. */
export function MerchantProductReviews({ storeId }: { storeId: string }) {
  const [rows, setRows] = useState<OpinionComercio[] | null>(null);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [reporting, setReporting] = useState<string | null>(null);
  const [motivo, setMotivo] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => { try { setRows(await fetchOpinionesComercio(storeId)); } catch (error) { toast.error(errorMessage(error)); setRows([]); } }, [storeId]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const run = async (id: string, action: () => Promise<void>, ok: string) => {
    setBusy(id);
    try { await action(); toast.success(ok); setReporting(null); setMotivo(""); await load(); } catch (error) { toast.error(errorMessage(error)); } finally { setBusy(null); }
  };

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (rows.length === 0) return <EmptyState icon={<MessageSquare className="h-7 w-7" />} title="Todavía no hay opiniones de productos" text="Cuando tus clientes califiquen lo que compraron, las vas a ver y responder acá." />;
  return (
    <ul className="space-y-3">
      {rows.map((o) => (
        <li key={o.id} className="rounded-3xl border bg-card p-4 sm:p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><p className="font-extrabold">{o.producto}</p><Stars value={o.puntaje} size={15} /></div>
          <p className="text-xs text-muted-foreground">{o.autor} · {formatDateTime(o.created_at)}{!o.visible && " · Oculta por administración"}{o.reportada && " · Reportada"}</p>
          {o.comentario && <p className="mt-2 text-sm">{o.comentario}</p>}
          {o.respuesta ? <p className="mt-2 rounded-xl bg-muted p-3 text-sm"><span className="font-bold">Tu respuesta: </span>{o.respuesta}</p> : (
            <div className="mt-3 space-y-2">
              <Textarea aria-label={`Respuesta a la opinión sobre ${o.producto}`} value={draft[o.id] ?? ""} maxLength={500} onChange={(event) => setDraft((c) => ({ ...c, [o.id]: event.target.value }))} placeholder="Respondé con respeto: la ven todos los que miren el producto" className="min-h-[64px] resize-none" />
              <Button size="sm" className="rounded-full" disabled={busy === o.id || !(draft[o.id] ?? "").trim()} onClick={() => run(o.id, () => responderOpinion(o.id, draft[o.id]), "Respuesta publicada")}>{busy === o.id && <Loader2 className="h-4 w-4 animate-spin" />}Responder</Button>
            </div>
          )}
          {!o.reportada && o.visible && (reporting === o.id ? (
            <div className="mt-3 space-y-2">
              <Textarea aria-label="Motivo del reporte" value={motivo} maxLength={300} onChange={(event) => setMotivo(event.target.value)} placeholder="Contanos por qué es abusiva (insultos, datos personales, no es de este producto…)" className="min-h-[56px] resize-none" />
              <div className="flex gap-2"><Button size="sm" variant="destructive" className="rounded-full" disabled={busy === o.id || motivo.trim().length < 5} onClick={() => run(o.id, () => reportarOpinion(o.id, motivo), "Reporte enviado a administración")}>Enviar reporte</Button><Button size="sm" variant="ghost" className="rounded-full" onClick={() => setReporting(null)}>Volver</Button></div>
            </div>
          ) : <button type="button" className="mt-3 inline-flex items-center gap-1 text-xs font-semibold text-muted-foreground hover:text-destructive" onClick={() => { setReporting(o.id); setMotivo(""); }}><Flag className="h-3.5 w-3.5" />Reportar opinión</button>)}
        </li>
      ))}
    </ul>
  );
}
