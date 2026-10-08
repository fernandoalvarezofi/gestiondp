import { useCallback, useEffect, useState } from "react";
import { EyeOff, Loader2, MessageCircle, X } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { PageIntro } from "@/components/panel/kit";
import { ContextChatButton } from "@/components/messages/ContextChat";
import { Button } from "@/components/ui/button";
import { errorMessage, formatDateTime } from "@/lib/delivery";
import { fetchReportes, resolverReporte, type ReporteMensaje } from "@/services/messaging";

const rolLabel: Record<string, string> = { cliente: "Cliente", comercio: "Comercio", repartidor: "Repartidor", conductor: "Conductor", pasajero: "Pasajero" };

/** Moderación de mensajes reportados: ocultar el mensaje o descartar el reporte. Cada decisión queda en Auditoría. */
export function ReportedMessages({ onChange }: { onChange?: (count: number) => void }) {
  const [rows, setRows] = useState<ReporteMensaje[] | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(async () => {
    try { const data = await fetchReportes(); setRows(data); onChange?.(data.length); } catch (error) { toast.error(errorMessage(error)); setRows([]); }
  }, [onChange]);
  useEffect(() => { load(); }, [load]);

  const resolver = async (r: ReporteMensaje, ocultar: boolean) => {
    setBusy(r.id);
    try { await resolverReporte(r.id, ocultar); toast.success(ocultar ? "Mensaje ocultado" : "Reporte descartado"); await load(); }
    catch (error) { toast.error(errorMessage(error)); } finally { setBusy(null); }
  };

  return (
    <div className="space-y-5">
      <PageIntro title="Mensajes reportados" description="Mensajes que alguien marcó como ofensivos o sospechosos. Ocultarlo lo reemplaza por un aviso para todos." />
      {!rows ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : rows.length === 0 ? <EmptyState icon={<MessageCircle className="h-7 w-7" />} title="No hay mensajes reportados" text="Cuando alguien reporte un mensaje, aparece acá para revisarlo." />
        : (
          <ul className="space-y-3">
            {rows.map((r) => (
              <li key={r.id} className="rounded-3xl border bg-card p-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span><span className="font-bold text-foreground">{r.contexto.titulo}</span> · {r.contexto.subtitulo}</span>
                  <span>{formatDateTime(r.created_at)}</span>
                </div>
                <blockquote className="mt-2 rounded-2xl bg-muted p-3 text-sm">
                  <p className="text-xs font-bold text-muted-foreground">{r.autor} ({rolLabel[r.autor_rol] ?? r.autor_rol}) escribió:</p>
                  <p className="mt-1 whitespace-pre-wrap break-words">{r.tipo === "foto" ? "📷 Foto" : r.tipo === "ubicacion" ? "📍 Ubicación" : r.texto}</p>
                </blockquote>
                <p className="mt-2 text-sm"><span className="font-bold">Motivo ({r.reporta}):</span> {r.motivo}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <Button size="sm" variant="destructive" className="rounded-full" disabled={busy === r.id} onClick={() => resolver(r, true)}><EyeOff className="h-4 w-4" />Ocultar mensaje</Button>
                  <Button size="sm" variant="outline" className="rounded-full" disabled={busy === r.id} onClick={() => resolver(r, false)}><X className="h-4 w-4" />Descartar</Button>
                  {r.contexto.contexto !== "consulta" && r.contexto.contexto_id && (
                    <ContextChatButton contexto={r.contexto.contexto} id={r.contexto.contexto_id} canal={r.contexto.canal} label="Ver conversación" title={r.contexto.titulo} subtitle={r.contexto.subtitulo} readOnly />
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
    </div>
  );
}
