import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Gift, Loader2, Star } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { TicketThread } from "@/components/support/TicketThread";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, money, Reclamo, reclamoTipoLabel, shortId } from "@/lib/delivery";
import { estadoLabel, isOpenTicket } from "@/lib/support";
import { ticketStateClass } from "@/pages/delivery/Help";
import { cn } from "@/lib/utils";

/** Conversación de una consulta con soporte, con calificación al cerrarse. */
export default function HelpTicket() {
  const { id } = useParams();
  const [ticket, setTicket] = useState<Reclamo | null | undefined>(undefined);
  const [score, setScore] = useState(0);
  const [comment, setComment] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_reclamos").select("*").eq("id", id!).maybeSingle();
    setTicket((data as Reclamo) || null);
  }, [id]);

  useEffect(() => {
    load();
    const channel = db.channel(`ticket-estado-${id}-${crypto.randomUUID()}`).on("postgres_changes", { event: "UPDATE", schema: "public", table: "delivery_reclamos", filter: `id=eq.${id}` }, load).subscribe();
    return () => { db.removeChannel(channel); };
  }, [id, load]);

  const rate = async () => {
    setSaving(true);
    const { error } = await db.rpc("delivery_soporte_calificar", { p_reclamo: id!, p_puntaje: score, p_comentario: comment.trim() || null });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("¡Gracias por tu opinión!");
    load();
  };

  if (ticket === undefined) return <div className="flex justify-center py-20"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  if (!ticket) return <EmptyState className="mx-auto mt-10 max-w-md" title="No encontramos esta consulta" action={<Button asChild className="rounded-full"><Link to="/app/ayuda">Volver a Ayuda</Link></Button>} />;

  const closed = ticket.estado === "resuelto" || ticket.estado === "rechazado";
  return (
    <div className="mx-auto max-w-2xl pb-10">
      <PageHeader eyebrow={ticket.pedido_id ? `Pedido ${shortId(ticket.pedido_id)}` : "Consulta"} title={reclamoTipoLabel[ticket.tipo]} subtitle={<span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ticketStateClass(ticket.estado))}>{estadoLabel[ticket.estado]}</span>} />
      {ticket.pedido_id && <Link to={`/app/pedidos/${ticket.pedido_id}`} className="mt-3 inline-block text-sm font-bold text-primary hover:underline">Ver el pedido</Link>}
      <div className="mt-4"><TicketThread ticketId={ticket.id} canReply={isOpenTicket(ticket.estado) || closed} onSent={load} /></div>
      {closed && <p className="mt-2 text-xs text-muted-foreground">Si respondés, reabrimos la consulta.</p>}
      {Number(ticket.reembolso_monto) > 0 && <p className="mt-4 rounded-2xl bg-success/10 p-3 text-sm font-bold text-success">Reintegro registrado: {money(ticket.reembolso_monto)}</p>}
      {ticket.credito_codigo && <p className="mt-3 flex items-center gap-2 rounded-2xl bg-primary/10 p-3 text-sm"><Gift className="h-4 w-4 text-primary" />Te dejamos un cupón de compensación: <span className="font-black">{ticket.credito_codigo}</span><Link to="/app/club" className="ml-auto font-bold text-primary hover:underline">Ver mis cupones</Link></p>}
      {closed && !ticket.csat && (
        <section className="mt-6 rounded-3xl border bg-card p-4">
          <h2 className="font-extrabold">¿Cómo fue la atención?</h2>
          <div className="mt-2 flex gap-1" role="radiogroup" aria-label="Calificación">
            {[1, 2, 3, 4, 5].map((value) => (
              <button key={value} type="button" role="radio" aria-checked={score === value} aria-label={`${value} de 5`} onClick={() => setScore(value)}><Star className={cn("h-8 w-8", value <= score ? "fill-warning text-warning" : "text-muted-foreground/40")} /></button>
            ))}
          </div>
          <Textarea value={comment} maxLength={500} onChange={(event) => setComment(event.target.value)} placeholder="Comentario (opcional)" className="mt-3 min-h-[64px] resize-none" aria-label="Comentario" />
          <Button className="mt-3 rounded-full" disabled={!score || saving} onClick={rate}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Enviar calificación</Button>
        </section>
      )}
      {closed && ticket.csat ? <p className="mt-6 text-center text-sm text-muted-foreground">Calificaste esta atención con {ticket.csat}/5. ¡Gracias!</p> : null}
    </div>
  );
}
