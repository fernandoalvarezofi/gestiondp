import { useCallback, useEffect, useRef, useState } from "react";
import { Loader2, Lock, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { TicketMessage } from "@/lib/support";
import { cn } from "@/lib/utils";

/** Conversación de un ticket en tiempo real. `staff` muestra notas internas y permite escribirlas. */
export function TicketThread({ ticketId, staff = false, canReply = true, templates = [], onSent }: { ticketId: string; staff?: boolean; canReply?: boolean; templates?: { id: string; titulo: string; texto: string }[]; onSent?: () => void }) {
  const [messages, setMessages] = useState<TicketMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [internal, setInternal] = useState(false);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_reclamo_mensajes").select("*").eq("reclamo_id", ticketId).order("created_at", { ascending: true }).limit(300);
    setMessages((data as TicketMessage[]) || []);
    setLoading(false);
  }, [ticketId]);

  useEffect(() => {
    setLoading(true);
    load();
    const channel = db.channel(`ticket-${ticketId}-${crypto.randomUUID()}`).on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_reclamo_mensajes", filter: `reclamo_id=eq.${ticketId}` }, load).subscribe();
    return () => { db.removeChannel(channel); };
  }, [ticketId, load]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages.length]);

  const send = async () => {
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    const { error } = await db.rpc("delivery_soporte_enviar", { p_reclamo: ticketId, p_texto: value, p_interna: staff && internal });
    setSending(false);
    if (error) return toast.error(errorMessage(error));
    setText("");
    load();
    onSent?.();
  };

  return (
    <div className="flex min-h-0 flex-col">
      <div className="max-h-[46vh] min-h-[160px] space-y-2 overflow-y-auto rounded-2xl bg-muted/50 p-3" aria-live="polite">
        {loading ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : messages.map((message) => {
          const mine = staff ? message.autor_rol === "soporte" : message.autor_rol === "cliente";
          if (message.autor_rol === "sistema") return <p key={message.id} className="text-center text-xs text-muted-foreground">{message.texto} · {formatDateTime(message.created_at)}</p>;
          return (
            <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
              <div className={cn("max-w-[85%] rounded-2xl px-3.5 py-2 text-sm", message.interna ? "border border-dashed border-warning bg-warning/10" : mine ? "bg-primary text-primary-foreground" : "bg-card shadow-sm")}>
                <p className={cn("mb-0.5 text-[11px] font-bold opacity-80", message.interna && "flex items-center gap-1")}>{message.interna && <Lock className="h-3 w-3" />}{message.interna ? "Nota interna" : message.autor_rol === "soporte" ? (staff ? "Soporte" : "Soporte Woref") : staff ? "Cliente" : "Vos"}</p>
                <p className="whitespace-pre-wrap break-words">{message.texto}</p>
                <p className="mt-1 text-[10px] opacity-70">{formatDateTime(message.created_at)}</p>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>
      {canReply && (
        <div className="mt-3 space-y-2">
          {staff && templates.length > 0 && (
            <div className="flex flex-wrap gap-1.5" aria-label="Respuestas rápidas">
              {templates.map((template) => <button key={template.id} type="button" onClick={() => setText(template.texto)} className="rounded-full border bg-card px-3 py-1 text-xs font-bold hover:bg-muted">{template.titulo}</button>)}
            </div>
          )}
          <Textarea value={text} maxLength={2000} onChange={(event) => setText(event.target.value)} placeholder={staff && internal ? "Nota interna (el cliente no la ve)" : "Escribí tu mensaje"} className={cn("min-h-[72px] resize-none", staff && internal && "border-dashed border-warning")} aria-label="Mensaje" />
          <div className="flex items-center justify-between gap-2">
            {staff ? <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" checked={internal} onChange={(event) => setInternal(event.target.checked)} />Nota interna</label> : <span />}
            <Button className="rounded-full" disabled={sending || !text.trim()} onClick={send}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar</Button>
          </div>
        </div>
      )}
    </div>
  );
}
