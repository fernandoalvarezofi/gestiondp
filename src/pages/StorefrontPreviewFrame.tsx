import { useEffect, useState } from "react";
import { StorefrontReview, StorefrontView } from "@/components/storefront/StorefrontView";
import type { DeliveryProduct, DeliverySection, DeliveryStore } from "@/lib/delivery";
import type { VendedorResumen } from "@/lib/marketplace";
import type { TemaNormalizado } from "@/lib/storefront";

export type PreviewData = { store: DeliveryStore; tema: TemaNormalizado; products: DeliveryProduct[]; sections: DeliverySection[]; reviews: StorefrontReview[]; vendedor?: VendedorResumen | null };

/**
 * Página que se carga dentro del marco de vista previa del editor. No lee nada de la base: muestra solo lo que le manda
 * la ventana que la contiene (del mismo sitio) y le avisa cuando se toca un bloque. Así se ve la tienda con el ancho real
 * de un celular o de una computadora, con los mismos estilos que el sitio público.
 */
export default function StorefrontPreviewFrame() {
  const [data, setData] = useState<PreviewData | null>(null);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    const onMessage = (event: MessageEvent) => {
      if (event.origin !== window.location.origin || event.source !== window.parent) return;
      const message = event.data as { tipo?: string; datos?: PreviewData; id?: string } | null;
      if (message?.tipo === "woref-vista-previa" && message.datos) setData(message.datos);
      if (message?.tipo === "woref-seleccion") {
        setSelected(message.id ?? null);
        if (message.id) document.getElementById(`bloque-${message.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ tipo: "woref-vista-previa-lista" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!data) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Cargando vista previa…</div>;
  return (
    <StorefrontView
      store={data.store}
      tema={data.tema}
      products={data.products}
      sections={data.sections}
      reviews={data.reviews}
      vendedor={data.vendedor ?? null}
      preview
      selectedBlock={selected}
      onSelectBlock={(id) => { setSelected(id); window.parent.postMessage({ tipo: "woref-bloque", id }, window.location.origin); }}
    />
  );
}
