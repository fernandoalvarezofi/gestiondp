import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ChevronRight, Headset, Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { EmptyState, PageHeader } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, formatDateTime, Reclamo, reclamoTipoLabel, shortId } from "@/lib/delivery";
import { estadoLabel, generalTopics, isOpenTicket } from "@/lib/support";
import { useAuth } from "@/contexts/AuthContext";
import { cn } from "@/lib/utils";

export const ticketStateClass = (estado: Reclamo["estado"]) =>
  estado === "esperando_cliente" ? "bg-warning/15 text-foreground" : estado === "resuelto" ? "bg-success/10 text-success" : estado === "rechazado" ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary";

/** Centro de ayuda del cliente: sus consultas y reclamos, y un formulario para abrir una nueva. */
export default function Help() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [tickets, setTickets] = useState<Reclamo[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [topic, setTopic] = useState(generalTopics[3].value);
  const [detail, setDetail] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_reclamos").select("*").order("ultimo_mensaje_at", { ascending: false }).limit(100);
    setTickets((data as Reclamo[]) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    if (!user) return;
    load();
    const channel = db.channel(`mis-tickets-${crypto.randomUUID()}`).on("postgres_changes", { event: "*", schema: "public", table: "delivery_reclamos", filter: `cliente_id=eq.${user.id}` }, load).subscribe();
    return () => { db.removeChannel(channel); };
  }, [user, load]);

  const create = async () => {
    setSaving(true);
    const { data, error } = await db.rpc("delivery_soporte_crear", { p_tipo: topic, p_detalle: detail.trim() });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Recibimos tu consulta");
    setOpen(false); setDetail("");
    if (data) navigate(`/app/ayuda/${data}`); else load();
  };

  return (
    <div className="mx-auto max-w-2xl px-4 pb-14 pt-5 sm:px-6">
      <PageHeader eyebrow="Soporte" title="Ayuda" subtitle="Escribinos y te respondemos por acá, con aviso a tu celular." actions={<Button className="rounded-full" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Nueva consulta</Button>} />
      {loading ? <div className="mt-10 flex justify-center"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div> : tickets.length === 0 ? (
        <EmptyState className="mt-6" icon={<Headset className="h-8 w-8" />} title="No tenés consultas" text="Si tenés un problema con un pedido, abrilo desde Mis pedidos. Para cualquier otra cosa, escribinos acá." />
      ) : (
        <ul className="mt-6 space-y-2">
          {tickets.map((ticket) => (
            <li key={ticket.id}>
              <Link to={`/app/ayuda/${ticket.id}`} className="flex items-center gap-3 rounded-2xl border bg-card p-4 hover:bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-extrabold">{reclamoTipoLabel[ticket.tipo]}</p>
                    <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-bold", ticketStateClass(ticket.estado))}>{estadoLabel[ticket.estado]}</span>
                  </div>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">{ticket.detalle}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{ticket.pedido_id ? `Pedido ${shortId(ticket.pedido_id)} · ` : ""}{formatDateTime(ticket.ultimo_mensaje_at || ticket.created_at)}</p>
                </div>
                {ticket.estado === "esperando_cliente" && <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-primary" aria-label="Te respondieron" />}
                <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
              </Link>
            </li>
          ))}
        </ul>
      )}
      <p className="mt-6 text-center text-xs text-muted-foreground">{tickets.some((ticket) => isOpenTicket(ticket.estado)) ? "Te avisamos cuando respondamos." : "Respondemos en minutos durante el horario de atención."}</p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogTitle className="text-xl font-black">Nueva consulta</DialogTitle>
          <DialogDescription>¿Es por un pedido? Abrilo desde Mis pedidos para que lo veamos con todo el contexto.</DialogDescription>
          <div className="grid gap-2 sm:grid-cols-2" role="radiogroup" aria-label="Tema">
            {generalTopics.map((item) => (
              <button key={item.value} type="button" role="radio" aria-checked={topic === item.value} onClick={() => setTopic(item.value)} className={cn("rounded-2xl border p-3 text-left", topic === item.value ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                <span className="block text-sm font-bold">{item.label}</span><span className="block text-xs text-muted-foreground">{item.hint}</span>
              </button>
            ))}
          </div>
          <Textarea value={detail} maxLength={1500} onChange={(event) => setDetail(event.target.value)} placeholder="Contanos qué pasó" className="min-h-[110px] resize-none" aria-label="Detalle" />
          <Button className="rounded-full" disabled={saving || detail.trim().length < 10} onClick={create}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Enviar consulta</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
