import { FormEvent, useCallback, useEffect, useState } from "react";
import { Loader2, ShieldCheck, ShieldOff, Smartphone } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { formatDateTime } from "@/lib/delivery";
import { disableTotp, enrollTotp, isSixDigits, listTotpFactors, TotpFactor, verifyTotp } from "@/lib/mfa";
import { confirmar } from "@/components/ui/dialogos";

/** Activar o desactivar la verificación en dos pasos con una app de autenticación (TOTP). */
export function TwoFactorPanel() {
  const { refreshMfa } = useAuth();
  const roles = useDeliveryRoles();
  const [factors, setFactors] = useState<TotpFactor[] | null>(null);
  const [setup, setSetup] = useState<{ factorId: string; qr: string; secret: string } | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => setFactors(await listTotpFactors()), []);
  useEffect(() => { load(); }, [load]);

  const start = async () => {
    setBusy(true);
    try { setSetup(await enrollTotp()); setCode(""); } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  };
  const confirm = async (event: FormEvent) => {
    event.preventDefault();
    if (!setup || !isSixDigits(code)) return;
    setBusy(true);
    try {
      await verifyTotp(setup.factorId, code);
      toast.success("¡Listo! La verificación en dos pasos está activada.");
      setSetup(null); setCode("");
      await Promise.all([load(), refreshMfa()]);
    } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  };
  const disable = async (factor: TotpFactor) => {
    if (!(await confirmar({ titulo: "¿Desactivar la verificación en dos pasos?", descripcion: roles.isAdmin ? "Sos administrador: sin el segundo factor la cuenta queda mucho menos protegida y algunas acciones de administración se bloquean." : "Tu cuenta va a quedar protegida solo con la contraseña.", confirmar: "Desactivar", peligro: true }))) return;
    setBusy(true);
    try { await disableTotp(factor.id); toast.success("Desactivada"); await Promise.all([load(), refreshMfa()]); } catch (error) { toast.error((error as Error).message); } finally { setBusy(false); }
  };

  if (!factors) return <div className="flex justify-center py-6"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>;
  const active = factors.filter((factor) => factor);

  return (
    <section className="border-t pt-6">
      <h3 className="flex items-center gap-2 font-extrabold"><ShieldCheck className="h-5 w-5 text-primary" />Verificación en dos pasos</h3>
      <p className="mt-1 max-w-xl text-sm text-muted-foreground">Además de tu contraseña, te pedimos un código que cambia cada 30 segundos desde una app en tu celular. Aunque alguien robe tu contraseña, no puede entrar.{roles.isAdmin && " Para las cuentas de administración es especialmente importante: con la verificación activa, las acciones de administración solo funcionan después de confirmar el código."}</p>

      {setup ? (
        <form onSubmit={confirm} className="mt-4 max-w-md space-y-3 rounded-3xl border p-4">
          <ol className="list-decimal space-y-1 pl-5 text-sm">
            <li>Instalá una app de autenticación (Google Authenticator, Authy, Microsoft Authenticator o 1Password).</li>
            <li>Escaneá este código QR o cargá la clave a mano.</li>
            <li>Escribí el código de 6 números que te muestra.</li>
          </ol>
          <div className="flex justify-center rounded-2xl bg-white p-3"><img src={setup.qr} alt="Código QR para la app de autenticación" className="h-44 w-44" /></div>
          <div><p className="text-xs font-bold text-muted-foreground">Clave para cargar a mano (guardala en un lugar seguro: sirve para recuperar el acceso)</p><p className="mt-1 break-all rounded-xl bg-muted p-2 font-mono text-sm">{setup.secret}</p></div>
          <Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" placeholder="000000" aria-label="Código de 6 números" className="h-12 text-center font-mono text-xl tracking-[0.3em]" />
          <div className="flex gap-2">
            <Button type="button" variant="outline" className="rounded-full" onClick={() => setSetup(null)}>Cancelar</Button>
            <Button type="submit" className="flex-1 rounded-full" disabled={busy || !isSixDigits(code)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Activar</Button>
          </div>
        </form>
      ) : active.length > 0 ? (
        <ul className="mt-3 max-w-md divide-y rounded-2xl border">
          {active.map((factor) => (
            <li key={factor.id} className="flex items-center gap-3 p-3 text-sm">
              <Smartphone className="h-5 w-5 shrink-0 text-success" />
              <span className="min-w-0 flex-1"><span className="block font-bold">App de autenticación · activada</span><span className="block text-xs text-muted-foreground">Desde el {formatDateTime(factor.created_at)}</span></span>
              <Button size="sm" variant="outline" className="rounded-full text-destructive" disabled={busy} onClick={() => disable(factor)}><ShieldOff className="h-4 w-4" />Desactivar</Button>
            </li>
          ))}
        </ul>
      ) : (
        <Button className="mt-3 rounded-full" onClick={start} disabled={busy}>{busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ShieldCheck className="h-4 w-4" />}Activar verificación en dos pasos</Button>
      )}
    </section>
  );
}
