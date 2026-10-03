import { useCallback, useEffect, useState } from "react";
import { Bike, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { PayoutForm } from "@/components/account/PayoutForm";
import { IdentityReviewDialog, IdentityRow } from "@/components/admin/IdentityReview";
import { CourierWallet } from "@/components/courier/CourierWallet";
import { EmptyState } from "@/components/delivery/Common";
import { DocumentViewer } from "@/components/verification/DocumentViewer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { Identity, IdentityState } from "@/lib/identity";
import { cn } from "@/lib/utils";

export type CourierRow = {
  perfil_id: string; vehiculo: string; telefono?: string | null; disponible: boolean; activo: boolean; created_at: string;
  dni?: string | null; patente?: string | null; verificado: boolean; motivo_rechazo?: string | null; control_estado?: "requerido" | "en_revision" | null; aceptadas: number; rechazadas: number; soltados: number;
  perfil?: { nombre: string } | null;
};

const statusOf = (courier: CourierRow) => (courier.verificado ? "verificado" : courier.motivo_rechazo ? "rechazado" : "pendiente");

/** Verificación de repartidores, habilitación y cuenta corriente (pagos de ganancias y rendiciones de efectivo). */
export function CouriersManager({ couriers, onChange }: { couriers: CourierRow[]; onChange: () => void }) {
  const [rejecting, setRejecting] = useState<CourierRow | null>(null);
  const [reason, setReason] = useState("");
  const [account, setAccount] = useState<CourierRow | null>(null);
  const [docsOf, setDocsOf] = useState<CourierRow | null>(null);
  const [kind, setKind] = useState<"pago" | "rendicion">("pago");
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [refresh, setRefresh] = useState(0);
  const [identities, setIdentities] = useState<Map<string, IdentityState>>(new Map());
  const [reviewing, setReviewing] = useState<IdentityRow | null>(null);
  const [controlOf, setControlOf] = useState<CourierRow | null>(null);
  const [controlReason, setControlReason] = useState("");
  const askControl = async (courier: CourierRow) => {
    const { error } = await db.rpc("delivery_admin_pedir_control", { p_perfil: courier.perfil_id });
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success("Le pedimos una selfie de control: no puede conectarse hasta enviarla");
    onChange();
  };
  const resolveControl = async (ok: boolean) => {
    if (!controlOf) return;
    setSaving(true);
    const { error } = await db.rpc("delivery_admin_revisar_control", { p_perfil: controlOf.perfil_id, p_ok: ok, p_motivo: ok ? null : controlReason.trim() });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(ok ? "Control aprobado: ya puede conectarse" : "Le pedimos otra selfie");
    setControlOf(null); setControlReason("");
    onChange();
  };

  const loadIdentities = useCallback(async () => {
    const { data } = await db.from("delivery_identidad").select("perfil_id,estado");
    setIdentities(new Map((data || []).map((item: { perfil_id: string; estado: IdentityState }) => [item.perfil_id, item.estado])));
  }, []);
  useEffect(() => { loadIdentities(); }, [loadIdentities, couriers]);

  const waiting = (courier: CourierRow) => identities.get(courier.perfil_id) === "en_revision";
  const sorted = [...couriers].sort((a, b) => Number(!(statusOf(a) === "pendiente" && waiting(a))) - Number(!(statusOf(b) === "pendiente" && waiting(b))));

  const openReview = async (courier: CourierRow) => {
    const { data, error } = await db.from("delivery_identidad").select("*").eq("perfil_id", courier.perfil_id).maybeSingle();
    if (error || !data) { toast.error("Todavía no envió su identidad"); return; }
    setReviewing({ ...(data as Identity), perfil: courier.perfil ?? null, es_repartidor: true });
  };

  const verify = async (courier: CourierRow, approved: boolean, motive?: string) => {
    setSaving(true);
    if (approved) { await openReview(courier); return false; }
    const { error } = await db.rpc("delivery_admin_verificar_repartidor", { p_repartidor: courier.perfil_id, p_aprobado: false, p_motivo: motive ?? null });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return false; }
    toast.success(approved ? "Repartidor verificado" : "Repartidor rechazado");
    onChange();
    return true;
  };
  const setActive = async (courier: CourierRow, activo: boolean) => {
    const { error } = await db.from("delivery_repartidores").update({ activo, disponible: activo ? courier.disponible : false }).eq("perfil_id", courier.perfil_id);
    if (error) { toast.error(errorMessage(error)); return; }
    onChange();
  };
  const register = async () => {
    if (!account) return;
    const monto = Number(amount.replace(/\D/g, ""));
    if (!monto) { toast.error("Ingresá el monto"); return; }
    setSaving(true);
    const { error } = await db.rpc("delivery_admin_movimiento_repartidor", { p_repartidor: account.perfil_id, p_tipo: kind, p_monto: monto, p_nota: note.trim() || null });
    setSaving(false);
    if (error) { toast.error(errorMessage(error)); return; }
    toast.success(kind === "pago" ? "Pago registrado" : "Rendición registrada");
    setAmount(""); setNote(""); setRefresh((value) => value + 1);
  };

  if (!couriers.length) return <EmptyState icon={<Bike className="h-7 w-7" />} title="Todavía no hay repartidores registrados" />;

  return (
    <>
      <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
        {sorted.map((courier) => {
          const status = statusOf(courier);
          return (
            <li key={courier.perfil_id} className="flex flex-wrap items-center gap-3 p-3">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary"><Bike className="h-5 w-5" /></span>
              <div className="min-w-0 flex-1">
                <p className="font-bold">{courier.perfil?.nombre || "Repartidor"}</p>
                <p className="text-xs text-muted-foreground">{courier.vehiculo.replace("_", " ")}{courier.patente && ` · ${courier.patente}`} · DNI {courier.dni || "—"} · {courier.telefono || "sin teléfono"} · desde {formatDateTime(courier.created_at)}</p>
                {status === "rechazado" && <p className="text-xs text-destructive">Rechazado: {courier.motivo_rechazo}</p>}
                {status === "verificado" && <p className="text-xs text-muted-foreground">{courier.aceptadas} aceptadas · {courier.rechazadas} rechazadas · {courier.soltados} soltados</p>}
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", status === "verificado" ? "bg-success/10 text-success" : status === "pendiente" ? (waiting(courier) ? "bg-warning/20" : "bg-muted text-muted-foreground") : "bg-destructive/10 text-destructive")}>{status === "verificado" ? (courier.disponible ? "Conectado" : "Verificado") : status === "pendiente" ? (waiting(courier) ? "Por verificar" : "Sin enviar identidad") : "Rechazado"}</span>
              <Button size="sm" variant="outline" className="rounded-full" onClick={() => setDocsOf(courier)}>Documentos</Button>
              {status !== "verificado" && waiting(courier) && <Button size="sm" className="rounded-full" onClick={() => openReview(courier)}>Revisar identidad</Button>}
              {status !== "rechazado" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => { setRejecting(courier); setReason(""); }}>{status === "verificado" ? "Revocar" : "Rechazar"}</Button>}
              {status === "verificado" && courier.control_estado === "en_revision" && <Button size="sm" className="rounded-full" onClick={() => { setControlOf(courier); setControlReason(""); }}>Revisar control</Button>}
              {status === "verificado" && !courier.control_estado && <Button size="sm" variant="outline" className="rounded-full" onClick={() => askControl(courier)}>Pedir selfie de control</Button>}
              {status === "verificado" && courier.control_estado === "requerido" && <span className="rounded-full bg-warning/20 px-2.5 py-1 text-xs font-bold">Control pedido</span>}
              {status === "verificado" && <Button size="sm" variant="outline" className="rounded-full" onClick={() => setAccount(courier)}>Cuenta</Button>}
              <label className="flex items-center gap-2 text-xs font-semibold">Habilitado<Switch checked={courier.activo} onCheckedChange={(checked) => setActive(courier, checked)} /></label>
            </li>
          );
        })}
      </ul>

      <IdentityReviewDialog row={reviewing} onClose={() => setReviewing(null)} onDone={() => { onChange(); loadIdentities(); }} />

      <Dialog open={Boolean(controlOf)} onOpenChange={(open) => !open && !saving && setControlOf(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Selfie de control de {controlOf?.perfil?.nombre || "repartidor"}</DialogTitle>
          <DialogDescription>Compará la selfie de control con la selfie original y el DNI: tiene que ser la misma persona y hacer el gesto pedido.</DialogDescription>
          {controlOf && <DocumentViewer entidad="repartidor" entidadId={controlOf.perfil_id} />}
          <Textarea value={controlReason} maxLength={300} onChange={(event) => setControlReason(event.target.value)} placeholder="Si no sirve, explicá por qué (lo ve el repartidor)" className="min-h-[72px] resize-none" aria-label="Motivo" />
          <div className="flex flex-wrap gap-2">
            <Button className="rounded-full" disabled={saving} onClick={() => resolveControl(true)}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Es la misma persona: aprobar</Button>
            <Button variant="destructive" className="rounded-full" disabled={saving || controlReason.trim().length < 5} onClick={() => resolveControl(false)}>Pedir otra selfie</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(docsOf)} onOpenChange={(open) => !open && setDocsOf(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Documentos de {docsOf?.perfil?.nombre || "repartidor"}</DialogTitle>
          <DialogDescription>DNI {docsOf?.dni || "—"}. Verificá que el nombre y la cara coincidan con la cuenta antes de aprobar.</DialogDescription>
          {docsOf && <DocumentViewer entidad="repartidor" entidadId={docsOf.perfil_id} />}
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(rejecting)} onOpenChange={(open) => !open && setRejecting(null)}>
        <DialogContent className="max-w-sm">
          <DialogTitle className="text-xl font-black">Rechazar verificación</DialogTitle>
          <DialogDescription>El repartidor va a ver este motivo y puede corregir sus datos.</DialogDescription>
          <Textarea value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="Ej.: el DNI no coincide con el nombre del perfil" className="min-h-[88px] resize-none" aria-label="Motivo" />
          <Button variant="destructive" className="rounded-full" disabled={saving || reason.trim().length < 5} onClick={async () => { if (rejecting && (await verify(rejecting, false, reason.trim()))) setRejecting(null); }}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Rechazar</Button>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(account)} onOpenChange={(open) => !open && setAccount(null)}>
        <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
          <DialogTitle className="text-xl font-black">Cuenta de {account?.perfil?.nombre || "repartidor"}</DialogTitle>
          <DialogDescription>Ganancias, efectivo cobrado y movimientos con Woref.</DialogDescription>
          {account && (
            <>
              <div className="rounded-2xl border bg-muted/40 p-3">
                <p className="text-sm font-bold">Registrar movimiento</p>
                <div className="mt-2 grid gap-2 sm:grid-cols-[auto_1fr_1.4fr_auto]">
                  <div className="flex gap-1" role="radiogroup" aria-label="Tipo">
                    {([["pago", "Le pagué"], ["rendicion", "Me rindió efectivo"]] as const).map(([value, label]) => (
                      <button key={value} type="button" role="radio" aria-checked={kind === value} onClick={() => setKind(value)} className={cn("rounded-full border px-3 py-2 text-xs font-bold", kind === value ? "border-foreground bg-foreground text-background" : "bg-card")}>{label}</button>
                    ))}
                  </div>
                  <Input inputMode="numeric" value={amount} onChange={(event) => setAmount(event.target.value.replace(/\D/g, ""))} placeholder="Monto ($)" aria-label="Monto" />
                  <Input value={note} maxLength={300} onChange={(event) => setNote(event.target.value)} placeholder="Nota (opcional)" aria-label="Nota" />
                  <Button className="rounded-full" onClick={register} disabled={saving || !amount}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Registrar</Button>
                </div>
              </div>
              <div className="rounded-2xl border p-3"><p className="mb-2 text-sm font-bold">Cuenta de cobro del repartidor</p><PayoutForm entidad="repartidor" entidadId={account.perfil_id} canEdit={false} reveal /></div>
              <CourierWallet courierId={account.perfil_id} refreshKey={refresh} />
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
