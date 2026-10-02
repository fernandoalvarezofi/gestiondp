import { FormEvent, ReactNode, useCallback, useEffect, useRef, useState } from "react";
import { AddressSearch } from "@/components/maps/AddressSearch";
import { MapPicker } from "@/components/maps/LazyMaps";
import { currentPosition, GeoPoint, reverseGeocode } from "@/lib/geo";
import { AlertTriangle, Briefcase, Check, Home, Loader2, LocateFixed, MapPin, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/contexts/AuthContext";
import { useCart } from "@/contexts/CartContext";
import { db, errorMessage } from "@/lib/delivery";
import { cn } from "@/lib/utils";

export type SavedAddress = { id: string; alias: string; direccion: string; detalle?: string | null; instrucciones?: string | null; predeterminada: boolean; latitud?: number | null; longitud?: number | null };

/** Lo que guarda el carrito como dirección elegida (incluye coordenadas para calcular zona y envío). */
export const toCartAddress = (address: SavedAddress) => ({
  id: address.id || null,
  alias: address.alias,
  direccion: fullAddress(address),
  lat: address.latitud != null ? Number(address.latitud) : null,
  lng: address.longitud != null ? Number(address.longitud) : null,
});

export const fullAddress = (address: Pick<SavedAddress, "direccion" | "detalle">) => [address.direccion, address.detalle].filter(Boolean).join(", ");

export function useSavedAddresses() {
  const { user } = useAuth();
  const [addresses, setAddresses] = useState<SavedAddress[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    // Sin sesión no hay direcciones guardadas: se puede explorar eligiendo una ubicación, que no se guarda.
    if (!user) { setAddresses([]); setLoading(false); return; }
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
  const [point, setPoint] = useState<GeoPoint | null>(null);
  const [detalle, setDetalle] = useState("");
  const [instrucciones, setInstrucciones] = useState("");
  const [saving, setSaving] = useState(false);
  const [approximate, setApproximate] = useState(false);
  const moved = useRef(0);

  // Si mueven el pin, actualizamos la calle y altura según el nuevo punto.
  const movePin = (next: GeoPoint) => {
    setPoint(next);
    setApproximate(false);
    const ticket = ++moved.current;
    window.setTimeout(async () => {
      if (ticket !== moved.current) return;
      const found = await reverseGeocode(next);
      if (found && ticket === moved.current && /\d/.test(found.label)) setDireccion(found.label);
    }, 700);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!point) return toast.error("Buscá tu dirección y confirmá el pin en el mapa");
    if (direccion.trim().length < 4) return toast.error("Escribí la calle y la altura");
    if (!/\d|s\/n/i.test(direccion)) return toast.error("Agregá la altura de la calle (o \"s/n\" si no tiene) para que el repartidor te encuentre");
    if (!user) {
      // Visitante: usamos la dirección para mostrar los comercios que llegan; se guarda cuando inicie sesión.
      onSaved?.({ id: "", alias: alias.trim() || "Casa", direccion: direccion.trim(), detalle: detalle.trim() || null, instrucciones: instrucciones.trim() || null, predeterminada: false, latitud: point.lat, longitud: point.lng });
      return;
    }
    setSaving(true);
    const { data, error } = await db.from("delivery_direcciones").insert({
      perfil_id: user.id,
      alias: alias.trim() || "Casa",
      direccion: direccion.trim(),
      detalle: detalle.trim() || null,
      instrucciones: instrucciones.trim() || null,
      latitud: point.lat,
      longitud: point.lng,
    }).select("*").single();
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    toast.success("Dirección guardada");
    setDireccion(""); setDetalle(""); setInstrucciones(""); setPoint(null); setApproximate(false);
    onSaved?.(data);
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <div className="flex gap-2">
        {["Casa", "Trabajo", "Otra"].map((option) => (
          <button key={option} type="button" onClick={() => setAlias(option)} className={cn("rounded-full border px-3 py-1.5 text-sm font-semibold", alias === option ? "border-primary bg-primary/10 text-primary" : "text-muted-foreground")}>{option}</button>
        ))}
      </div>
      {!point ? (
        <AddressSearch autoFocus={compact} hideLocate={compact} onPick={(found) => { setPoint({ lat: found.lat, lng: found.lng }); setDireccion(found.label); setApproximate(found.precision === "calle"); }} />
      ) : (
        <>
          <MapPicker value={point} onChange={movePin} className="h-56" />
          {approximate && <p className="flex items-start gap-2 rounded-xl bg-warning/15 p-3 text-xs font-semibold"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />Ubicación aproximada. Mové el mapa hasta que el pin quede en tu puerta: de eso depende el costo y el tiempo del envío.</p>}
          <div className="flex gap-2">
            <Input value={direccion} onChange={(event) => setDireccion(event.target.value)} placeholder="Calle y altura" maxLength={200} required aria-label="Calle y altura" />
            <Button type="button" variant="ghost" onClick={() => setPoint(null)}>Cambiar</Button>
          </div>
          <div className={cn("grid gap-3", !compact && "sm:grid-cols-2")}>
            <Input value={detalle} onChange={(event) => setDetalle(event.target.value)} placeholder="Piso / depto (opcional)" maxLength={80} />
            <Input value={instrucciones} onChange={(event) => setInstrucciones(event.target.value)} placeholder="Indicaciones para el repartidor" maxLength={200} />
          </div>
          <Button type="submit" className="w-full rounded-full" disabled={saving}><Plus className="h-4 w-4" />{saving ? "Guardando…" : "Guardar dirección"}</Button>
        </>
      )}
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
                {address.latitud == null && <span className="block text-xs font-semibold text-warning-foreground dark:text-warning">Sin ubicación en el mapa: cargala de nuevo para pedir</span>}
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

/** Usa la ubicación del dispositivo como dirección de entrega, sin necesidad de guardarla. */
export function UseCurrentLocation({ onDone, className }: { onDone?: () => void; className?: string }) {
  const { setAddress } = useCart();
  const [locating, setLocating] = useState(false);

  const locate = async () => {
    setLocating(true);
    try {
      const position = await currentPosition();
      const found = await reverseGeocode(position);
      if (!found || found.precision !== "exacta") {
        toast.info("Detectamos tu ubicación, pero no la altura exacta. Confirmala en el mapa para que el envío sea preciso.");
      }
      setAddress({ id: null, alias: "Ubicación actual", direccion: found ? [found.label, found.detail.split(",")[0]].filter(Boolean).join(", ") : "Mi ubicación actual", lat: position.lat, lng: position.lng });
      toast.success("Usamos tu ubicación actual");
      onDone?.();
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setLocating(false);
    }
  };

  return (
    <Button type="button" variant="outline" className={cn("h-12 w-full justify-start gap-3 rounded-2xl text-left", className)} onClick={locate} disabled={locating}>
      {locating ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <LocateFixed className="h-5 w-5 text-primary" />}
      <span><span className="block text-sm font-bold">Usar mi ubicación actual</span><span className="block text-xs font-normal text-muted-foreground">Detectada con el GPS de tu dispositivo</span></span>
    </Button>
  );
}

export function AddressDialog({ trigger, open: controlledOpen, onOpenChange, title }: { trigger?: ReactNode; open?: boolean; onOpenChange?: (open: boolean) => void; title?: string }) {
  const [innerOpen, setInnerOpen] = useState(false);
  const open = controlledOpen ?? innerOpen;
  const setOpen = (next: boolean) => { setInnerOpen(next); onOpenChange?.(next); };
  const { addresses, reload } = useSavedAddresses();
  const { setAddress } = useCart();
  const [adding, setAdding] = useState(false);

  useEffect(() => { if (open) reload(); }, [open, reload]);

  const choose = (address: SavedAddress) => {
    setAddress(toCartAddress(address));
    setOpen(false);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent className="max-h-[92vh] max-w-md overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl font-extrabold">{title || "¿Dónde querés recibir tu pedido?"}</DialogTitle>
          <DialogDescription>Mostramos solo los comercios que llegan a tu dirección.</DialogDescription>
        </DialogHeader>
        <UseCurrentLocation onDone={() => setOpen(false)} />
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
