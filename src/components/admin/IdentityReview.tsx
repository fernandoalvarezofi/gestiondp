import { useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, UserRound } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "@/components/delivery/Common";
import { DocumentViewer } from "@/components/verification/DocumentViewer";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { Identity, IdentityChecks, IdentityState, identityStateLabel, rejectionPresets } from "@/lib/identity";
import { cn } from "@/lib/utils";

export type IdentityRow = Identity & { perfil?: { nombre: string | null } | null; es_repartidor: boolean };

const CHECKS: { key: keyof IdentityChecks; label: string }[] = [
  { key: "datos", label: "El nombre y el DNI de los datos coinciden con el documento" },
  { key: "nitidez", label: "Las fotos son nítidas y el documento parece auténtico (sin cortes ni retoques)" },
  { key: "rostro", label: "La cara de la selfie coincide con la foto del DNI" },
  { key: "desafio", label: "En la selfie se cumple el gesto pedido y se ve el DNI" },
];

const stateClass: Record<IdentityState, string> = { en_revision: "bg-warning/20", aprobada: "bg-success/10 text-success", rechazada: "bg-destructive/10 text-destructive", pendiente: "bg-muted text-muted-foreground" };

/** Revisión de una identidad: datos, fotos, gesto pedido y los cuatro controles obligatorios para aprobar. */
export function IdentityReviewDialog({ row, onClose, onDone }: { row: IdentityRow | null; onClose: () => void; onDone: () => void }) {
  const [checks, setChecks] = useState<IdentityChecks>({ datos: false, nitidez: false, rostro: false, desafio: false });
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  useEffect(() => { setChecks({ datos: false, nitidez: false, rostro: false, desafio: false }); setReason(""); }, [row?.perfil_id]);
  if (!row) return null;
  const allChecked = CHECKS.every((item) => checks[item.key]);

  const review = async (approved: boolean) => {
    setSaving(true);
    const { error } = await db.rpc("delivery_admin_revisar_identidad", { p_perfil: row.perfil_id, p_aprobada: approved, p_motivo: approved ? null : reason.trim(), p_controles: checks });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success(approved ? "Identidad verificada" : "Identidad rechazada");
    onDone();
    onClose();
  };

  return (
    <Dialog open onOpenChange={(open) => !open && !saving && onClose()}>
      <DialogContent className="max-h-[92vh] max-w-3xl overflow-y-auto">
        <DialogTitle className="text-xl font-black">Identidad de {row.perfil?.nombre || row.nombre_legal}</DialogTitle>
        <DialogDescription>{row.es_repartidor ? "Repartidor: al aprobarla queda habilitado para conectarse." : "Cuenta de cliente."} Enviada el {row.enviado_at ? formatDateTime(row.enviado_at) : "—"} · intento {row.intentos}.</DialogDescription>

        <dl className="grid gap-2 rounded-2xl border bg-muted/40 p-3 text-sm sm:grid-cols-3">
          <div><dt className="text-xs text-muted-foreground">Nombre en el DNI</dt><dd className="font-bold">{row.nombre_legal}</dd></div>
          <div><dt className="text-xs text-muted-foreground">DNI</dt><dd className="font-bold">{row.dni}</dd></div>
          <div><dt className="text-xs text-muted-foreground">Nacimiento</dt><dd className="font-bold">{row.fecha_nacimiento ? new Date(`${row.fecha_nacimiento}T12:00:00`).toLocaleDateString("es-AR") : "—"}</dd></div>
        </dl>
        <p className="flex items-start gap-2 rounded-2xl border-2 border-primary/40 bg-primary/5 p-3 text-sm"><UserRound className="mt-0.5 h-4 w-4 shrink-0 text-primary" /><span>Gesto que tenía que hacer en la selfie: <span className="font-extrabold">{row.desafio}</span></span></p>

        <DocumentViewer entidad={row.es_repartidor ? "repartidor" : "persona"} entidadId={row.perfil_id} />

        {row.estado === "en_revision" ? (
          <div className="space-y-4">
            <fieldset className="space-y-2">
              <legend className="text-sm font-extrabold">Para aprobar, confirmá los cuatro controles</legend>
              {CHECKS.map((item) => (
                <label key={item.key} className="flex cursor-pointer items-start gap-3 rounded-xl border p-3 text-sm">
                  <Checkbox checked={checks[item.key]} onCheckedChange={(value) => setChecks((prev) => ({ ...prev, [item.key]: value === true }))} className="mt-0.5" />{item.label}
                </label>
              ))}
            </fieldset>
            <Button className="h-11 w-full rounded-full font-bold" disabled={saving || !allChecked} onClick={() => review(true)}>{saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Verificar identidad</Button>

            <div className="space-y-2 border-t pt-4">
              <p className="text-sm font-extrabold">Si hay un problema, rechazala con un motivo claro</p>
              <div className="flex flex-wrap gap-1.5">{rejectionPresets.map((preset) => <button key={preset} type="button" onClick={() => setReason(preset)} className={cn("rounded-full border px-3 py-1 text-xs font-bold", reason === preset ? "border-foreground bg-foreground text-background" : "hover:bg-muted")}>{preset}</button>)}</div>
              <Textarea value={reason} maxLength={300} onChange={(event) => setReason(event.target.value)} placeholder="Motivo que va a ver la persona" className="min-h-[72px] resize-none" aria-label="Motivo del rechazo" />
              <Button variant="destructive" className="rounded-full" disabled={saving || reason.trim().length < 5} onClick={() => review(false)}>Rechazar</Button>
            </div>
          </div>
        ) : (
          <p className={cn("rounded-2xl p-3 text-sm font-bold", stateClass[row.estado])}>{identityStateLabel[row.estado]}{row.revisado_at && ` el ${formatDateTime(row.revisado_at)}`}{row.motivo_rechazo && `: ${row.motivo_rechazo}`}</p>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Bandeja de verificaciones de identidad (repartidores y clientes) para administración. */
export function IdentityQueue({ onChange }: { onChange?: () => void }) {
  const [rows, setRows] = useState<IdentityRow[] | null>(null);
  const [filter, setFilter] = useState<IdentityState>("en_revision");
  const [open, setOpen] = useState<IdentityRow | null>(null);

  const load = useCallback(async () => {
    const [{ data: identities }, { data: couriers }] = await Promise.all([
      db.from("delivery_identidad").select("*").neq("estado", "pendiente").order("enviado_at", { ascending: true }).limit(300),
      db.from("delivery_repartidores").select("perfil_id"),
    ]);
    const list = (identities || []) as Identity[];
    const ids = list.map((item) => item.perfil_id);
    const { data: profiles } = ids.length ? await db.from("perfiles").select("id,nombre").in("id", ids) : { data: [] as { id: string; nombre: string | null }[] };
    const courierIds = new Set((couriers || []).map((item: { perfil_id: string }) => item.perfil_id));
    const names = new Map<string, string | null>((profiles || []).map((item: { id: string; nombre: string | null }) => [item.id, item.nombre]));
    setRows(list.map((item) => ({ ...item, perfil: { nombre: names.get(item.perfil_id) ?? null }, es_repartidor: courierIds.has(item.perfil_id) })));
  }, []);
  useEffect(() => { load(); }, [load]);

  if (!rows) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;
  const counts = (state: IdentityState) => rows.filter((row) => row.estado === state).length;
  const visible = rows.filter((row) => row.estado === filter);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Estado">
        {(["en_revision", "aprobada", "rechazada"] as const).map((state) => (
          <button key={state} type="button" role="tab" aria-selected={filter === state} onClick={() => setFilter(state)} className={cn("rounded-full border px-4 py-1.5 text-sm font-bold", filter === state ? "border-foreground bg-foreground text-background" : "bg-card hover:bg-muted")}>
            {identityStateLabel[state]} ({counts(state)})
          </button>
        ))}
      </div>
      {visible.length === 0 ? <EmptyState icon={<ShieldCheck className="h-7 w-7" />} title={filter === "en_revision" ? "No hay verificaciones esperando" : "Nada para mostrar"} /> : (
        <ul className="divide-y overflow-hidden rounded-3xl border bg-card">
          {visible.map((row) => (
            <li key={row.perfil_id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="font-bold">{row.perfil?.nombre || row.nombre_legal}{row.es_repartidor && <span className="ml-2 rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-extrabold text-primary">Repartidor</span>}</p>
                <p className="text-xs text-muted-foreground">DNI {row.dni} · enviada {row.enviado_at ? formatDateTime(row.enviado_at) : "—"} · intento {row.intentos}</p>
                {row.estado === "rechazada" && <p className="text-xs text-destructive">{row.motivo_rechazo}</p>}
              </div>
              <span className={cn("rounded-full px-2.5 py-1 text-xs font-bold", stateClass[row.estado])}>{identityStateLabel[row.estado]}</span>
              <Button size="sm" variant={row.estado === "en_revision" ? "default" : "outline"} className="rounded-full" onClick={() => setOpen(row)}>{row.estado === "en_revision" ? "Revisar" : "Ver"}</Button>
            </li>
          ))}
        </ul>
      )}
      <IdentityReviewDialog row={open} onClose={() => setOpen(null)} onDone={() => { load(); onChange?.(); }} />
    </div>
  );
}
