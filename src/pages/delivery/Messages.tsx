import { useCallback, useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, Loader2, MessageCircle, Store } from "lucide-react";
import { ConversationList } from "@/components/messages/ConversationList";
import { ConversationThread } from "@/components/messages/ConversationThread";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ConversacionCliente, fetchMisConversaciones } from "@/services/conversations";

/** Mis mensajes: las consultas que hice a los locales. En el celular se ve una cosa a la vez (lista o conversación). */
export default function Messages() {
  const [params, setParams] = useSearchParams();
  const activa = params.get("c");
  const [filas, setFilas] = useState<ConversacionCliente[] | null>(null);
  const load = useCallback(async () => { setFilas(await fetchMisConversaciones().catch(() => [])); }, []);
  useEffect(() => { load(); }, [load]);
  const actual = filas?.find((f) => f.id === activa) ?? null;

  return (
    <div className="mx-auto max-w-5xl px-4 pb-14 pt-5 sm:px-6">
      <div className={cn(activa && "max-md:hidden")}><PageHeader eyebrow="Tu cuenta" title="Mensajes" subtitle="Tus consultas a los locales." /></div>
      {!filas ? <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        : filas.length === 0 ? <EmptyState className="mt-6" icon={<MessageCircle className="h-7 w-7" />} title="Todavía no escribiste a ningún local" text="Desde la página de un producto o de un local podés hacer una consulta antes de comprar." action={<Button asChild className="rounded-full"><Link to="/app/buscar">Buscar productos</Link></Button>} />
        : (
          <div className="mt-5 grid overflow-hidden rounded-3xl border bg-card md:h-[min(640px,calc(100vh-14rem))] md:grid-cols-[320px_1fr]">
            <div className={cn("min-h-0 overflow-y-auto md:border-r", activa && "max-md:hidden")}>
              <ConversationList activa={activa} onSelect={(id) => setParams({ c: id })}
                filas={filas.map((f) => ({ id: f.id, titulo: f.comercio, subtitulo: f.producto, ultimo_texto: f.ultimo_texto, ultimo_mensaje_at: f.ultimo_mensaje_at, sin_leer: f.sin_leer,
                  avatar: f.logo_url ? <img src={f.logo_url} alt="" className="h-10 w-10 shrink-0 rounded-full object-cover" /> : <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"><Store className="h-5 w-5" /></span> }))} />
            </div>
            <div className={cn("flex min-h-[60vh] min-w-0 flex-col md:min-h-0", !activa && "max-md:hidden")}>
              {actual ? (
                <>
                  <div className="flex items-center gap-2 border-b px-3 py-2.5">
                    <button type="button" onClick={() => setParams({})} aria-label="Volver a mis mensajes" className="flex h-9 w-9 items-center justify-center rounded-full hover:bg-muted md:hidden"><ArrowLeft className="h-5 w-5" /></button>
                    <div className="min-w-0"><Link to={`/t/${actual.comercio_slug}`} className="block truncate font-extrabold hover:underline">{actual.comercio}</Link>{actual.producto && <span className="block truncate text-xs text-muted-foreground">Por: {actual.producto}</span>}</div>
                  </div>
                  <div className="min-h-0 flex-1"><ConversationThread id={actual.id} soyLocal={false} onActivity={load} /></div>
                </>
              ) : <div className="hidden flex-1 items-center justify-center p-8 text-center text-sm text-muted-foreground md:flex">Elegí una conversación para verla.</div>}
            </div>
          </div>
        )}
    </div>
  );
}
