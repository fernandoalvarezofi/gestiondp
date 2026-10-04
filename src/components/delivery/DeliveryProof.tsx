import { useEffect, useState } from "react";
import { Camera } from "lucide-react";
import { deliveryProofUrl } from "@/lib/uploads";

/** Foto que sacó el repartidor al dejar el pedido (privada: URL temporal para quienes ven el pedido). */
export function DeliveryProof({ path }: { path?: string | null }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    setUrl(null);
    if (path) deliveryProofUrl(path).then((signed) => { if (alive) setUrl(signed); });
    return () => { alive = false; };
  }, [path]);
  if (!path || !url) return null;
  return (
    <section className="mt-4 overflow-hidden rounded-3xl border bg-card">
      <p className="flex items-center gap-2 p-4 pb-2 font-bold"><Camera className="h-5 w-5 text-primary" />Foto de la entrega</p>
      <img src={url} alt="Foto del pedido entregado en la puerta" loading="lazy" className="max-h-80 w-full object-cover" />
    </section>
  );
}
