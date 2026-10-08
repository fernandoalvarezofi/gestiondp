import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Eye, EyeOff, Loader2, MessageCircleQuestion, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { useMerchant } from "./context";

type Row = { id: string; producto_id: string; producto: string; pregunta: string; respuesta: string | null; respondida_at: string | null; visible: boolean; created_at: string; autor: string };

const RAPIDAS = ["Sí, tenemos stock.", "Hoy mismo lo tenemos disponible.", "Te lo llevamos hoy a tu domicilio.", "Sí, aceptamos pedidos para retirar en el local."];
const cuando = (iso: string) => new Date(iso).toLocaleString("es-AR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });

/** Preguntas de los clientes sobre los productos: se responden acá y la respuesta queda visible en la ficha del producto. */
export default function MerchantQuestions() {
  const { store, loadPreguntas } = useMerchant();
  const [rows, setRows] = useState<Row[] | null>(null);
  const [tab, setTab] = useState<"pendientes" | "respondidas" | "ocultas">("pendientes");
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await db.rpc("delivery_preguntas_comercio", { p_comercio: store.id });
    if (error) { toast.error(errorMessage(error)); setRows([]); return; }
    setRows((data ?? []) as Row[]);
  }, [store.id]);
  useEffect(() => { setRows(null); load(); }, [load]);

  const groups = useMemo(() => ({
    pendientes: (rows ?? []).filter((row) => !row.respuesta && row.visible),
    respondidas: (rows ?? []).filter((row) => row.respuesta && row.visible),
    ocultas: (rows ?? []).filter((row) => !row.visible),
  }), [rows]);

  const answer = async (row: Row) => {
    const text = (drafts[row.id] ?? "").trim();
    if (!text) { toast.error("Escribí la respuesta"); return; }
    setBusy(row.id);
    const { error } = await db.rpc("delivery_responder_pregunta", { p_id: row.id, p_respuesta: text });
    setBusy(null);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Respuesta publicada");
    setDrafts((current) => { const next = { ...current }; delete next[row.id]; return next; });
    await Promise.all([load(), loadPreguntas()]);
  };
  const toggle = async (row: Row) => {
    setBusy(row.id);
    const { error } = await db.rpc("delivery_moderar_pregunta", { p_id: row.id, p_visible: !row.visible });
    setBusy(null);
    if (error) { toast.error(errorMessage(error)); return; }
    await Promise.all([load(), loadPreguntas()]);
  };

  const list = groups[tab];
  const tabs = [["pendientes", "Sin responder"], ["respondidas", "Respondidas"], ["ocultas", "Ocultas"]] as const;

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="max-w-lg text-sm text-muted-foreground">Responder rápido mejora tu reputación y ayuda a vender: tus respuestas se ven en la ficha del producto, para todos.</p>
        <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => { setRows(null); load(); }}><RefreshCw className="h-4 w-4" />Actualizar</Button>
      </div>

      <div className="flex gap-2 overflow-x-auto" role="tablist" aria-label="Preguntas">
        {tabs.map(([id, label]) => (
          <button key={id} type="button" role="tab" aria-selected={tab === id} onClick={() => setTab(id)} className={cn("flex shrink-0 items-center gap-2 rounded-full border-2 px-4 py-1.5 text-sm font-bold transition-colors", tab === id ? "border-brand-yellow bg-brand-yellow/10" : "border-transparent bg-muted/60 hover:bg-muted")}>
            {label}<span className={cn("rounded-full px-1.5 text-xs", id === "pendientes" && groups.pendientes.length ? "bg-brand-yellow text-brand-yellow-foreground" : "bg-background text-muted-foreground")}>{groups[id].length}</span>
          </button>
        ))}
      </div>

      {rows === null && <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-muted-foreground" /></div>}
      {rows !== null && list.length === 0 && (
        <EmptyState icon={<MessageCircleQuestion className="h-7 w-7" />} title={tab === "pendientes" ? "No tenés preguntas por responder" : tab === "respondidas" ? "Todavía no respondiste preguntas" : "No ocultaste ninguna pregunta"} text="Cuando un cliente te pregunte algo desde la ficha de un producto de tu tienda online, lo vas a ver acá." />
      )}

      <ul className="space-y-3">
        {list.map((row) => (
          <li key={row.id} className="rounded-3xl border bg-card p-4 sm:p-5">
            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <Link to={`/t/${store.slug}/p/${row.producto_id}`} target="_blank" rel="noopener noreferrer" className="font-bold text-foreground hover:underline">{row.producto}</Link>
              <span>{row.autor} · {cuando(row.created_at)}</span>
            </div>
            <p className="mt-2 text-base font-semibold">{row.pregunta}</p>

            {row.respuesta ? (
              <p className="mt-3 rounded-2xl bg-muted/60 p-3 text-sm"><span className="font-bold">Tu respuesta: </span>{row.respuesta}</p>
            ) : row.visible && (
              <div className="mt-3 space-y-2">
                <div className="flex flex-wrap gap-1.5">
                  {RAPIDAS.map((texto) => <button key={texto} type="button" onClick={() => setDrafts((current) => ({ ...current, [row.id]: texto }))} className="rounded-full border px-3 py-1 text-xs font-semibold hover:bg-muted">{texto}</button>)}
                </div>
                <Textarea aria-label={`Respuesta a: ${row.pregunta}`} value={drafts[row.id] ?? ""} maxLength={600} placeholder="Escribí tu respuesta…" onChange={(event) => setDrafts((current) => ({ ...current, [row.id]: event.target.value }))} className="min-h-[72px]" />
                <div className="flex justify-end"><Button type="button" className="rounded-full font-bold" disabled={busy === row.id} onClick={() => answer(row)}>{busy === row.id && <Loader2 className="h-4 w-4 animate-spin" />}Responder</Button></div>
              </div>
            )}

            <div className="mt-3 flex justify-end">
              <button type="button" onClick={() => toggle(row)} disabled={busy === row.id} className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground">
                {row.visible ? <><EyeOff className="h-3.5 w-3.5" />Ocultar del público</> : <><Eye className="h-3.5 w-3.5" />Volver a mostrar</>}
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
