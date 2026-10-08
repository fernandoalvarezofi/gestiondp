import { useCallback, useEffect, useState } from "react";
import { Loader2, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { abrirHilo, buscarHilo, sinLeerDeHilo, type MsgCanal, type MsgContexto } from "@/services/messaging";
import { ChatThread } from "./ChatThread";

type Props = {
  contexto: Exclude<MsgContexto, "consulta">; id: string; canal: MsgCanal;
  /** Texto del botón (vacío = solo ícono). */
  label: string; title: string; subtitle?: string; className?: string;
  variant?: "outline" | "default" | "ghost"; autoOpen?: boolean;
  /** Administración: solo mira (no crea la conversación si no existe). */
  readOnly?: boolean;
};

/**
 * Botón que abre la conversación de un pedido, viaje o envío, con el globito de mensajes sin leer.
 * La conversación se crea recién al abrirla (las listas no generan hilos vacíos).
 */
export function ContextChatButton({ contexto, id, canal, label, title, subtitle, className, variant = "outline", autoOpen, readOnly }: Props) {
  const { user } = useAuth();
  const [open, setOpen] = useState(Boolean(autoOpen));
  const [hilo, setHilo] = useState<string | null>(null);
  const [abriendo, setAbriendo] = useState(false);
  const [sinLeer, setSinLeer] = useState(0);

  const refrescar = useCallback(async () => {
    if (!user) return;
    const existente = await buscarHilo(contexto, id, canal);
    if (existente) setHilo(existente);
    setSinLeer(existente && !readOnly ? await sinLeerDeHilo(existente, user.id) : 0);
  }, [contexto, id, canal, user, readOnly]);

  useEffect(() => { refrescar(); }, [refrescar]);
  useEffect(() => {
    if (!hilo) return;
    const ch = db.channel(`badge-${hilo}-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "msg_mensajes", filter: `hilo_id=eq.${hilo}` }, refrescar).subscribe();
    return () => { db.removeChannel(ch); };
  }, [hilo, refrescar]);

  // Al abrir, se crea (o retoma) el hilo en el servidor.
  useEffect(() => {
    if (!open || hilo || readOnly) return;
    setAbriendo(true);
    abrirHilo(contexto, id, canal).then(setHilo).catch((error) => { toast.error(errorMessage(error)); setOpen(false); }).finally(() => setAbriendo(false));
  }, [open, hilo, readOnly, contexto, id, canal]);

  return (
    <>
      <Button type="button" variant={variant} size="sm" className={cn("relative rounded-full", className)} aria-label={label || "Abrir el chat"} title={label || "Chat"} onClick={() => setOpen(true)}>
        <MessageCircle className="h-4 w-4" />{label}
        {sinLeer > 0 && <span className="absolute -right-1 -top-1 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-yellow px-1 text-[10px] font-black text-brand-yellow-foreground ring-2 ring-card" aria-label={`${sinLeer} sin leer`}>{sinLeer}</span>}
      </Button>
      <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setTimeout(refrescar, 400); }}>
        <DialogContent className="flex h-[88vh] max-h-[680px] max-w-md flex-col gap-0 overflow-hidden p-0">
          <div className="border-b p-4 pr-12">
            <DialogTitle className="text-lg font-extrabold">{title}</DialogTitle>
            <DialogDescription className="text-xs">{subtitle || "La conversación queda guardada en Woref."}</DialogDescription>
          </div>
          <div className="min-h-0 flex-1">
            {hilo ? <ChatThread hiloId={hilo} showHeader={false} onActivity={refrescar} />
              : abriendo ? <div className="flex h-full items-center justify-center"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
              : <p className="p-8 text-center text-sm text-muted-foreground">Todavía no hay mensajes en esta conversación.</p>}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
