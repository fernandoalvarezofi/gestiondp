import { useEffect, useMemo, useRef, useState } from "react";
import { StorefrontView, type PaginaTienda } from "@/components/storefront/StorefrontView";
import type { DeliveryStore } from "@/lib/delivery";
import { type Actividad, actividadInfo, type DatosSitio, sitioInicial } from "@/lib/sitioWeb";
import { normalizeTheme } from "@/lib/storefront";

/**
 * Vista previa real del sitio que se va a crear: es la misma pantalla que la web pública (StorefrontView), con el inicio
 * y las páginas que arma `sitioInicial`. Lo que se ve acá es exactamente lo que se guarda al crear.
 */
export function SitioPreview({ actividad, datos, slug, color, alto = 760 }: { actividad: Actividad; datos: DatosSitio; slug: string; color?: string; alto?: number }) {
  const marco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.4);
  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setEscala(Math.min(1, el.clientWidth / 1200)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const { store, tema, paginas } = useMemo(() => {
    const info = actividadInfo(actividad);
    const inicial = sitioInicial(actividad, { ...datos, nombre: datos.nombre.trim() || "Tu negocio" });
    const temaFinal = normalizeTheme({ ...inicial.tema, color: color ?? inicial.tema.color });
    const tienda = {
      id: "vista-previa", slug: slug || "tu-negocio", nombre: datos.nombre.trim() || "Tu negocio", categoria: info.categoria, rubro: info.rubro, descripcion: datos.descripcion ?? "",
      direccion: datos.direccion ?? "", telefono: datos.telefono ?? "", horario: "", imagen_url: null, logo_url: null, rating: 0, total_resenas: 0, tiempo_min: 0, tiempo_max: 0,
      costo_envio: 0, pedido_minimo: 0, esta_abierto: true, activo: true, aprobado: true, tienda_tema: temaFinal, tipo_sitio: "sitio",
    } as unknown as DeliveryStore;
    const pags: PaginaTienda[] = inicial.paginas.map((p, i) => ({ id: `p${i}`, slug: p.slug, titulo: p.titulo, tipo: p.tipo, clase: p.clase, contenido: null, bloques: p.bloques, imagen_url: null }));
    return { store: tienda, tema: temaFinal, paginas: pags };
  }, [actividad, datos, slug, color]);

  return (
    <div ref={marco} className="overflow-hidden rounded-2xl border bg-background shadow-soft" style={{ height: Math.round(alto * escala) }}>
      <div className="pointer-events-none origin-top-left select-none" style={{ width: 1200, height: alto, transform: `scale(${escala})` }} aria-hidden>
        <div className="h-full overflow-hidden"><StorefrontView store={store} tema={tema} products={[]} sections={[]} paginas={paginas} preview /></div>
      </div>
    </div>
  );
}
