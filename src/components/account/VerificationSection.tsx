import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";
import { IdentityVerification } from "@/components/verification/IdentityVerification";
import { useAuth } from "@/contexts/AuthContext";
import { useDeliveryRoles } from "@/hooks/useDeliveryRoles";
import { db } from "@/lib/delivery";
import { loadIdentity, IdentityState } from "@/lib/identity";
import { cn } from "@/lib/utils";

/** Nivel de la cuenta: email confirmado, teléfono cargado e identidad verificada con DNI y selfie. */
export function VerificationSection() {
  const { user } = useAuth();
  const roles = useDeliveryRoles();
  const [phone, setPhone] = useState<string | null | undefined>(undefined);
  const [state, setState] = useState<IdentityState | null | undefined>(undefined);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!user) return;
    (async () => {
      const [{ data }, identity] = await Promise.all([db.from("perfiles").select("telefono").eq("id", user.id).maybeSingle(), loadIdentity(user.id)]);
      setPhone(data?.telefono ?? null);
      setState(identity?.estado ?? null);
    })();
  }, [user, version]);

  if (!user || phone === undefined || state === undefined) return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  const levels = [
    { label: "Email confirmado", ok: Boolean(user.email_confirmed_at), hint: user.email ?? "" },
    { label: "Teléfono cargado", ok: Boolean(phone && phone.replace(/\D/g, "").length >= 8), hint: phone || "Cargalo en Datos personales" },
    { label: "Identidad verificada (DNI y selfie)", ok: state === "aprobada", hint: state === "en_revision" ? "En revisión" : state === "rechazada" ? "Rechazada: corregila abajo" : state === "aprobada" ? "Listo" : "Pendiente" },
  ];
  const done = levels.filter((level) => level.ok).length;

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border p-4 sm:p-5">
        <div className="flex items-center justify-between gap-3">
          <h3 className="font-extrabold">Nivel de tu cuenta</h3>
          <span className={cn("rounded-full px-3 py-1 text-xs font-extrabold", done === levels.length ? "bg-success/10 text-success" : "bg-muted text-muted-foreground")}>{done} de {levels.length}</span>
        </div>
        <ul className="mt-3 space-y-2">
          {levels.map((level) => (
            <li key={level.label} className="flex items-center gap-3 text-sm">
              {level.ok ? <CheckCircle2 className="h-5 w-5 shrink-0 text-success" /> : <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />}
              <span className="min-w-0 flex-1"><span className="block font-bold">{level.label}</span><span className="block truncate text-xs text-muted-foreground">{level.hint}</span></span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground">Una cuenta verificada da más confianza a comercios y repartidores, y es obligatoria para repartir.</p>
      </section>

      <section>
        <h3 className="mb-3 font-extrabold">Verificación de identidad</h3>
        <IdentityVerification entidad={roles.isCourier ? "repartidor" : "persona"} onChanged={() => setVersion((value) => value + 1)} />
      </section>
    </div>
  );
}
