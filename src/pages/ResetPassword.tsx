import { FormEvent, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { KeyRound, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { DeliveryBrand } from "@/components/delivery/DeliveryBrand";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { authErrorMessage } from "@/lib/authErrors";

/** Destino del link de "Olvidé mi contraseña": el link abre una sesión temporal para elegir una contraseña nueva. */
export default function ResetPassword() {
  const { session, loading } = useAuth();
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (password.length < 8) return toast.error("La contraseña tiene que tener al menos 8 caracteres");
    if (password !== confirm) return toast.error("Las contraseñas no coinciden");
    setSaving(true);
    const { error } = await supabase.auth.updateUser({ password });
    setSaving(false);
    if (error) return toast.error(authErrorMessage(error.message));
    toast.success("¡Listo! Ya podés usar tu contraseña nueva.");
    navigate("/app", { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <DeliveryBrand className="mb-8" />
      <div className="w-full max-w-sm rounded-3xl border bg-card p-6 shadow-soft">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary"><KeyRound className="h-6 w-6" /></span>
        <h1 className="mt-4 text-2xl font-extrabold">Elegí una contraseña nueva</h1>
        {loading ? (
          <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
        ) : session ? (
          <form onSubmit={submit} className="mt-5 space-y-4">
            <div className="space-y-2"><Label htmlFor="new-password">Contraseña nueva</Label><Input id="new-password" type="password" autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} maxLength={128} required /></div>
            <div className="space-y-2"><Label htmlFor="confirm-password">Repetila</Label><Input id="confirm-password" type="password" autoComplete="new-password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} maxLength={128} required /></div>
            <Button type="submit" className="w-full rounded-full" disabled={saving}>{saving && <Loader2 className="h-4 w-4 animate-spin" />}Guardar contraseña</Button>
          </form>
        ) : (
          <div className="mt-4 space-y-4">
            <p className="text-sm text-muted-foreground">El link venció o ya se usó. Pedí uno nuevo desde “¿Olvidaste tu contraseña?”.</p>
            <Button asChild className="w-full rounded-full"><Link to="/auth">Ir a iniciar sesión</Link></Button>
          </div>
        )}
      </div>
    </div>
  );
}
