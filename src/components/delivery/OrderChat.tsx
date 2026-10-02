import { FormEvent, useCallback, useEffect, useRef, useState } from "react";
import { Check, CheckCheck, Loader2, MessageCircle, Send } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { ChatCanal, ChatMessage, db, errorMessage, formatTime } from "@/lib/delivery";
import { cn } from "@/lib/utils";

/** Conversación de un pedido (cliente ↔ comercio o cliente ↔ repartidor). El servidor valida quién puede escribir. */
export function OrderChat({ pedidoId, canal, title, subtitle, open, onOpenChange, readOnly }: {
  pedidoId: string; canal: ChatCanal; title: string; subtitle?: string; open: boolean; onOpenChange: (open: boolean) => void; readOnly?: boolean;
}) {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  const markRead = useCallback(() => { db.rpc("delivery_marcar_leidos", { p_pedido: pedidoId, p_canal: canal }); }, [pedidoId, canal]);

  useEffect(() => {
    if (!open) return;
    let active = true;
    db.from("delivery_mensajes").select("*").eq("pedido_id", pedidoId).eq("canal", canal).order("created_at").limit(300)
      .then(({ data }: { data: ChatMessage[] | null }) => { if (active) { setMessages(data || []); setLoading(false); markRead(); } });
    const channel = db.channel(`chat-${pedidoId}-${canal}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_mensajes", filter: `pedido_id=eq.${pedidoId}` }, (payload: { new: ChatMessage }) => {
        if (payload.new.canal !== canal) return;
        setMessages((current) => (current.some((item) => item.id === payload.new.id) ? current : [...current, payload.new]));
        if (payload.new.autor_id !== user?.id) markRead();
      })
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "delivery_mensajes", filter: `pedido_id=eq.${pedidoId}` }, (payload: { new: ChatMessage }) => {
        setMessages((current) => current.map((item) => (item.id === payload.new.id ? { ...item, leido_at: payload.new.leido_at } : item)));
      })
      .subscribe();
    return () => { active = false; db.removeChannel(channel); };
  }, [open, pedidoId, canal, markRead, user?.id]);

  useEffect(() => { endRef.current?.scrollIntoView({ block: "end" }); }, [messages, open]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const value = text.trim();
    if (!value || sending) return;
    setSending(true);
    const { error } = await db.rpc("delivery_enviar_mensaje", { p_pedido: pedidoId, p_canal: canal, p_texto: value });
    setSending(false);
    if (error) return toast.error(errorMessage(error));
    setText("");
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[85vh] max-h-[640px] max-w-md flex-col gap-0 overflow-hidden p-0">
        <div className="border-b p-4 pr-12">
          <DialogTitle className="text-lg font-extrabold">{title}</DialogTitle>
          <DialogDescription className="text-xs">{subtitle || "Los mensajes quedan guardados en el pedido."}</DialogDescription>
        </div>
        <div className="flex-1 space-y-2 overflow-y-auto bg-muted/40 p-4" aria-live="polite">
          {loading && <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>}
          {!loading && messages.length === 0 && <p className="py-10 text-center text-sm text-muted-foreground">Todavía no hay mensajes. Escribí el primero.</p>}
          {messages.map((message) => {
            const mine = message.autor_id === user?.id;
            return (
              <div key={message.id} className={cn("flex", mine ? "justify-end" : "justify-start")}>
                <div className={cn("max-w-[82%] rounded-2xl px-3 py-2 text-sm shadow-sm", mine ? "rounded-br-md bg-primary text-primary-foreground" : "rounded-bl-md bg-card")}>
                  <p className="whitespace-pre-wrap break-words">{message.texto}</p>
                  <p className={cn("mt-0.5 flex items-center justify-end gap-1 text-[10px]", mine ? "text-primary-foreground/80" : "text-muted-foreground")}>
                    {formatTime(message.created_at)}
                    {mine && (message.leido_at ? <CheckCheck className="h-3 w-3" aria-label="Leído" /> : <Check className="h-3 w-3" aria-label="Enviado" />)}
                  </p>
                </div>
              </div>
            );
          })}
          <div ref={endRef} />
        </div>
        {readOnly ? (
          <p className="border-t p-3 text-center text-xs text-muted-foreground">Estás viendo esta conversación como administrador.</p>
        ) : (
          <form onSubmit={send} className="flex items-center gap-2 border-t bg-card p-3">
            <input value={text} onChange={(event) => setText(event.target.value)} maxLength={500} placeholder="Escribí un mensaje…" aria-label="Mensaje" className="h-11 min-w-0 flex-1 rounded-full border bg-background px-4 text-sm outline-none focus:border-primary" />
            <Button type="submit" size="icon" className="h-11 w-11 shrink-0 rounded-full" disabled={sending || !text.trim()} aria-label="Enviar">{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}</Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Botón que abre el chat y muestra cuántos mensajes sin leer hay. */
export function ChatButton({ pedidoId, canal, label, title, subtitle, className, variant = "outline", autoOpen, readOnly }: {
  pedidoId: string; canal: ChatCanal; label: string; title: string; subtitle?: string; className?: string; variant?: "outline" | "default" | "ghost"; autoOpen?: boolean; readOnly?: boolean;
}) {
  const { user } = useAuth();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [unread, setUnread] = useState(0);

  const refresh = useCallback(async () => {
    const { data } = await db.rpc("delivery_mensajes_sin_leer", { p_pedidos: [pedidoId] });
    const row = (data as { canal: ChatCanal; total: number }[] | null)?.find((item) => item.canal === canal);
    setUnread(row?.total ?? 0);
  }, [pedidoId, canal]);

  useEffect(() => {
    refresh();
    const channel = db.channel(`chat-badge-${pedidoId}-${canal}-${Math.random().toString(36).slice(2, 8)}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_mensajes", filter: `pedido_id=eq.${pedidoId}` }, (payload: { new: ChatMessage }) => {
        if (payload.new.canal === canal && payload.new.autor_id !== user?.id) refresh();
      })
      .subscribe();
    return () => { db.removeChannel(channel); };
  }, [pedidoId, canal, refresh, user?.id]);

  return (
    <>
      <Button type="button" variant={variant} size="sm" className={cn("relative rounded-full", className)} onClick={() => setOpen(true)}>
        <MessageCircle className="h-4 w-4" />{label}
        {unread > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-black text-primary-foreground ring-2 ring-card">{unread}</span>}
      </Button>
      <OrderChat pedidoId={pedidoId} canal={canal} title={title} subtitle={subtitle} readOnly={readOnly} open={open} onOpenChange={(next) => { setOpen(next); if (!next) setTimeout(refresh, 400); }} />
    </>
  );
}
