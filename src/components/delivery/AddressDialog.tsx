import { FormEvent, ReactNode, useCallback, useEffect, useState } from "react";
import { Briefcase, Check, Home, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export type SavedAddress = { id: string; alias: string; direccion: string; detalle?: string | null; instrucciones?: string | null; predeterminada: boolean };

export const fullAddress = (address: Pick<SavedAddress, "direccion" | "detalle">) => [address.direccion, address.detalle].filter(Boolean).join(", ");

export function useSavedAddresses() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!user) return;
    const { data } = await db.from("delivery_direcciones").select("*").eq("perfil_id", user.id).order("predeterminada", { ascending: false }).order("created_at");
    setAddresses(data || []);
    setLoading(false);
  }, [user]);

  useEffect(() => { load(); }, [load]);
  return { addresses, loading, reload: load };
}

export function AddressForm({ onSaved, compact }: { onSaved?: (address: SavedAddress) => void; compact?: boolean }) {
  const { user } = useAuth();
  const [alias, setAlias] = useState("Casa");
  const [direccion, setDireccion] = useState("");
  const [detalle, setDetalle] = useState("");
  const [instrucciones, setInstrucciones] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!user || direccion.trim().length < 5) return toast.error("Escribí la calle y la altura");
    setSaving(true);
    const { data, error } = await db.from("delivery_direcciones").insert({
      perfil_id: user.id,
      alias: alias.trim() || "Casa",
      direccion: direccion.trim(),
      detalle: detalle.trim() || null,
      instrucciones: instrucciones.trim() || null,
    }).select("*").single();
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Dirección guardada");
    setDireccion(""); setDetalle(""); setInstrucciones("");
    onSaved?.(data);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        {["Casa", "Trabajo", "Otra"].map((option) => (
          <button key={option} type="button" onClick={() => setAlias(option)} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", alias === option ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>{option}</button>
        ))}
      </div>
      <Input value={direccion} onChange={(event) => setDireccion(event.target.value)} placeholder="Calle y altura (ej.: Av. Corrientes 1234)" maxLength={200} required />
      <div className={cn("grid gap-3", !compact && "sm:grid-cols-2")}>
        <Input value={detalle} onChange={(event) => setDetalle(event.target.value)} placeholder="Piso / depto (opcional)" maxLength={80} />
        <Input value={instrucciones} onChange={(event) => setInstrucciones(event.target.value)} placeholder="Indicaciones para el repartidor" maxLength={200} />
      </div>
      <Button type="submit" className="w-full rounded-full" disabled={saving}><Plus className="h-4 w-4" />{saving ? "Guardando…" : "Guardar dirección"}</Button>
    </form>
  );
}

export function AddressIcon({ alias, className }: { alias: string; className?: string }) {
  const Icon = alias === "Casa" ? Home : alias === "Trabajo" ? Briefcase : MapPin;
  return <Icon className={className} />;
}

export function AddressList({ addresses, onDeleted, selectable }: { addresses: SavedAddress[]; onDeleted?: () => void; selectable?: (address: SavedAddress) => void }) {
  const { address: selected } = useCart();
  const remove = async (id: string) => {
    const { error } = await db.from("delivery_direcciones").delete().eq("id", id);
    if (error) return toast.error(errorMessage(error));
    toast.success("Dirección eliminada");
    onDeleted?.();
  };
  return (
    <ul className="space-y-2">
      {addresses.map((address) => {
        const active = selected?.id === address.id;
        return (
          <li key={address.id} className={cn("flex items-center gap-3 rounded-xl border p-3", active && "border-primary bg-primary/5")}>
            <button type="button" className="flex min-w-0 flex-1 items-center gap-3 text-left" onClick={() => selectable?.(address)} disabled={!selectable}>
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted"><AddressIcon alias={address.alias} className="h-5 w-5" /></span>
              <span className="min-w-0">
                <span className="block font-bold">{address.alias}</span>
                <span className="block truncate text-sm text-muted-foreground">{fullAddress(address)}</span>
              </span>
              {active && <Check className="ml-auto h-5 w-5 shrink-0 text-primary" />}
            </button>
            {onDeleted && <Button type="button" size="icon" variant="ghost" aria-label="Eliminar dirección" onClick={() => remove(address.id)}><Trash2 className="h-4 w-4" /></Button>}
          </li>
        );
      })}
    </ul>
  );
}

export function AddressDialog({ trigger }: { trigger: ReactNode }) {
  const [open, setOpen] = useState(false);
  const { addresses, reload } = useSavedAddresses();
  const { setAddress } = useCart();
  const [adding, setAdding] = useState(false);

  const choose = (address: SavedAddress) => {
    setAddress({ id: address.id, alias: address.alias, direccion: fullAddress(address) });
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (next) reload(); }}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">¿Dónde querés recibir tu pedido?</DialogTitle>
          <DialogDescription>Elegí una dirección guardada o agregá una nueva.</DialogDescription>
        </DialogHeader>
        {addresses.length > 0 && <AddressList addresses={addresses} selectable={choose} />}
        {adding || addresses.length === 0 ? (
          <AddressForm compact onSaved={(address) => { setAdding(false); reload(); choose(address); }} />
        ) : (
          <Button variant="outline" className="rounded-full" onClick={() => setAdding(true)}><Plus className="h-4 w-4" />Agregar dirección</Button>
        )}
      </DialogContent>
    </Dialog>
  );
}
