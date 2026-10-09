import { FormEvent, useCallback, useEffect, useState } from "react";
import { Check, Copy, Gift, Loader2, Share2, Sparkles, Ticket, Trophy, Users } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/delivery/Common";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { couponLabel, PersonalCoupon } from "@/hooks/useMyCoupons";
import { db, errorMessage, formatDateTime, money } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/ui/dialogos";

type Level = "bronce" | "plata" | "oro";
type Reward = { id: string; nombre: string; descripcion: string | null; puntos: number };
type Summary = {
  saldo: number; ganados: number; nivel: Level; multiplicador: number; siguiente: number | null; pesos_por_punto: number;
  movimientos: { puntos: number; motivo: string; nota: string | null; fecha: string }[];
  premios: Reward[]; cupones: PersonalCoupon[];
  referidos: { pendientes: number; premiados: number; credito: number; minimo: number; uso_codigo: boolean; puede_usar: boolean };
};

const levelInfo: Record<Level, { label: string; tone: string; perk: string }> = {
  bronce: { label: "Bronce", tone: "from-amber-700 to-amber-500", perk: "1 punto cada $100" },
  plata: { label: "Plata", tone: "from-slate-500 to-slate-300", perk: "25% más de puntos" },
  oro: { label: "Oro", tone: "from-yellow-600 to-yellow-400", perk: "50% más de puntos" },
};
const reasonLabel: Record<string, string> = { compra: "Compra", envio: "Envío de paquete", canje: "Canje de premio", bono: "Bono", referido: "Amigo referido", ajuste: "Ajuste" };

