import { useState } from "react";
import { BellRing, CheckCircle2, Loader2, MapPinOff } from "lucide-react";
import { toast } from "sonner";
import { AddressDialog } from "@/components/delivery/AddressDialog";
import { Button } from "@/components/ui/button";
import { useCart } from "@/contexts/CartContext";
import { db, errorMessage } from "@/lib/delivery";
import { formatKm } from "@/lib/geo";

/** Se muestra cuando ningún comercio llega a la dirección elegida: explica qué pasa y registra la demanda de la zona. */
export function OutOfZone({ nearestKm }: { nearestKm: number | null }) {
  const { address } = useCart();
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);

  const notify = async () => {
    if (address?.lat == null || address?.lng == null) return;
    setSaving(true);
    const { error } = await db.rpc("delivery_registrar_zona", { p_lat: address.lat, p_lng: address.lng, p_direccion: address.direccion });
    setSaving(false);
    if (error) return toast.error(errorMessage(error));
    setDone(true);
  };

  return (
    <section className="mt-4 rounded-3xl border bg-card p-5 text-center shadow-soft sm:p-8">
      <span className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 text-primary"><MapPinOff className="h-8 w-8" /></span>
      <h2 className="mt-4 text-xl font-black">Todavía no llegamos a tu zona</h2>
      <p className="mx-auto mt-1 max-w-md text-sm text-muted-foreground">
        Ningún comercio entrega en <span className="font-bold text-foreground">{address?.direccion}</span>
        {nearestKm != null && <>. El más cercano está a {formatKm(nearestKm)}</>}.
      </p>
      <div className="mt-5 flex flex-col items-center justify-center gap-2 sm:flex-row">
        <AddressDialog trigger={<Button className="rounded-full">Probar con otra dirección</Button>} />
        {done ? (
          <p className="flex items-center gap-1.5 text-sm font-bold text-success"><CheckCircle2 className="h-4 w-4" />Listo, anotamos tu zona. Te avisamos cuando lleguemos.</p>
        ) : (
          <Button variant="outline" className="rounded-full" onClick={notify} disabled={saving || address?.lat == null}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <BellRing className="h-4 w-4" />}Avisame cuando lleguen
          </Button>
        )}
      </div>
      <p className="mt-3 text-xs text-muted-foreground">Cuantas más personas pidan desde tu zona, antes sumamos comercios.</p>
    </section>
  );
}
