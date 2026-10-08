import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowLeft, Clock, Gift, Loader2, Star, UserCheck } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { ChatButton } from "@/components/delivery/OrderChat";
import { SupportContext } from "@/components/admin/SupportContext";
import { TicketThread } from "@/components/support/TicketThread";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/contexts/AuthContext";
import { db, errorMessage, formatDateTime, money, reclamoTipoLabel, shortId } from "@/lib/delivery";
import { AdminTicket, estadoLabel, isOpenTicket, Prioridad, slaState, SupportData, waitLabel } from "@/lib/support";
import { cn } from "@/lib/utils";

type Filter = "mios" | "sin_asignar" | "abiertos" | "esperando" | "resueltos";
const filterLabel: Record<Filter, string> = { mios: "Mis tickets", sin_asignar: "Sin asignar", abiertos: "Todos los abiertos", esperando: "Esperando al cliente", resueltos: "Resueltos" };
const prioClass: Record<Prioridad, string> = { normal: "bg-muted text-muted-foreground", alta: "bg-warning/20 text-foreground", urgente: "bg-destructive/15 text-destructive" };
const slaClass = { ok: "", riesgo: "border-l-4 border-l-warning", vencido: "border-l-4 border-l-destructive" };

/** Centro de soporte: bandeja con prioridades y SLA, conversación en tiempo real, respuestas rápidas y resolución con reintegro o crédito. */
export function SupportCenter({ onChange }: { onChange?: (openCount: number) => void }) {
  const { user } = useAuth();
  const [data, setData] = useState<SupportData | null>(null);
  const [templates, setTemplates] = useState<{ id: string; titulo: string; texto: string }[]>([]);
  const [filter, setFilter] = useState<Filter>("abiertos");
  const [activeId, setActiveId] = useState<string | null>(null);
  const [now, setNow] = useState(Date.now());

  const load = useCallback(async () => {
    const { data: result, error } = await db.rpc("delivery_admin_soporte");
    if (error) return toast.error(errorMessage(error));
    const next = result as unknown as SupportData;
    setData(next);
    onChange?.(next.tickets.filter((ticket) => isOpenTicket(ticket.estado)).length);
  }, [onChange]);

  useEffect(() => {
    load();
    db.from("delivery_soporte_respuestas").select("id,titulo,texto").eq("activo", true).order("orden").then(({ data: rows }) => setTemplates(rows || []));
    const channel = db.channel(`admin-soporte-${crypto.randomUUID()}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "delivery_reclamos" }, load)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "delivery_reclamo_mensajes" }, load)
      .subscribe();
    const tick = window.setInterval(() => setNow(Date.now()), 30000);
    return () => { db.removeChannel(channel); window.clearInterval(tick); };
  }, [load]);

  const counts = useMemo(() => {
    const tickets = data?.tickets || [];
    const open = tickets.filter((ticket) => isOpenTicket(ticket.estado));
    return {
      mios: open.filter((ticket) => ticket.asignado_a === user?.id).length,
      sin_asignar: open.filter((ticket) => !ticket.asignado_a).length,
      abiertos: open.length,
      esperando: tickets.filter((ticket) => ticket.estado === "esperando_cliente").length,
      resueltos: tickets.filter((ticket) => !isOpenTicket(ticket.estado)).length,
    };
  }, [data, user?.id]);

  const visible = useMemo(() => (data?.tickets || []).filter((ticket) => {
    if (filter === "resueltos") return !isOpenTicket(ticket.estado);
    if (!isOpenTicket(ticket.estado)) return false;
    if (filter === "mios") return ticket.asignado_a === user?.id;
    if (filter === "sin_asignar") return !ticket.asignado_a;
    if (filter === "esperando") return ticket.estado === "esperando_cliente";
    return true;
  }), [data, filter, user?.id]);

  const active = data?.tickets.find((ticket) => ticket.id === activeId) || null;
  const stats = useMemo(() => {
    const rated = (data?.tickets || []).filter((ticket) => ticket.csat);
    const late = (data?.tickets || []).filter((ticket) => slaState(ticket, data!.sla, now) === "vencido").length;
    return { csat: rated.length ? rated.reduce((sum, ticket) => sum + (ticket.csat || 0), 0) / rated.length : null, rated: rated.length, late };
  }, [data, now]);

  if (!data) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div>
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Abiertos</p><p className="text-2xl font-black">{counts.abiertos}</p></div>
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Fuera de SLA</p><p className={cn("text-2xl font-black", stats.late > 0 && "text-destructive")}>{stats.late}</p><p className="text-xs text-muted-foreground">Respuesta {data.sla.respuesta_min} min · resolución {data.sla.resolucion_horas} h</p></div>
        <div className="rounded-2xl border bg-card p-4"><p className="text-xs font-bold uppercase text-muted-foreground">Satisfacción (14 días)</p><p className="text-2xl font-black">{stats.csat ? `${stats.csat.toFixed(1)} / 5` : "—"}</p><p className="text-xs text-muted-foreground">{stats.rated} calificaciones</p></div>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
        <div className={cn(active && "hidden lg:block")}>
          <div className="flex flex-wrap gap-2">
            {(Object.keys(filterLabel) as Filter[]).map((value) => (
              <button key={value} type="button" onClick={() => setFilter(value)} className={cn("rounded-full border px-3 py-1.5 text-sm font-bold", filter === value ? "border-foreground bg-foreground text-background" : "bg-card")}>{filterLabel[value]} ({counts[value]})</button>
            ))}
          </div>
          {visible.length === 0 ? <EmptyState className="mt-4" title="Bandeja vacía" text="No hay tickets en esta vista." /> : (
            <ul className="mt-3 space-y-2">
              {visible.map((ticket) => {
                const sla = slaState(ticket, data.sla, now);
                return (
                  <li key={ticket.id}>
                    <button type="button" onClick={() => setActiveId(ticket.id)} className={cn("w-full rounded-2xl border bg-card p-3 text-left hover:bg-muted/50", slaClass[sla], activeId === ticket.id && "ring-2 ring-primary")}>
                      <div className="flex items-start justify-between gap-2">
                        <p className="font-extrabold">{reclamoTipoLabel[ticket.tipo]}</p>
                        <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[11px] font-bold", prioClass[ticket.prioridad])}>{ticket.prioridad}</span>
                      </div>
                      <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{ticket.detalle}</p>
                      <p className="mt-1.5 flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
                        <span className="font-semibold text-foreground">{ticket.cliente}</span>
                        <span>{estadoLabel[ticket.estado]}</span>
                        {isOpenTicket(ticket.estado) && <span className={cn("flex items-center gap-1", sla === "vencido" && "font-bold text-destructive")}><Clock className="h-3 w-3" />{waitLabel(ticket.created_at, now)}</span>}
                        {ticket.ultimo_autor === "cliente" && isOpenTicket(ticket.estado) && <span className="font-bold text-primary">Respondió el cliente</span>}
                        <span>{ticket.agente ? `→ ${ticket.agente}` : "Sin asignar"}</span>
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className={cn(!active && "hidden lg:block")}>
          {active ? <TicketPanel key={active.id} ticket={active} data={data} templates={templates} userId={user?.id} now={now} onBack={() => setActiveId(null)} onChanged={load} /> : <EmptyState className="py-20" title="Elegí un ticket" text="Vas a ver la conversación, el pedido y las acciones de resolución." />}
        </div>
      </div>
    </div>
  );
}

function TicketPanel({ ticket, data, templates, userId, now, onBack, onChanged }: { ticket: AdminTicket; data: SupportData; templates: { id: string; titulo: string; texto: string }[]; userId?: string; now: number; onBack: () => void; onChanged: () => void }) {
  const [resolution, setResolution] = useState("");
  const [refund, setRefund] = useState("");
  const [credit, setCredit] = useState("");
  const [saving, setSaving] = useState(false);
  const open = isOpenTicket(ticket.estado);
  const sla = slaState(ticket, data.sla, now);

  const run = async (action: () => PromiseLike<{ error: { message: string } | null }>, ok?: string) => {
    setSaving(true);
    const { error } = await action();
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    if (ok) toast.success(ok);
    onChanged();
  };

  const resolve = async (estado: "resuelto" | "rechazado") => {
    setSaving(true);
    const { data: code, error } = await db.rpc("delivery_soporte_resolver", { p_reclamo: ticket.id, p_estado: estado, p_resolucion: resolution.trim(), p_reintegro: Number(refund.replace(/\D/g, "") || 0), p_credito: Number(credit.replace(/\D/g, "") || 0) });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(code ? `Cerrado. Cupón de crédito: ${code}` : "Ticket cerrado");
    setResolution(""); setRefund(""); setCredit("");
    onChanged();
  };

  return (
    <div className="rounded-3xl border bg-card p-4 sm:p-5">
      <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-sm font-bold text-primary lg:hidden"><ArrowLeft className="h-4 w-4" />Volver a la bandeja</button>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <h2 className="text-lg font-black">{reclamoTipoLabel[ticket.tipo]}</h2>
          <p className="text-xs text-muted-foreground">Abierto {formatDateTime(ticket.created_at)} · {estadoLabel[ticket.estado]}{sla !== "ok" && <span className={cn("ml-2 font-bold", sla === "vencido" ? "text-destructive" : "text-warning")}>SLA {sla}</span>}</p>
        </div>
        {ticket.csat && <span className="flex items-center gap-1 text-sm font-bold"><Star className="h-4 w-4 fill-warning text-warning" />{ticket.csat}/5</span>}
      </div>

      <div className="mt-3 grid gap-2 rounded-2xl bg-muted/60 p-3 text-sm sm:grid-cols-2">
        <div>
          <p className="font-bold">{ticket.cliente}</p>
          <p className="text-xs text-muted-foreground">{ticket.cliente_email || "Sin email"}{ticket.cliente_telefono ? ` · ${ticket.cliente_telefono}` : ""}</p>
          <p className="text-xs text-muted-foreground">{ticket.tickets_cliente} ticket{ticket.tickets_cliente === 1 ? "" : "s"} en total</p>
        </div>
        {ticket.pedido_id ? (
          <div>
            <p className="font-bold">Pedido {shortId(ticket.pedido_id)} · {ticket.comercio}</p>
            <p className="text-xs text-muted-foreground">{money(ticket.pedido_total)} · {ticket.pedido_estado} · {ticket.pedido_pago}</p>
            <div className="mt-1.5 flex flex-wrap gap-1.5">
              <ChatButton pedidoId={ticket.pedido_id} canal="comercio" label="Chat comercio" title="Chat cliente ↔ comercio" readOnly />
              {ticket.pedido_repartidor && <ChatButton pedidoId={ticket.pedido_id} canal="repartidor" label="Chat repartidor" title="Chat cliente ↔ repartidor" readOnly />}
              {ticket.pedido_repartidor && <ChatButton pedidoId={ticket.pedido_id} canal="comercio_repartidor" label="Comercio ↔ repartidor" title="Chat comercio ↔ repartidor" readOnly />}
            </div>
          </div>
        ) : <p className="text-xs text-muted-foreground">Consulta general, sin pedido asociado.</p>}
      </div>
      <SupportContext ticketId={ticket.id} />

      {open && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
          <label className="flex items-center gap-1.5 font-semibold">Prioridad
            <select value={ticket.prioridad} disabled={saving} onChange={(event) => run(() => db.rpc("delivery_soporte_prioridad", { p_reclamo: ticket.id, p_prioridad: event.target.value }))} className="rounded-lg border bg-background px-2 py-1.5">
              <option value="normal">Normal</option><option value="alta">Alta</option><option value="urgente">Urgente</option>
            </select>
          </label>
          <label className="flex items-center gap-1.5 font-semibold">Asignado a
            <select value={ticket.asignado_a || ""} disabled={saving} onChange={(event) => run(() => db.rpc("delivery_soporte_asignar", { p_reclamo: ticket.id, p_agente: event.target.value || null }))} className="rounded-lg border bg-background px-2 py-1.5">
              <option value="">Sin asignar</option>
              {data.agentes.map((agent) => <option key={agent.id} value={agent.id}>{agent.nombre}{agent.id === userId ? " (yo)" : ""}</option>)}
            </select>
          </label>
          {ticket.asignado_a !== userId && userId && <Button size="sm" variant="outline" className="rounded-full" disabled={saving} onClick={() => run(() => db.rpc("delivery_soporte_asignar", { p_reclamo: ticket.id, p_agente: userId }), "Ticket asignado a vos")}><UserCheck className="h-4 w-4" />Tomar</Button>}
        </div>
      )}

      <div className="mt-4"><TicketThread ticketId={ticket.id} staff canReply templates={templates} onSent={onChanged} /></div>

      {open ? (
        <section className="mt-5 rounded-2xl border p-3">
          <h3 className="font-extrabold">Cerrar ticket</h3>
          <Textarea value={resolution} maxLength={1000} onChange={(event) => setResolution(event.target.value)} placeholder="Resolución que va a leer el cliente" className="mt-2 min-h-[70px] resize-none" aria-label="Resolución" />
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {ticket.pedido_id && (
              <div><label htmlFor={`refund-${ticket.id}`} className="text-xs font-bold">Reintegro ($)</label><Input id={`refund-${ticket.id}`} inputMode="numeric" value={refund} onChange={(event) => setRefund(event.target.value.replace(/\D/g, ""))} placeholder="0" /></div>
            )}
            <div><label htmlFor={`credit-${ticket.id}`} className="flex items-center gap-1 text-xs font-bold"><Gift className="h-3 w-3" />Crédito en cupón ($)</label><Input id={`credit-${ticket.id}`} inputMode="numeric" value={credit} onChange={(event) => setCredit(event.target.value.replace(/\D/g, ""))} placeholder="0" /></div>
          </div>
          <div className="mt-3 flex gap-2">
            <Button className="flex-1 rounded-full" disabled={saving || resolution.trim().length < 5} onClick={() => resolve("resuelto")}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Resolver</Button>
            <Button variant="outline" className="rounded-full" disabled={saving || resolution.trim().length < 5} onClick={() => resolve("rechazado")}>Rechazar</Button>
          </div>
        </section>
      ) : (
        <p className="mt-4 rounded-2xl bg-muted p-3 text-sm">{ticket.estado === "resuelto" ? "Resuelto" : "Cerrado"}{ticket.resuelto_at ? ` el ${formatDateTime(ticket.resuelto_at)}` : ""}.{Number(ticket.reembolso_monto) > 0 ? ` Reintegro ${money(ticket.reembolso_monto)}.` : ""}{ticket.credito_codigo ? ` Cupón ${ticket.credito_codigo}.` : ""}{ticket.csat_comentario ? ` Comentario del cliente: “${ticket.csat_comentario}”` : ""}</p>
      )}
    </div>
  );
}
