import { FormEvent, useCallback, useEffect, useState } from "react";
import { BadgeCheck, Clock3, Loader2, ShieldAlert } from "lucide-react";
import { toast } from "sonner";
import { DocumentChecklist } from "@/components/verification/DocumentChecklist";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { db, DeliveryStore, errorMessage } from "@/lib/delivery";
import { formatCuit, isValidCuit, storeDocs } from "@/lib/verification";
import { cn } from "@/lib/utils";

export type StoreLegal = { razon_social: string; cuit: string; condicion_iva: "responsable_inscripto" | "monotributo" | "exento" };
export const vatLabel: Record<StoreLegal["condicion_iva"], string> = { responsable_inscripto: "Responsable inscripto", monotributo: "Monotributo", exento: "Exento" };

/** Datos legales (CUIT, razón social) y documentos del comercio; solo los ven el dueño y administración. */
export function StoreVerification({ store, onSaved }: { store: DeliveryStore; onSaved?: () => void }) {
  const [legal, setLegal] = useState<StoreLegal | null | undefined>(undefined);
  const [name, setName] = useState("");
  const [cuit, setCuit] = useState("");
  const [vat, setVat] = useState<StoreLegal["condicion_iva"]>("monotributo");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const { data } = await db.from("delivery_comercio_legal").select("razon_social,cuit,condicion_iva").eq("comercio_id", store.id).maybeSingle();
    setLegal(data ?? null);
    if (data) { setName(data.razon_social); setCuit(formatCuit(data.cuit)); setVat(data.condicion_iva); }
  }, [store.id]);
  useEffect(() => { load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 3) return toast.error("Ingresá la razón social o el nombre del titular");
    if (!isValidCuit(cuit)) return toast.error("El CUIT no es válido: revisá los 11 números");
    setSaving(true);
    const { error } = await db.rpc("delivery_legal_guardar", { p_comercio: store.id, p_razon_social: name.trim(), p_cuit: cuit, p_condicion: vat });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Datos legales guardados");
    await load();
    onSaved?.();
  };

  const state = store.aprobado ? "ok" : store.motivo_rechazo ? "rechazado" : "revision";

  return (
    <div className="space-y-6">
      <div className={cn("flex items-start gap-3 rounded-2xl border p-4", state === "ok" ? "border-success/40 bg-success/5" : state === "rechazado" ? "border-destructive/40 bg-destructive/5" : "border-warning/40 bg-warning/10")}>
        {state === "ok" ? <BadgeCheck className="mt-0.5 h-5 w-5 text-success" /> : state === "rechazado" ? <ShieldAlert className="mt-0.5 h-5 w-5 text-destructive" /> : <Clock3 className="mt-0.5 h-5 w-5" />}
        <div>
          <p className="font-extrabold">{state === "ok" ? "Comercio verificado" : state === "rechazado" ? "Tu comercio no fue aprobado" : legal ? "En revisión" : "Cargá tus datos legales para que podamos aprobarte"}</p>
          <p className="text-sm text-muted-foreground">{state === "ok" ? "Ya aparecés para los clientes." : state === "rechazado" ? `Motivo: ${store.motivo_rechazo}. Corregí lo que falte y escribinos para revisarlo de nuevo.` : legal ? "Administración revisa tus datos. Te avisamos cuando estés aprobado." : "Sin CUIT y razón social no podemos aprobar el comercio ni facturarte la comisión."}</p>
        </div>
      </div>

      {legal === undefined ? <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div> : (
        <form onSubmit={save} className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="legal-name">Razón social o nombre del titular</Label><Input id="legal-name" value={name} maxLength={150} onChange={(event) => setName(event.target.value)} autoComplete="organization" /></div>
          <div className="space-y-1.5"><Label htmlFor="legal-cuit">CUIT</Label><Input id="legal-cuit" inputMode="numeric" value={cuit} onChange={(event) => setCuit(formatCuit(event.target.value))} placeholder="30-12345678-9" aria-invalid={cuit.length > 0 && cuit.replace(/\D/g, "").length === 11 && !isValidCuit(cuit)} /></div>
          <div className="space-y-1.5"><Label htmlFor="legal-iva">Condición frente al IVA</Label>
            <select id="legal-iva" value={vat} onChange={(event) => setVat(event.target.value as StoreLegal["condicion_iva"])} className="h-10 w-full rounded-md border bg-background px-3 text-sm">
              {(Object.keys(vatLabel) as StoreLegal["condicion_iva"][]).map((value) => <option key={value} value={value}>{vatLabel[value]}</option>)}
            </select>
          </div>
          <Button type="submit" className="rounded-full sm:col-span-2 sm:w-fit" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar datos legales</Button>
        </form>
      )}

      <div>
        <h3 className="font-extrabold">Documentación</h3>
        <p className="mb-3 text-sm text-muted-foreground">Son privados: solo los ve administración. Subirlos acelera la revisión.</p>
        <DocumentChecklist entidad="comercio" entidadId={store.id} specs={storeDocs} />
      </div>
    </div>
  );
}
