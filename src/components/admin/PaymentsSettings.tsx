import { FormEvent, useCallback, useEffect, useState } from "react";
import { CheckCircle2, ExternalLink, KeyRound, Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { db, DeliveryOrder, errorMessage, formatDateTime, money, shortId } from "@/lib/delivery";

type MpStatus = { configurado: boolean; modo: "prueba" | "produccion" | null; termina_en: string | null; actualizado: string | null; firma_configurada?: boolean };
type PagoFila = { id: string; pedido_id: string; estado: string; monto: number; actualizado_at: string; alertas: number };

/** Configuración de Mercado Pago (la credencial se guarda en el servidor y no se puede volver a leer) y reintegros pendientes. */
export function PaymentsSettings({ orders, onChange }: { orders: DeliveryOrder[]; onChange: () => void }) {
  const [status, setStatus] = useState<MpStatus | null>(null);
  const [token, setToken] = useState("");
  const [saving, setSaving] = useState(false);
  const [firma, setFirma] = useState("");
  const [concil, setConcil] = useState<{ cobrado: number; reintegrado: number; contracargos: number; neto: number; diferencias: { pago_id: string }[] } | null>(null);
  const [pagos, setPagos] = useState<{ pagos: PagoFila[]; incidentes_24h: number } | null>(null);

  const load = useCallback(async () => {
    const { data } = await db.rpc("delivery_admin_estado_mp");
    setStatus(data);
    const { data: lista } = await db.rpc("delivery_admin_pagos", { p_limite: 20 });
    setPagos(lista ?? null);
    const { data: conc } = await db.rpc("delivery_admin_conciliacion_pagos");
    setConcil(conc ?? null);
  }, []);
  useEffect(() => { load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    setSaving(true);
    const { error } = await db.rpc("delivery_admin_guardar_mp", { p_access_token: token.trim() });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    setToken("");
    toast.success("Credencial guardada. Los clientes ya pueden pagar con Mercado Pago.");
    load();
  };

  const saveFirma = async (event: FormEvent) => {
    event.preventDefault();
    const { error } = await db.rpc("delivery_admin_guardar_mp_firma", { p_secret: firma.trim() });
    if (error) return toast.error(errorMessage(error));
    setFirma("");
    toast.success(firma.trim() ? "Clave de notificaciones guardada. Desde ahora se descartan los avisos sin firma válida." : "Verificación de firma desactivada");
    load();
  };

  const remove = async () => {
    if (!window.confirm("¿Desactivar el pago con Mercado Pago? Los clientes van a poder pagar solo al recibir.")) return;
    const { error } = await db.rpc("delivery_admin_guardar_mp", { p_access_token: "" });
    if (error) return toast.error(errorMessage(error));
    toast.success("Pago online desactivado");
    load();
  };

  const markRefunded = async (order: DeliveryOrder) => {
    const { error } = await db.rpc("delivery_admin_marcar_reintegrado", { p_pedido: order.id });
    if (error) return toast.error(errorMessage(error));
    toast.success("Reintegro registrado");
    onChange();
  };

  const refunds = orders.filter((order) => order.pago_estado === "a_reintegrar");
  const paidOnline = orders.filter((order) => order.pago_estado === "aprobado");

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h3 className="flex items-center gap-2 font-extrabold"><Wallet className="h-5 w-5 text-primary" />Mercado Pago</h3>
        {status?.configurado ? (
          <div className="mt-3 rounded-2xl bg-success/10 p-3 text-sm">
            <p className="flex items-center gap-1.5 font-bold text-success"><CheckCircle2 className="h-4 w-4" />Activo en modo {status.modo === "prueba" ? "de prueba" : "producción"}</p>
            <p className="mt-1 text-muted-foreground">Credencial terminada en …{status.termina_en} · actualizada {formatDateTime(status.actualizado)}</p>
          </div>
        ) : <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">Todavía no está configurado. Mientras tanto, los clientes pagan en efectivo, tarjeta o transferencia al recibir.</p>}

        <form onSubmit={save} className="mt-4 space-y-2">
          <label htmlFor="mp-token" className="text-sm font-bold">{status?.configurado ? "Reemplazar credencial" : "Access Token de Mercado Pago"}</label>
          <div className="flex gap-2">
            <Input id="mp-token" type="password" autoComplete="off" value={token} onChange={(event) => setToken(event.target.value)} placeholder="APP_USR-…" />
            <Button type="submit" disabled={saving || token.trim().length < 20}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}Guardar</Button>
          </div>
          <p className="text-xs text-muted-foreground">Se guarda cifrada en el servidor y nadie la puede volver a ver desde la app (ni vos). Usá una que empiece con <b>TEST-</b> para probar sin cobrar de verdad.</p>
        </form>
        {status?.configurado && <Button variant="ghost" size="sm" className="mt-2 text-destructive" onClick={remove}>Desactivar pago online</Button>}

        <div className="mt-4 rounded-2xl border p-3">
          <p className="text-sm font-bold">Seguridad de las notificaciones {status?.firma_configurada ? <span className="text-success">· firma activa</span> : <span className="text-destructive">· sin verificar</span>}</p>
          <p className="mt-1 text-xs text-muted-foreground">Dirección a cargar en Mercado Pago (Webhooks, evento “Pagos”): <code className="break-all">{import.meta.env.VITE_SUPABASE_URL}/functions/v1/mp-webhook</code></p>
          <form onSubmit={saveFirma} className="mt-2 flex gap-2">
            <Input type="password" autoComplete="off" value={firma} onChange={(event) => setFirma(event.target.value)} placeholder="Clave secreta del webhook" aria-label="Clave secreta del webhook" />
            <Button type="submit" variant="outline" disabled={firma.trim().length > 0 && firma.trim().length < 16}>Guardar</Button>
          </form>
          <p className="mt-1 text-xs text-muted-foreground">Con la clave cargada, el servidor descarta cualquier aviso que no venga firmado por Mercado Pago. Dejala vacía y guardá para desactivarlo.</p>
        </div>

        <ol className="mt-4 list-decimal space-y-1 pl-5 text-sm text-muted-foreground">
          <li>Entrá a <a href="https://www.mercadopago.com.ar/developers/panel/app" target="_blank" rel="noreferrer" className="font-semibold text-primary hover:underline">Mercado Pago Developers <ExternalLink className="inline h-3 w-3" /></a> con tu cuenta.</li>
          <li>Creá una aplicación (tipo “Pagos online”, producto “Checkout Pro”).</li>
          <li>En “Credenciales de producción” copiá el <b>Access Token</b> y pegalo arriba.</li>
        </ol>
      </section>

      <section className="rounded-3xl border bg-card p-4 sm:p-5 lg:col-span-2">
        <h3 className="font-extrabold">Cobros recientes {pagos && pagos.incidentes_24h > 0 && <span className="ml-2 rounded-full bg-destructive/10 px-2 py-0.5 text-xs text-destructive">{pagos.incidentes_24h} avisos con firma inválida en 24 h</span>}</h3>
        {concil && (
          <div className="mt-3 grid grid-cols-2 gap-2 text-sm sm:grid-cols-4">
            <p className="rounded-2xl bg-muted p-3"><span className="block text-xs text-muted-foreground">Cobrado</span><b>{money(concil.cobrado)}</b></p>
            <p className="rounded-2xl bg-muted p-3"><span className="block text-xs text-muted-foreground">Reintegrado</span><b>{money(concil.reintegrado)}</b></p>
            <p className="rounded-2xl bg-muted p-3"><span className="block text-xs text-muted-foreground">Contracargos</span><b>{money(concil.contracargos)}</b></p>
            <p className={`rounded-2xl p-3 ${concil.diferencias.length ? "bg-destructive/10 text-destructive" : "bg-success/10"}`}><span className="block text-xs text-muted-foreground">Neto en el libro</span><b>{money(concil.neto)}</b>{concil.diferencias.length > 0 && <span className="block text-xs font-bold">{concil.diferencias.length} pagos no concilian</span>}</p>
          </div>
        )}
        {pagos?.pagos.length ? (
          <ul className="mt-3 divide-y rounded-2xl border">
            {pagos.pagos.map((pago) => (
              <li key={pago.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1"><span className="block font-bold">{shortId(pago.pedido_id)} · {money(pago.monto)}</span><span className="block text-muted-foreground">{formatDateTime(pago.actualizado_at)}</span></span>
                {pago.alertas > 0 && <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-xs font-bold text-destructive">Revisar ({pago.alertas})</span>}
                <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold capitalize">{pago.estado}</span>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">Todavía no se registró ningún cobro online.</p>}
      </section>

      <section className="rounded-3xl border bg-card p-4 sm:p-5">
        <h3 className="font-extrabold">Reintegros pendientes ({refunds.length})</h3>
        <p className="text-sm text-muted-foreground">Pedidos pagados online que se cancelaron. Devolvé el dinero desde tu cuenta de Mercado Pago (Actividad → el pago → Devolver) y marcalo acá.</p>
        {refunds.length ? (
          <ul className="mt-3 divide-y rounded-2xl border">
            {refunds.map((order) => (
              <li key={order.id} className="flex flex-wrap items-center gap-3 p-3 text-sm">
                <span className="min-w-0 flex-1"><span className="block font-bold">{shortId(order.id)} · {order.comercio?.nombre}</span><span className="block text-muted-foreground">{money(order.total)} · {formatDateTime(order.created_at)}</span></span>
                <Button size="sm" variant="outline" className="rounded-full" onClick={() => markRefunded(order)}>Marcar reintegrado</Button>
              </li>
            ))}
          </ul>
        ) : <p className="mt-3 rounded-2xl bg-muted p-3 text-sm text-muted-foreground">No hay reintegros pendientes.</p>}
        <p className="mt-4 text-sm text-muted-foreground">Cobrado online en los últimos pedidos: <b className="text-foreground">{money(paidOnline.reduce((total, order) => total + Number(order.total), 0))}</b> ({paidOnline.length} pedidos)</p>
      </section>
    </div>
  );
}
