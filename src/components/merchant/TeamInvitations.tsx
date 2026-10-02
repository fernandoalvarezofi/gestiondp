import { useCallback, useEffect, useState } from "react";
import { Check, Loader2, Store, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { db, errorMessage } from "@/lib/delivery";
import { roleLabel, roleSummary, TeamRole } from "@/pages/delivery/merchant/context";

type Invitation = { id: string; rol: Exclude<TeamRole, "dueno">; comercio: string };

/** Invitaciones pendientes para sumarse al equipo de un comercio; aceptar es una decisión de la persona invitada. */
export function TeamInvitations({ onAccepted, className }: { onAccepted?: () => void; className?: string }) {
  const [items, setItems] = useState<Invitation[]>([]);
  const [busy, setBusy] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await db.rpc("delivery_equipo_invitaciones");
    setItems(Array.isArray(data) ? data : []);
  }, []);
  useEffect(() => { load(); }, [load]);

  const answer = async (item: Invitation, accept: boolean) => {
    setBusy(item.id);
    const { error } = await db.rpc("delivery_equipo_responder", { p_id: item.id, p_acepta: accept });
    setBusy(null);
    if (error) { toast.error(errorMessage(error)); load(); return; }
    toast.success(accept ? `Ahora sos parte del equipo de ${item.comercio}` : "Invitación rechazada");
    await load();
    if (accept) onAccepted?.();
  };

  if (items.length === 0) return null;
  return (
    <section className={className}>
      <h2 className="font-extrabold">Invitaciones a equipos</h2>
      <ul className="mt-2 space-y-2">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-3 rounded-2xl border bg-card p-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary"><Store className="h-5 w-5" /></span>
            <div className="min-w-0 flex-1">
              <p className="font-bold">{item.comercio}</p>
              <p className="text-xs text-muted-foreground">Te invitaron como <span className="font-bold">{roleLabel[item.rol]}</span>. {roleSummary[item.rol]}</p>
            </div>
            <Button size="sm" className="rounded-full" disabled={busy === item.id} onClick={() => answer(item, true)}>{busy === item.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}Aceptar</Button>
            <Button size="sm" variant="outline" className="rounded-full" disabled={busy === item.id} onClick={() => answer(item, false)}><X className="h-4 w-4" />Rechazar</Button>
          </li>
        ))}
      </ul>
    </section>
  );
}
