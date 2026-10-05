import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Loader2, SendHorizontal } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { enviarMensaje, fetchMensajes, marcarConversacionLeida, MAX_MENSAJE, mensajeValido, MensajeConversacion } from "@/services/conversations";

const hora = (v: string) => new Date(v).toLocaleTimeString("es-AR", { hour: "2-digit", minute: "2-digit", hour12: false });
const dia = (v: string) => new Date(v).toLocaleDateString("es-AR", { weekday: "long", day: "numeric", month: "long" });

/** Hilo de una conversación. `soyLocal` define de qué lado se dibujan mis mensajes. Se actualiza solo (tiempo real + respaldo cada 20 s). */
export function ConversationThread({ id, soyLocal, onActivity }: { id: string; soyLocal: boolean; onActivity?: () => void }) {
  const [mensajes, setMensajes] = useState<MensajeConversacion[] | null>(null);
  const [texto, setTexto] = useState("");
  const [enviando, setEnviando] = useState(false);
  const fin = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try { setMensajes(await fetchMensajes(id)); await marcarConversacionLeida(id); onActivity?.(); } catch (error) { toast.error(errorMessage(error)); setMensajes((cur) => cur ?? []); }
  }, [id, onActivity]);
  useEffect(() => {
    setMensajes(null); load();
    const channel = db.channel(`conv-${id}-${crypto.randomUUID()}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "conv_mensajes", filter: `conversacion_id=eq.${id}` }, load).subscribe();
    const timer = window.setInterval(load, 20000);
    return () => { db.removeChannel(channel); window.clearInterval(timer); };
  }, [id, load]);
  useEffect(() => { fin.current?.scrollIntoView({ block: "end" }); }, [mensajes?.length]);

  const enviar = async (e: FormEvent) => {
    e.preventDefault();
    if (!mensajeValido(texto) || enviando) return;
    setEnviando(true);
    try { await enviarMensaje(id, texto); setTexto(""); await load(); } catch (error) { toast.error(errorMessage(error)); } finally { setEnviando(false); }
  };

  let ultimoDia = "";
  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="min-h-0 flex-1 space-y-1.5 overflow-y-auto px-4 py-4" aria-live="polite">
        {!mensajes ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : mensajes.map((m) => {
          const mio = m.de_comercio === soyLocal;
          const d = dia(m.created_at);
          const separador = d !== ultimoDia; ultimoDia = d;
          return (
            <div key={m.id}>
              {separador && <p className="my-3 text-center text-xs font-semibold capitalize text-muted-foreground">{d}</p>}
              <div className={cn("flex", mio ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[82%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 text-[15px] leading-snug", mio ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-muted")}>
                  {m.texto}
                  <span className={cn("ml-2 inline-block translate-y-0.5 text-[10px] tabular-nums", mio ? "text-primary-foreground/70" : "text-muted-foreground")}>{hora(m.created_at)}</span>
                </div>
              </div>
            </div>
          );
        })}
        <div ref={fin} />
      </div>
      <form onSubmit={enviar} className="flex items-end gap-2 border-t bg-card p-3">
        <textarea value={texto} onChange={(e) => setTexto(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); e.currentTarget.form?.requestSubmit(); } }}
          aria-label="Escribí tu mensaje" placeholder="Escribí tu mensaje…" maxLength={MAX_MENSAJE} rows={1}
          className="max-h-32 min-h-[44px] flex-1 resize-none rounded-2xl border bg-background px-4 py-2.5 text-[15px] outline-none transition-shadow placeholder:text-muted-foreground focus-visible:ring-2 focus-visible:ring-primary/40" />
        <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={!mensajeValido(texto) || enviando} aria-label="Enviar">
          {enviando ? <Loader2 className="h-4 w-4 animate-spin" /> : <SendHorizontal className="h-4 w-4" />}
        </Button>
      </form>
    </div>
  );
}
