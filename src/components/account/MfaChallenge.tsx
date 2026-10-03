import { FormEvent, useEffect, useState } from "react";
import { Loader2, LogOut, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { isSixDigits, listTotpFactors, verifyTotp } from "@/lib/mfa";

/** Pantalla de verificación en dos pasos: se pide el código de la app de autenticación antes de entrar. */
export function MfaChallenge() {
  const { signOut, refreshMfa } = useAuth();
  const [factorId, setFactorId] = useState<string | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => { listTotpFactors().then((factors) => setFactorId(factors[0]?.id ?? null)); }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!factorId || !isSixDigits(code)) return;
    setBusy(true);
    try { await verifyTotp(factorId, code); await refreshMfa(); } catch (error) { toast.error((error as Error).message); setCode(""); } finally { setBusy(false); }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      <div className="w-full max-w-sm rounded-3xl border bg-card p-6 text-center shadow-soft">
        <div className="flex justify-center"><DeliveryBrand /></div>
        <span className="mx-auto mt-5 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10 text-primary"><ShieldCheck className="h-7 w-7" /></span>
        <h1 className="mt-3 text-xl font-black">Verificación en dos pasos</h1>
        <p className="mt-1 text-sm text-muted-foreground">Abrí tu app de autenticación (Google Authenticator, Authy, 1Password…) e ingresá el código de 6 números de Woref.</p>
        <form onSubmit={submit} className="mt-5 space-y-3">
          <Input value={code} onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, 6))} inputMode="numeric" autoComplete="one-time-code" autoFocus placeholder="000000" aria-label="Código de 6 números" className="h-14 text-center font-mono text-2xl tracking-[0.4em]" />
          <Button type="submit" className="h-12 w-full rounded-full text-base font-bold" disabled={busy || !factorId || !isSixDigits(code)}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Verificar</Button>
        </form>
        {factorId === null && <p className="mt-3 text-xs text-muted-foreground">Buscando tu método de verificación…</p>}
        <button type="button" onClick={() => signOut()} className="mt-4 inline-flex items-center gap-1.5 text-sm font-bold text-muted-foreground hover:text-foreground"><LogOut className="h-4 w-4" />Salir</button>
        <p className="mt-4 text-xs text-muted-foreground">¿Perdiste el acceso a tu app? Escribinos a soporte para recuperarlo.</p>
      </div>
    </div>
  );
}
