import { useState } from "react";
import { Loader2, Plus, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AddressForm, AddressIcon, fullAddress, SavedAddress, useSavedAddresses } from "@/components/delivery/AddressDialog";
import { Button } from "@/components/ui/button";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";
import { confirmar } from "@/components/ui/dialogos";

/** Direcciones guardadas: elegir la principal, eliminar y sumar nuevas. */
export function AddressesSection() {
  const { addresses, loading, reload } = useSavedAddresses();
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);

  const makeMain = async (address: SavedAddress) => {
    setBusy(address.id);
    const { error } = await db.rpc("delivery_direccion_principal", { p_id: address.id });
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success(`${address.alias} es tu dirección principal`);
    reload();
  };
  const remove = async (address: SavedAddress) => {
    if (!(await confirmar({ titulo: `¿Eliminar la dirección “${address.alias}”?`, descripcion: "Los pedidos anteriores conservan la dirección con la que se hicieron.", confirmar: "Eliminar", peligro: true }))) return;
    setBusy(address.id);
    const { error } = await db.from("delivery_direcciones").delete().eq("id", address.id);
    setBusy(null);
    if (error) return toast.error(errorMessage(error));
    toast.success("Dirección eliminada");
    reload();
  };

  if (loading) return <div className="flex justify-center py-10"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>;

  return (
    <div className="space-y-4">
      {addresses.length === 0 ? <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">Todavía no guardaste direcciones. Agregá una y pedí en un toque.</p> : (
        <ul className="space-y-2">
          {addresses.map((address) => (
            <li key={address.id} className={cn("flex items-center gap-3 rounded-2xl border p-3", address.predeterminada && "border-primary bg-primary/5")}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><AddressIcon alias={address.alias} className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 font-bold">{address.alias}{address.predeterminada && <span className="rounded-full bg-primary px-2 py-0.5 text-[10px] font-extrabold text-primary-foreground">Principal</span>}</span>
                <span className="block truncate text-sm text-muted-foreground">{fullAddress(address)}</span>
                {address.instrucciones && <span className="block truncate text-xs text-muted-foreground">“{address.instrucciones}”</span>}
                {address.latitud == null && <span className="block text-xs font-semibold text-warning-foreground dark:text-warning">Sin ubicación en el mapa: cargala de nuevo para pedir</span>}
              </span>
              {!address.predeterminada && <Button size="sm" variant="outline" className="rounded-full" disabled={busy === address.id} onClick={() => makeMain(address)}><Star className="h-4 w-4" /><span className="hidden sm:inline">Hacer principal</span></Button>}
              <Button size="icon" variant="ghost" aria-label={`Eliminar ${address.alias}`} disabled={busy === address.id} onClick={() => remove(address)}><Trash2 className="h-4 w-4" /></Button>
            </li>
          ))}
        </ul>
      )}
      {adding || addresses.length === 0 ? (
        <div className="rounded-2xl border p-4"><AddressForm onSaved={() => { setAdding(false); reload(); }} /></div>
      ) : (
        <Button variant="outline" className="rounded-full" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Agregar dirección</Button>
      )}
    </div>
  );
}
