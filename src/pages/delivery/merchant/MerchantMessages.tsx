import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, MessageCircle, UserRound } from "lucide-react";
import { ConversationList } from "@/components/messages/ConversationList";
import { ConversationThread } from "@/components/messages/ConversationThread";
import { EmptyState } from "@/components/delivery/Common";
import { cn } from "@/lib/utils";
import { ConversacionLocal, fetchConversacionesLocal } from "@/services/conversations";
import { useMerchant } from "./context";

/** Mensajes de clientes al local (consultas antes de comprar). Las responde cualquiera del equipo con permiso de pedidos. */
export default function MerchantMessages() {
  const { store } = useMerchant();
  const [params, setParams] = useSearchParams();
  const activa = params.get("c");
  const [filas, setFilas] = useState<ConversacionLocal[] | null>(null);
  const load = useCallback(async () => { setFilas(await fetchConversacionesLocal(store.id).catch(() => [])); }, [store.id]);
  useEffect(() => { setFilas(null); load(); const t = window.setInterval(load, 30000); return () => window.clearInterval(t); }, [load]);
  const actual = filas?.find((f) => f.id === activa) ?? null;

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <div className={cn(activa && "max-md:hidden")}>
        <h1 className="flex items-center gap-2 text-2xl font-extrabold"><MessageCircle className="h-6 w-6 text-primary" />Mensajes</h1>
        <p className="text-sm text-muted-foreground">Consultas de clientes antes de comprar. Respondé rápido: se nota en tus ventas.</p>
      </div>
      {!filas ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : filas.length === 0 ? <EmptyState icon={<MessageCircle className="h-7 w-7" />} title="Todavía no tenés mensajes" text="Cuando un cliente te consulte desde un producto o desde tu tienda, lo vas a ver acá y te avisamos." />
        : (
          <div className="grid overflow-hidden rounded-3xl border bg-card md:h-[min(640px,calc(100vh-12rem))] md:grid-cols-[320px_1fr]">
            <div className={cn("min-h-0 overflow-y-auto md:border-r", activa && "max-md:hidden")}>
              <ConversationList activa={activa} onSelect={(id) => setParams({ c: id })}
                filas={filas.map((f) => ({ id: f.id, titulo: f.cliente, subtitulo: f.producto, ultimo_texto: f.ultimo_texto, ultimo_mensaje_at: f.ultimo_mensaje_at, sin_leer: f.sin_leer,
                  avatar: <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><UserRound className="h-5 w-5" /></span> }))} />
            </div>
            <div className={cn("flex min-h-[60vh] min-w-0 flex-col md:min-h-0", !activa && "max-md:hidden")}>
              {actual ? (
                <>
                  <div className="flex items-center gap-2 border-b px-3 py-2.5">
                    <button type="button" onClick={() => setParams({})} aria-label="Volver a los mensajes" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted md:hidden"><ArrowLeft className="h-5 w-5" /></button>
                    <div className="min-w-0"><p className="truncate font-extrabold">{actual.cliente}</p>{actual.producto && <span className="block truncate text-xs text-muted-foreground">Consulta por: {actual.producto}</span>}</div>
                  </div>
                  <div className="min-h-0 flex-1"><ConversationThread id={actual.id} soyLocal onActivity={load} /></div>
                </>
              ) : <div className="hidden flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground md:flex">Elegí una conversación para responder.</div>}
            </div>
          </div>
        )}
    </div>
  );
}
