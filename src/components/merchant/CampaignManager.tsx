import { FormEvent, useCallback, useEffect, useState } from "react";
import { BellRing, Loader2, Send, Users } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Campaign, CampaignCounts, CampaignSegment, loadCampaignCounts, segmentLabel, segments, validateCampaign } from "@/lib/campanas";
import { Coupon, db, errorMessage, formatDateTime } from "@/lib/delivery";
import { cn } from "@/lib/utils";

/** Campañas del comercio: aviso push a sus clientes, sin ver quiénes son y con tope de frecuencia. */
export function CampaignManager({ storeId, storeName, coupons }: { storeId: string; storeName: string; coupons: Coupon[] }) {
  const [counts, setCounts] = useState<CampaignCounts | null | undefined>(undefined);
  const [history, setHistory] = useState<Campaign[]>([]);
  const [segment, setSegment] = useState<CampaignSegment>("recientes");
  const [title, setTitle] = useState("");
  const [message, setMessage] = useState("");
  const [coupon, setCoupon] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);

  const load = useCallback(async () => {
    const [c, { data }] = await Promise.all([loadCampaignCounts(storeId), db.from("delivery_campanas").select("*").eq("comercio_id", storeId).order("created_at", { ascending: false }).limit(20)]);
    setCounts(c);
    setHistory(data || []);
  }, [storeId]);
  useEffect(() => { load(); }, [load]);

  const active = coupons.filter((item) => item.activo && !(item as Coupon & { cliente_id?: string | null }).cliente_id && (!item.vence_at || new Date(item.vence_at) > new Date()));
  const audience = counts ? counts[segment] : 0;
  const next = counts?.proxima_campana ? new Date(counts.proxima_campana) : null;
  const waiting = next !== null && next.getTime() > Date.now();
  const problem = validateCampaign(title, message);

  const review = (event: FormEvent) => {
    event.preventDefault();
    if (problem) return toast.error(problem);
    if (!audience) return toast.error("Ahora no hay clientes de este grupo que puedan recibir el aviso");
    setConfirming(true);
  };
  const send = async () => {
    setSending(true);
    const { error } = await db.rpc("delivery_campana_crear", { p_comercio: storeId, p_segmento: segment, p_titulo: title, p_mensaje: message, p_cupon: coupon || null });
    setSending(false);
    if (error) { setConfirming(false); return toast.error(errorMessage(error)); }
    toast.success("¡Campaña enviada! En unos segundos les llega el aviso.");
    setConfirming(false); setTitle(""); setMessage(""); setCoupon("");
    load();
  };

  if (counts === undefined) return <div className="flex justify-center py-16"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <p className="text-sm text-muted-foreground">Mandá un aviso al celular de tus clientes para que vuelvan a pedir. Solo les llega a quienes aceptaron recibir promociones y vos no ves quiénes son. Una campaña cada 48 horas y sin enlaces.</p>

      <form onSubmit={review} className="space-y-5 rounded-3xl border bg-card p-4 sm:p-5">
        <div>
          <p className="font-extrabold">1. ¿A quiénes?</p>
          <div role="radiogroup" aria-label="Grupo de clientes" className="mt-2 grid gap-2 sm:grid-cols-2">
            {segments.map((item) => (
              <button key={item.id} type="button" role="radio" aria-checked={segment === item.id} onClick={() => setSegment(item.id)} className={cn("rounded-2xl border p-3 text-left transition-colors", segment === item.id ? "border-primary bg-primary/5" : "hover:bg-muted")}>
                <span className="flex items-center justify-between gap-2"><span className="font-bold">{item.label}</span><span className="flex items-center gap-1 rounded-full bg-muted px-2 py-0.5 text-xs font-extrabold"><Users className="h-3 w-3" />{counts ? counts[item.id] : 0}</span></span>
                <span className="mt-0.5 block text-xs text-muted-foreground">{item.hint}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="space-y-3">
          <p className="font-extrabold">2. ¿Qué les decís?</p>
          <div className="space-y-1.5"><Label htmlFor="c-title">Título</Label><Input id="c-title" value={title} maxLength={50} onChange={(event) => setTitle(event.target.value)} placeholder="Ej.: 20% de descuento hoy" /><p className="text-right text-xs text-muted-foreground">{title.length}/50</p></div>
          <div className="space-y-1.5"><Label htmlFor="c-msg">Mensaje</Label><Textarea id="c-msg" value={message} maxLength={140} onChange={(event) => setMessage(event.target.value)} placeholder="Ej.: Pedí hoy y ahorrá. Solo hasta las 23." className="min-h-[72px] resize-none" /><p className="text-right text-xs text-muted-foreground">{message.length}/140</p></div>
          <div className="space-y-1.5">
            <Label htmlFor="c-coupon">Cupón (opcional)</Label>
            <select id="c-coupon" value={coupon} onChange={(event) => setCoupon(event.target.value)} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              <option value="">Sin cupón</option>
              {active.map((item) => <option key={item.id} value={item.codigo}>{item.codigo} · {item.descripcion}</option>)}
            </select>
            <p className="text-xs text-muted-foreground">Si elegís un cupón, el aviso lo incluye y lleva directo a tu local. Creá cupones en Promociones.</p>
          </div>
        </div>

        <div>
          <p className="text-xs font-bold uppercase text-muted-foreground">Así lo van a ver</p>
          <div className="mt-2 flex max-w-sm items-start gap-3 rounded-2xl border bg-background p-3 shadow-soft">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground"><BellRing className="h-5 w-5" /></span>
            <span className="min-w-0 text-sm"><span className="block font-bold">{title.trim() || "Tu título"}</span><span className="block text-muted-foreground">{message.trim() || "Tu mensaje"}{coupon ? ` Cupón: ${coupon}` : ""}</span><span className="mt-1 block text-[11px] text-muted-foreground">{storeName} · Woref</span></span>
          </div>
        </div>

        {waiting && <p className="rounded-2xl bg-warning/15 p-3 text-sm font-semibold">Podés enviar la próxima campaña a partir del {formatDateTime(counts!.proxima_campana!)}.</p>}
        <Button type="submit" className="h-12 rounded-full px-8 font-extrabold" disabled={waiting || !audience}><Send className="h-4 w-4" />Revisar y enviar a {audience} {audience === 1 ? "persona" : "personas"}</Button>
      </form>

      <section>
        <h2 className="font-extrabold">Campañas enviadas</h2>
        {history.length === 0 ? <EmptyState className="mt-3 py-8" icon={<Send className="h-6 w-6" />} title="Todavía no enviaste campañas" /> : (
          <ul className="mt-3 divide-y overflow-hidden rounded-3xl border bg-card">
            {history.map((item) => (
              <li key={item.id} className="p-3">
                <div className="flex flex-wrap items-center gap-2"><p className="font-bold">{item.titulo}</p><span className="text-xs text-muted-foreground">{formatDateTime(item.created_at)}</span><span className={cn("ml-auto rounded-full px-2.5 py-0.5 text-xs font-bold", item.estado === "enviada" ? "bg-success/10 text-success" : item.estado === "fallida" ? "bg-destructive/10 text-destructive" : "bg-warning/20")}>{item.estado === "enviada" ? "Enviada" : item.estado === "fallida" ? "No se pudo enviar" : "Enviando…"}</span></div>
                <p className="text-sm text-muted-foreground">{item.mensaje}{item.cupon_codigo ? ` · Cupón ${item.cupon_codigo}` : ""}</p>
                <p className="mt-1 text-xs font-semibold">{segmentLabel(item.segmento)} · {item.enviados} de {item.destinatarios} recibieron el aviso</p>
              </li>
            ))}
          </ul>
        )}
      </section>

      <Dialog open={confirming} onOpenChange={(open) => !sending && setConfirming(open)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-xl font-black">¿Enviar la campaña?</DialogTitle>
          <DialogDescription>Le llega a {audience} {audience === 1 ? "persona" : "personas"} ({segmentLabel(segment).toLowerCase()}). No se puede deshacer y no podrás mandar otra por 48 horas.</DialogDescription>
          <div className="rounded-2xl bg-muted p-3 text-sm"><p className="font-bold">{title.trim()}</p><p className="text-muted-foreground">{message.trim()}{coupon ? ` Cupón: ${coupon}` : ""}</p></div>
          <Button className="rounded-full font-bold" onClick={send} disabled={sending}>{sending && <Loader2 className="h-4 w-4 animate-spin" />}Sí, enviar ahora</Button>
        </DialogContent>
      </Dialog>
    </div>
  );
}