/** Woref Club: puntos por cada compra, niveles, premios canjeables y amigos referidos. */
export default function Club() {
  const [data, setData] = useState<Summary | null>(null);
  const [code, setCode] = useState<string | null>(null);
  const [friendCode, setFriendCode] = useState("");
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data: summary, error } = await db.rpc("delivery_club_resumen");
    if (error) { toast.error(errorMessage(error)); return; }
    setData(summary);
  }, []);
  useEffect(() => {
    load();
    db.rpc("delivery_mi_codigo_referido").then(({ data: value }: { data: string | null }) => setCode(value));
  }, [load]);

  const redeem = async (reward: Reward) => {
    if (!(await confirmar({ titulo: `¿Canjear “${reward.nombre}”?`, descripcion: `Se descuentan ${reward.puntos} puntos de tu saldo.`, confirmar: "Canjear" }))) return;
    setBusy(reward.id);
    const { data: coupon, error } = await db.rpc("delivery_club_canjear", { p_premio: reward.id });
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success(`¡Listo! Tu cupón es ${coupon}. Lo ves en el carrito.`);
    load();
  };
  const useFriendCode = async (event: FormEvent) => {
    event.preventDefault();
    setBusy("friend");
    const { error } = await db.rpc("delivery_usar_codigo_referido", { p_codigo: friendCode });
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success("¡Código aplicado! Cuando recibas tu primer pedido, los dos ganan crédito.");
    setFriendCode("");
    load();
  };
  const copy = async (text: string) => {
    try { await navigator.clipboard.writeText(text); toast.success("Copiado"); } catch { toast.error("No pudimos copiar"); }
  };
  const share = async () => {
    if (!code) return;
    const text = `Pedí en Woref con mi código ${code} y los dos ganamos ${money(data?.referidos.credito ?? 2000)} de descuento: ${window.location.origin}`;
    if (navigator.share) { try { await navigator.share({ title: "Woref", text }); } catch { /* cancelado */ } } else copy(text);
  };

  if (!data) return <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>;

  const level = levelInfo[data.nivel];
  const nextAt = data.siguiente;
  const progress = nextAt ? Math.min(100, Math.round((data.ganados / nextAt) * 100)) : 100;

  return (
    <div className="mx-auto max-w-4xl px-4 pb-16 pt-5 sm:px-6">
      <PageHeader eyebrow="Beneficios" title="Woref Club" />

      <section className={cn("mt-5 overflow-hidden rounded-3xl bg-gradient-to-br p-5 text-white shadow-pop sm:p-6", level.tone)}>
        <div className="flex items-start justify-between gap-3">
          <div><p className="flex items-center gap-1.5 text-sm font-bold text-white/85"><Trophy className="h-4 w-4" />Nivel {level.label}</p><p className="mt-1 font-display text-5xl font-black tabular-nums">{data.saldo.toLocaleString("es-AR")}</p><p className="text-sm font-semibold text-white/85">puntos disponibles</p></div>
          <span className="rounded-full bg-white/20 px-3 py-1 text-xs font-extrabold">{level.perk}</span>
        </div>
        <div className="mt-5">
          <div className="h-2.5 overflow-hidden rounded-full bg-white/25"><div className="h-full rounded-full bg-white transition-all" style={{ width: `${progress}%` }} /></div>
          <p className="mt-1.5 text-xs font-semibold text-white/90">{nextAt ? `Te faltan ${(nextAt - data.ganados).toLocaleString("es-AR")} puntos ganados para el nivel ${data.nivel === "bronce" ? "Plata" : "Oro"}` : "Llegaste al nivel más alto. ¡Gracias por pedir con Woref!"}</p>
        </div>
      </section>

      <section className="mt-6 grid gap-3 sm:grid-cols-3" aria-label="Cómo funciona">
        {[
          { icon: Sparkles, title: "Sumás puntos", text: `1 punto cada ${money(data.pesos_por_punto)} de tus pedidos entregados${data.multiplicador > 1 ? ` (x${data.multiplicador} por tu nivel)` : ""}. También por tus envíos.` },
          { icon: Gift, title: "Canjeás premios", text: "Cupones de descuento y envío gratis que se aplican en el carrito." },
          { icon: Trophy, title: "Subís de nivel", text: "Con más pedidos sumás más rápido: Plata +25% y Oro +50%." },
        ].map(({ icon: Icon, title, text }) => (
          <div key={title} className="rounded-3xl border bg-card p-4"><span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Icon className="h-5 w-5" /></span><p className="mt-2 font-extrabold">{title}</p><p className="text-sm text-muted-foreground">{text}</p></div>
        ))}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold">Premios</h2>
        <ul className="mt-3 grid gap-3 sm:grid-cols-2">
          {data.premios.map((reward) => {
            const missing = reward.puntos - data.saldo;
            return (
              <li key={reward.id} className="flex items-center gap-3 rounded-3xl border bg-card p-4">
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Ticket className="h-6 w-6" /></span>
                <div className="min-w-0 flex-1"><p className="font-extrabold">{reward.nombre}</p><p className="text-xs text-muted-foreground">{reward.descripcion}</p><p className="mt-0.5 text-sm font-bold text-primary">{reward.puntos.toLocaleString("es-AR")} puntos</p></div>
                <Button size="sm" className="rounded-full" disabled={missing > 0 || busy === reward.id} onClick={() => redeem(reward)}>{busy === reward.id ? <Loader2 className="h-4 w-4 animate-spin" /> : missing > 0 ? `Faltan ${missing}` : "Canjear"}</Button>
              </li>
            );
          })}
        </ul>
      </section>

      {data.cupones.length > 0 && (
        <section className="mt-8">
          <h2 className="text-lg font-extrabold">Mis cupones</h2>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {data.cupones.map((coupon) => (
              <li key={coupon.codigo} className="rounded-3xl border-2 border-dashed border-primary/50 bg-primary/5 p-4">
                <div className="flex items-center justify-between gap-2"><p className="font-display text-xl font-black text-primary">{couponLabel(coupon)}</p><button type="button" onClick={() => copy(coupon.codigo)} className="flex items-center gap-1 rounded-full bg-card px-2.5 py-1 font-mono text-xs font-bold"><Copy className="h-3 w-3" />{coupon.codigo}</button></div>
                <p className="text-sm text-muted-foreground">{coupon.descripcion}</p>
                <p className="mt-1 text-xs font-semibold text-muted-foreground">{Number(coupon.minimo) > 0 ? `Compra mínima ${money(coupon.minimo)} · ` : ""}{coupon.vence_at ? `Vence el ${new Date(coupon.vence_at).toLocaleDateString("es-AR", { day: "numeric", month: "long" })}` : "Sin vencimiento"}</p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="mt-8 rounded-3xl border bg-card p-4 sm:p-6">
        <h2 className="flex items-center gap-2 text-lg font-extrabold"><Users className="h-5 w-5 text-primary" />Invitá a un amigo</h2>
        <p className="mt-1 text-sm text-muted-foreground">Cuando tu amigo reciba su primer pedido (de {money(data.referidos.minimo)} o más), los dos reciben {money(data.referidos.credito)} de descuento.</p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <span className="rounded-2xl bg-muted px-5 py-3 font-mono text-2xl font-black tracking-[0.25em]" aria-label="Tu código">{code ?? "······"}</span>
          <Button variant="outline" className="rounded-full" onClick={() => code && copy(code)}><Copy className="h-4 w-4" />Copiar</Button>
          <Button className="rounded-full" onClick={share}><Share2 className="h-4 w-4" />Compartir</Button>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">{data.referidos.premiados} {data.referidos.premiados === 1 ? "amigo ya hizo" : "amigos ya hicieron"} su primer pedido · {data.referidos.pendientes} en camino.</p>
        {data.referidos.puede_usar && (
          <form onSubmit={useFriendCode} className="mt-5 flex max-w-sm gap-2 border-t pt-5">
            <Input value={friendCode} onChange={(event) => setFriendCode(event.target.value.toUpperCase())} maxLength={10} placeholder="¿Tenés el código de un amigo?" aria-label="Código de un amigo" className="uppercase placeholder:normal-case" />
            <Button type="submit" variant="outline" className="rounded-full" disabled={busy === "friend" || friendCode.trim().length < 4}>{busy === "friend" ? <Loader2 className="h-4 w-4 animate-spin" /> : "Usar"}</Button>
          </form>
        )}
        {data.referidos.uso_codigo && <p className="mt-4 flex items-center gap-1.5 text-sm font-semibold text-success"><Check className="h-4 w-4" />Ya usaste un código de amigo.</p>}
      </section>

      <section className="mt-8">
        <h2 className="text-lg font-extrabold">Movimientos</h2>
        {data.movimientos.length === 0 ? <p className="mt-3 rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Todavía no tenés movimientos. Tus puntos aparecen cuando recibís un pedido.</p> : (
          <ul className="mt-3 divide-y overflow-hidden rounded-3xl border bg-card">
            {data.movimientos.map((item, index) => (
              <li key={index} className="flex items-center gap-3 p-3 text-sm"><span className="min-w-0 flex-1"><span className="block font-bold">{reasonLabel[item.motivo] ?? item.motivo}</span><span className="block truncate text-xs text-muted-foreground">{item.nota ?? ""} {formatDateTime(item.fecha)}</span></span><span className={cn("font-extrabold tabular-nums", item.puntos > 0 ? "text-success" : "text-muted-foreground")}>{item.puntos > 0 ? "+" : ""}{item.puntos}</span></li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
