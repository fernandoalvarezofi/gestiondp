import { useEffect, useState } from "react";
import { ProductoDetalle } from "@/components/storefront/ProductoDetalle";
import { ColeccionTienda, PaginaTienda, ServicioTienda, StorefrontReview, StorefrontView } from "@/components/storefront/StorefrontView";
import type { DeliveryProduct, DeliverySection, DeliveryStore } from "@/lib/delivery";
import type { VendedorResumen } from "@/lib/marketplace";
import type { TemaNormalizado } from "@/lib/storefront";
import type { Vista } from "@/lib/storeRoutes";

export type PreviewData = {
  store: DeliveryStore; tema: TemaNormalizado; products: DeliveryProduct[]; sections: DeliverySection[]; reviews: StorefrontReview[]; vendedor?: VendedorResumen | null;
  servicios?: ServicioTienda[]; colecciones?: ColeccionTienda[]; paginas?: PaginaTienda[]; reservaHref?: string | null;
  /** Qué página de la tienda se previsualiza (inicio, una página propia, una colección…). */
  vista?: Vista;
  /** Producto de ejemplo para previsualizar la plantilla de la ficha. */
  productoId?: string | null;
};

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
        // La sección puede llegar recién agregada: se espera a que se dibuje antes de bajar hasta ella.
        if (message.id) window.setTimeout(() => document.getElementById(`bloque-${message.id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 250);
      }
    };
    window.addEventListener("message", onMessage);
    window.parent.postMessage({ tipo: "woref-vista-previa-lista" }, window.location.origin);
    return () => window.removeEventListener("message", onMessage);
  }, []);

  if (!data) return <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">Cargando vista previa…</div>;
  const producto = data.vista?.tipo === "producto" ? data.products.find((x) => x.id === data.productoId) ?? data.products[0] : undefined;
  const principal = data.vista?.tipo !== "producto" ? undefined : producto
    ? <ProductoDetalle store={data.store} product={producto} others={data.products.filter((x) => x.id !== producto.id)} vendedor={data.vendedor ?? null} theme={data.tema} preview />
    : <p className="mx-auto max-w-xl px-6 py-16 text-center text-muted-foreground">Cargá y publicá un producto para ver cómo queda la ficha.</p>;
  return (
    <StorefrontView
      store={data.store}
      tema={data.tema}
      products={data.products}
      sections={data.sections}
      reviews={data.reviews}
      vendedor={data.vendedor ?? null}
      servicios={data.servicios ?? []}
      colecciones={data.colecciones ?? []}
      paginas={data.paginas ?? []}
      reservaHref={data.reservaHref ?? null}
      vista={data.vista}
      principal={principal}
      preview
      selectedBlock={selected}
      onSelectBlock={(id) => { setSelected(id); window.parent.postMessage({ tipo: "woref-bloque", id }, window.location.origin); }}
    />
  );
}
