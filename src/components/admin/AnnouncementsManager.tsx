import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, Megaphone, Send } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Campaign, platformSegmentLabel, segmentLabel, validateCampaign } from "@/lib/campanas";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { cn } from "@/lib/utils";

/** Anuncios de la plataforma (avisos push a todos, a repartidores o a comercios) y registro de todas las campañas enviadas. */
export function AnnouncementsManager() {
  const [segment, setSegment] = useState("todos");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);
  const [rows, setRows] = useState<(Campaign & { comercio?: { nombre: string } | null })[] | null>(null);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_campanas").select("*, comercio:delivery_comercios(nombre)").order("created_at", { ascending: false }).limit(60);
    setRows(data || []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const send = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateCampaign(title, message);
    if (problem) return toast.error(problem);
    if (!window.confirm(`¿Enviar este anuncio a "${platformSegmentLabel[segment]}"? No se puede deshacer.`)) return;
    setSending(true);
    const { error } = await db.rpc("delivery_admin_campana_crear", { p_segmento: segment, p_titulo: title, p_mensaje: message });
    setSending(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Anuncio enviado");
    setTitle(""); setMessage("");
    load();
  };

  return (
    <div className="space-y-6">
      <form onSubmit={send} className="max-w-2xl space-y-4 rounded-3xl border bg-card p-4 sm:p-5">
        <h2 className="flex items-center gap-2 font-extrabold"><Megaphone className="h-5 w-5 text-primary" />Nuevo anuncio de Woref</h2>
        <p className="text-sm text-muted-foreground">Llega solo a quienes aceptaron avisos de promociones y tienen un dispositivo con notificaciones. Se registra en auditoría.</p>
        <div role="radiogroup" aria-label="Destinatarios" className="flex flex-wrap gap-2">
          {Object.entries(platformSegmentLabel).map(([id, label]) => <button key={id} type="button" role="radio" aria-checked={segment === id} onClick={() => setSegment(id)} className={cn("rounded-full border px-4 py-1.5 text-sm font-bold", segment === id ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>{label}</button>)}
        </div>
        <div className="space-y-1.5"><Label htmlFor="a-title">Título</Label><Input id="a-title" value={title} maxLength={50} onChange={(event) => setTitle(event.target.value)} /></div>
        <div className="space-y-1.5"><Label htmlFor="a-msg">Mensaje</Label><Textarea id="a-msg" value={message} maxLength={140} onChange={(event) => setMessage(event.target.value)} className="min-h-[72px] resize-none" /><p className="text-right text-xs text-muted-foreground">{message.length}/140</p></div>
        <Button type="submit" className="rounded-full font-bold" disabled={sending}>{sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}Enviar anuncio</Button>
      </form>

      <section>
        <h2 className="font-extrabold">Todas las campañas</h2>
        {!rows ? <div className="flex justify-center py-10"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : rows.length === 0 ? <EmptyState className="mt-3" icon={<Send className="h-6 w-6" />} title="Todavía no se envió ninguna campaña" /> : (
          <ul className="mt-3 divide-y overflow-hidden rounded-3xl border bg-card">
            {rows.map((item) => (
              <li key={item.id} className="p-3">
                <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.titulo}</p><span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold">{item.comercio?.nombre ?? "Woref"}</span><span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span></div>
                <p className="text-sm text-muted-foreground">{item.mensaje}{item.cupon_codigo ? ` · Cupón ${item.cupon_codigo}` : ""}</p>
                <p className="mt-1 text-xs font-semibold">{segmentLabel(item.segmento)} · {item.enviados} de {item.destinatarios} recibieron el aviso · {item.estado}</p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
