import { ReactNode, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { contactoDeCliente } from "@/services/crm";
import { useMerchant } from "@/pages/delivery/merchant/context";

/**
 * Nombre del cliente que abre su ficha del CRM. Recibe el contacto (turnos) o la cuenta (pedidos, conversaciones).
 * Si el rol no tiene acceso al CRM, muestra solo el nombre.
 */
export function ClienteLink({ contactoId, clienteId, children, className }: { contactoId?: string | null; clienteId?: string | null; children: ReactNode; className?: string }) {
  const { store, access } = useMerchant();
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const puede = access.permisos.includes("estadisticas") && Boolean(contactoId || clienteId);
  if (!puede) return <span className={className}>{children}</span>;

  const abrir = async () => {
    if (contactoId) { navigate(`/app/comercio/clientes/${contactoId}`); return; }
    setBusy(true);
    try { navigate(`/app/comercio/clientes/${await contactoDeCliente(store.id, clienteId as string)}`); }
    catch (e) { toast.error(errorMessage(e, "No pudimos abrir la ficha")); }
    finally { setBusy(false); }
  };
  return (
    <button type="button" onClick={abrir} disabled={busy} title="Ver ficha del cliente" className={cn("inline-flex items-center gap-1 font-semibold underline-offset-2 hover:underline", className)}>
      {children}{busy && <Loader2 className="h-3 w-3 animate-spin" />}
    </button>
  );
}
