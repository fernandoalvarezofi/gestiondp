import { FormEvent, useCallback, useEffect, useState } from "react";
import { Landmark, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { isValidAlias, isValidCbu, loadPayout, maskCbu, Payout } from "@/lib/payout";
import { formatCuit, isValidCuit } from "@/lib/verification";

/**
 * Cuenta bancaria donde Woref liquida las ganancias (CBU o alias + titular y CUIT/CUIL).
 * Cambiarla pide la contraseña: es el dato que más buscaría alguien que robe una cuenta.
 */
export function PayoutForm({ entidad, entidadId, canEdit = true, reveal = false }: { entidad: Payout["entidad"]; entidadId: string; canEdit?: boolean; reveal?: boolean }) {
  const { user } = useAuth();
  const [payout, setPayout] = useState<Payout | null | undefined>(undefined);
  const [editing, setEditing] = useState(false);
  const [holder, setHolder] = useState("");
  const [cuit, setCuit] = useState("");
  const [cbu, setCbu] = useState("");
  const [alias, setAlias] = useState("");
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    const row = await loadPayout(entidad, entidadId);
    setPayout(row);
    if (row) { setHolder(row.titular); setCuit(formatCuit(row.cuit)); setCbu(row.cbu ?? ""); setAlias(row.alias ?? ""); }
  }, [entidad, entidadId]);
  useEffect(() => { load(); }, [load]);

  const save = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.email) return;
    if (holder.trim().length < 5 || !holder.trim().includes(" ")) return toast.error("Ingresá el nombre completo o la razón social del titular");
    if (!isValidCuit(cuit)) return toast.error("El CUIT o CUIL no es válido: revisá los 11 números");
    if (!cbu.trim() && !alias.trim()) return toast.error("Ingresá el CBU o el alias de la cuenta");
    if (cbu.trim() && !isValidCbu(cbu)) return toast.error("El CBU no es válido: revisá los 22 números");
    if (alias.trim() && !isValidAlias(alias)) return toast.error("El alias tiene entre 6 y 20 caracteres: letras, números, punto o guion");
    setSaving(true);
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password });
    if (verifyError) { setSaving(false); return toast.error("La contraseña no es correcta"); }
    const { error } = await db.rpc("delivery_cobro_guardar", { p_entidad: entidad, p_entidad_id: entidadId, p_titular: holder, p_cuit: cuit, p_cbu: cbu.trim() || null, p_alias: alias.trim() || null });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Datos de cobro guardados");
    setPassword(""); setEditing(false);
    await load();
  };

  if (payout === undefined) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;

  if (payout && !editing) {
    return (
      <div className="rounded-3xl border p-4 sm:p-5">
        <div className="flex items-start gap-3">
          <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary"><Landmark className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <p className="font-extrabold">{payout.titular}</p>
            <p className="text-sm text-muted-foreground">CUIT/CUIL {formatCuit(payout.cuit)}</p>
          </div>
        </div>
        <dl className="mt-4 space-y-2 text-sm">
          {payout.cbu && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">CBU</dt><dd className="font-bold tabular-nums">{reveal ? payout.cbu : maskCbu(payout.cbu)}</dd></div>}
          {payout.alias && <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Alias</dt><dd className="font-bold">{payout.alias}</dd></div>}
          <div className="flex justify-between gap-3"><dt className="text-muted-foreground">Última actualización</dt><dd>{formatDateTime(payout.updated_at)}</dd></div>
        </dl>
        {canEdit && <Button variant="outline" className="mt-4 rounded-full" onClick={() => setEditing(true)}>Cambiar cuenta</Button>}
      </div>
    );
  }

  if (!canEdit) return <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Todavía no se cargó una cuenta de cobro.{!reveal && " Solo el titular puede cargarla."}</p>;

  return (
    <form onSubmit={save} className="space-y-4">
      <p className="flex items-start gap-2 rounded-2xl bg-muted p-3 text-sm text-muted-foreground"><Lock className="mt-0.5 h-4 w-4 shrink-0" />La cuenta tiene que estar a nombre del titular. Es privada: solo la ves vos y el equipo de liquidaciones, y para cambiarla pedimos tu contraseña.</p>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="po-holder">Titular de la cuenta</Label><Input id="po-holder" value={holder} maxLength={120} onChange={(event) => setHolder(event.target.value)} autoComplete="off" /></div>
        <div className="space-y-1.5"><Label htmlFor="po-cuit">CUIT o CUIL del titular</Label><Input id="po-cuit" inputMode="numeric" value={cuit} placeholder="20-12345678-9" onChange={(event) => setCuit(formatCuit(event.target.value))} aria-invalid={cuit.replace(/\D/g, "").length === 11 && !isValidCuit(cuit)} /></div>
        <div className="space-y-1.5"><Label htmlFor="po-alias">Alias (opcional si cargás el CBU)</Label><Input id="po-alias" value={alias} maxLength={20} placeholder="mi.alias.mp" onChange={(event) => setAlias(event.target.value.replace(/[^A-Za-z0-9.-]/g, ""))} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="po-cbu">CBU o CVU (22 números)</Label><Input id="po-cbu" inputMode="numeric" value={cbu} maxLength={26} placeholder="0000000000000000000000" onChange={(event) => setCbu(event.target.value.replace(/[^\d\s]/g, ""))} aria-invalid={cbu.replace(/\s/g, "").length === 22 && !isValidCbu(cbu)} /></div>
        <div className="space-y-1.5 sm:col-span-2"><Label htmlFor="po-pass">Tu contraseña (para confirmar el cambio)</Label><Input id="po-pass" type="password" value={password} maxLength={128} autoComplete="current-password" onChange={(event) => setPassword(event.target.value)} /></div>
      </div>
      <div className="flex gap-2">
        {payout && <Button type="button" variant="outline" className="rounded-full" onClick={() => { setEditing(false); load(); }}>Cancelar</Button>}
        <Button type="submit" className="rounded-full" disabled={saving || !password}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar cuenta</Button>
      </div>
    </form>
  );
}
