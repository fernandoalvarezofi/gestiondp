import { FormEvent, useCallback, useEffect, useState } from "react";
import { KeyRound, Laptop, Loader2, LogOut, ShieldCheck, Smartphone, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { TwoFactorPanel } from "@/components/account/TwoFactorPanel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/authErrors";
import { db, errorMessage, formatDateTime } from "@/lib/delivery";
import { passwordStrength } from "@/lib/password";
import { cn } from "@/lib/utils";

type Device = { id: string; dispositivo: string | null; created_at: string };
const bars = ["bg-destructive", "bg-destructive", "bg-warning", "bg-success", "bg-success"];

/** Contraseña (con la actual), cierre de sesión en otros dispositivos y dispositivos con avisos. */
export function SecuritySection() {
  const { user, signOut } = useAuth();
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [repeat, setRepeat] = useState("");
  const [saving, setSaving] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [devices, setDevices] = useState<Device[] | null>(null);
  const strength = passwordStrength(next);

  const loadDevices = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("delivery_push_suscripciones").select("id,dispositivo,created_at").eq("perfil_id", user.id).order("created_at", { ascending: false });
    setDevices(data || []);
  }, [user]);
  useEffect(() => { loadDevices(); }, [loadDevices]);

  const change = async (event: FormEvent) => {
    event.preventDefault();
    if (!user?.email) return;
    if (strength.score < 2) return toast.error(strength.hint ?? "Elegí una contraseña más segura");
    if (next !== repeat) return toast.error("Las contraseñas nuevas no coinciden");
    if (next === current) return toast.error("La nueva contraseña tiene que ser distinta de la actual");
    setSaving(true);
    // Confirmamos que sea la persona dueña de la cuenta antes de cambiar la contraseña.
    const { error: verifyError } = await supabase.auth.signInWithPassword({ email: user.email, password: current });
    if (verifyError) { setSaving(false); return toast.error("La contraseña actual no es correcta"); }
    const { error } = await supabase.auth.updateUser({ password: next });
    setSaving(false);
    if (error) return toast.error(authErrorMessage(error.message));
    setCurrent(""); setNext(""); setRepeat("");
    toast.success("Contraseña actualizada");
  };

  const signOutOthers = async () => {
    setLeaving(true);
    const { error } = await supabase.auth.signOut({ scope: "others" });
    setLeaving(false);
    if (error) return toast.error(authErrorMessage(error.message));
    toast.success("Cerramos tu sesión en los demás dispositivos");
  };
  const removeDevice = async (id: string) => {
    const { error } = await db.from("delivery_push_suscripciones").delete().eq("id", id);
    if (error) return toast.error(errorMessage(error));
    loadDevices();
  };

  return (
    <div className="space-y-8">
      <form onSubmit={change} className="max-w-md space-y-4">
        <h3 className="flex items-center gap-2 font-extrabold"><KeyRound className="h-5 w-5 text-primary" />Cambiar contraseña</h3>
        <div className="space-y-1.5"><Label htmlFor="pw-current">Contraseña actual</Label><Input id="pw-current" type="password" value={current} maxLength={128} onChange={(event) => setCurrent(event.target.value)} autoComplete="current-password" /></div>
        <div className="space-y-1.5">
          <Label htmlFor="pw-new">Contraseña nueva</Label>
          <Input id="pw-new" type="password" value={next} maxLength={128} onChange={(event) => setNext(event.target.value)} autoComplete="new-password" />
          {next && (
            <div aria-live="polite">
              <div className="mt-1 flex gap-1" aria-hidden>{[1, 2, 3, 4].map((level) => <span key={level} className={cn("h-1.5 flex-1 rounded-full bg-muted", strength.score >= level && bars[strength.score])} />)}</div>
              <p className="mt-1 text-xs text-muted-foreground"><span className="font-bold text-foreground">{strength.label}</span>{strength.hint && ` · ${strength.hint}`}</p>
            </div>
          )}
        </div>
        <div className="space-y-1.5"><Label htmlFor="pw-repeat">Repetí la contraseña nueva</Label><Input id="pw-repeat" type="password" value={repeat} maxLength={128} onChange={(event) => setRepeat(event.target.value)} autoComplete="new-password" /></div>
        <Button type="submit" className="rounded-full" disabled={saving || !current || !next || !repeat}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Cambiar contraseña</Button>
      </form>

      <TwoFactorPanel />

      <section className="border-t pt-6">
        <h3 className="flex items-center gap-2 font-extrabold"><ShieldCheck className="h-5 w-5 text-primary" />Sesiones</h3>
        <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
          <div className="rounded-2xl border p-3"><dt className="text-muted-foreground">Cuenta creada</dt><dd className="font-bold">{user?.created_at ? formatDateTime(user.created_at) : "—"}</dd></div>
          <div className="rounded-2xl border p-3"><dt className="text-muted-foreground">Último acceso</dt><dd className="font-bold">{user?.last_sign_in_at ? formatDateTime(user.last_sign_in_at) : "—"}</dd></div>
        </dl>
        <p className="mt-3 text-sm text-muted-foreground">Si usaste Woref en un dispositivo ajeno o perdiste el teléfono, cerrá sesión en todos los demás.</p>
        <div className="mt-3 flex flex-wrap gap-2">
          <Button variant="outline" className="rounded-full" onClick={signOutOthers} disabled={leaving}>{leaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Laptop className="h-4 w-4" />}Cerrar sesión en los demás dispositivos</Button>
          <Button variant="outline" className="rounded-full text-destructive" onClick={() => signOut()}><LogOut className="h-4 w-4" />Cerrar sesión acá</Button>
        </div>
      </section>

      <section className="border-t pt-6">
        <h3 className="flex items-center gap-2 font-extrabold"><Smartphone className="h-5 w-5 text-primary" />Dispositivos con avisos</h3>
        <p className="mt-1 text-sm text-muted-foreground">Estos dispositivos reciben tus notificaciones push. Quitá los que ya no uses.</p>
        {!devices ? <Loader2 className="mt-3 h-5 w-5 animate-spin text-primary" /> : devices.length === 0 ? <p className="mt-3 rounded-xl bg-muted p-3 text-sm text-muted-foreground">No tenés dispositivos con avisos activados.</p> : (
          <ul className="mt-3 divide-y rounded-2xl border">
            {devices.map((device) => (
              <li key={device.id} className="flex items-center gap-3 p-3 text-sm">
                <Smartphone className="h-5 w-5 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1"><span className="block truncate font-bold">{device.dispositivo || "Dispositivo"}</span><span className="block text-xs text-muted-foreground">Activado el {formatDateTime(device.created_at)}</span></span>
                <Button size="icon" variant="ghost" aria-label="Quitar dispositivo" onClick={() => removeDevice(device.id)}><Trash2 className="h-4 w-4" /></Button>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
