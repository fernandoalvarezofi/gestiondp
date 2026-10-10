import { useEffect, useState } from "react";
import type { ColeccionTienda, PaginaTienda, ServicioTienda, StorefrontReview } from "@/components/storefront/StorefrontView";
import { marcarOrigenTienda } from "@/lib/canal";
import { COMERCIO_COLS, db, DeliveryProduct, DeliverySection, DeliveryStore, productSelect } from "@/lib/delivery";
import type { VendedorResumen } from "@/lib/marketplace";
import { fetchColeccionesPublicas } from "@/services/catalogPro";

export type TiendaPublica = {
  store: DeliveryStore; products: DeliveryProduct[]; sections: DeliverySection[]; reviews: StorefrontReview[]; vendedor: VendedorResumen | null;
  servicios: ServicioTienda[]; paginas: PaginaTienda[]; colecciones: ColeccionTienda[];
};
export type EstadoTienda = { estado: "loading" } | { estado: "error" } | { estado: "missing" } | { estado: "ready"; datos: TiendaPublica };

/**
 * Todo lo que necesita cualquier página pública de una tienda (inicio, colecciones, páginas, ficha de producto): el comercio, sus
 * productos publicados, secciones, opiniones, reputación, servicios con turnos, páginas visibles y colecciones. Una sola carga y
 * una sola fuente para que el encabezado, el menú y el pie sean los mismos en todas las páginas.
 */
export function useTiendaPublica(slug: string | undefined): EstadoTienda {
  const [estado, setEstado] = useState<EstadoTienda>({ estado: "loading" });
  useEffect(() => {
    let alive = true;
    setEstado({ estado: "loading" });
    (async () => {
      const { data: found, error: falla } = await db.from("delivery_comercios").select(COMERCIO_COLS).eq("slug", slug).maybeSingle();
      if (!alive) return;
      if (falla) { setEstado({ estado: "error" }); return; }
      if (!found) { setEstado({ estado: "missing" }); return; }
      // Solo lo publicado: aunque quien mira sea del equipo (que por permisos ve borradores), la tienda muestra lo mismo que ve un cliente.
      const [{ data: catalog, error: fallaCatalogo }, { data: configured }, { data: opinions }, { data: resumen }, { data: servs }, { data: pags }, cols] = await Promise.all([
        db.from("delivery_productos").select(productSelect).eq("comercio_id", found.id).eq("estado", "publicado").order("orden").order("nombre"),
        db.from("delivery_secciones").select("*").eq("comercio_id", found.id),
        db.from("delivery_resenas").select("id,puntaje,comentario,created_at,cliente:perfiles(nombre)").eq("comercio_id", found.id).order("created_at", { ascending: false }).limit(12),
        db.rpc("delivery_vendedor_resumen", { p_slug: found.slug }),
        db.from("servicios").select("id,nombre,descripcion,duracion_min,precio,imagen_url,capacidad").eq("comercio_id", found.id).eq("activo", true).order("orden").order("nombre"),
        db.from("delivery_tienda_paginas").select("id,slug,titulo,tipo,clase,contenido,bloques,imagen_url,seo_titulo,seo_descripcion").eq("comercio_id", found.id).eq("estado", "publicada").order("orden").order("titulo"),
        fetchColeccionesPublicas(found.id).catch(() => []),
      ]);
      if (!alive) return;
      if (fallaCatalogo) { setEstado({ estado: "error" }); return; }
      marcarOrigenTienda(found.id);
      setEstado({ estado: "ready", datos: {
        store: found, products: (catalog ?? []) as DeliveryProduct[], sections: configured ?? [], reviews: opinions ?? [], vendedor: (resumen as VendedorResumen | null) ?? null,
        servicios: (servs ?? []) as ServicioTienda[], paginas: (pags ?? []) as PaginaTienda[], colecciones: cols as ColeccionTienda[],
      } });
    })();
    return () => { alive = false; };
  }, [slug]);
  return estado;
}
