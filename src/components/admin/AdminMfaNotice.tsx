import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ShieldAlert } from "lucide-react";
import { listTotpFactors } from "@/lib/mfa";

/** Aviso a administradores que todavía no activaron la verificación en dos pasos. */
export function AdminMfaNotice() {
  const [missing, setMissing] = useState(false);
  useEffect(() => { listTotpFactors().then((factors) => setMissing(factors.length === 0)); }, []);
  if (!missing) return null;
  return (
    <Link to="/app/perfil/seguridad" className="flex items-start gap-3 rounded-2xl border border-warning/50 bg-warning/10 p-4 text-sm">
      <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" />
      <span><span className="block font-extrabold">Activá la verificación en dos pasos</span><span className="block text-muted-foreground">Tu cuenta de administración maneja pagos, identidades y datos de clientes. Con el segundo factor, nadie que robe tu contraseña puede ejercer como administrador.</span></span>
    </Link>
  );
}
