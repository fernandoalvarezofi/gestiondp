import { useEffect, useMemo, useRef, useState } from "react";
import { StorefrontView, type PaginaTienda, type ServicioTienda } from "@/components/storefront/StorefrontView";
import type { DeliveryProduct, DeliveryStore } from "@/lib/delivery";
import { type DatosNegocio, type Entrega, inicioNegocio, type ProductoInicial, rubroDe, type ServicioInicial, type TipoNegocio } from "@/lib/creador";
import { normalizeTheme, type Plantilla } from "@/lib/storefront";

const ENTREGA_BASE: Entrega = { envioPropio: true, retiro: true, pedidos: true };
const EJEMPLOS: Record<"tienda" | "carta", ProductoInicial[]> = {
  tienda: [1, 2, 3, 4].map((n) => ({ nombre: `Producto de ejemplo ${n}`, precio: 9000 + n * 2500, categoria: "Destacados" })),
  carta: [["Entradas", "Empanadas"], ["Platos", "Milanesa con papas"], ["Platos", "Ravioles caseros"], ["Bebidas", "Limonada"]].map(([categoria, nombre], i) => ({ nombre, categoria, precio: 4500 + i * 3000 })),
};

/**
 * Vista previa real del negocio que se va a crear: la misma pantalla que la web pública (StorefrontView), con el inicio, las
 * páginas, los productos y los servicios que arma el creador. Lo que se ve acá es lo que se guarda al crear.
 */
export function NegocioPreview({ tipo, rubro, datos, slug, color, plantilla, entrega = ENTREGA_BASE, productos, servicios, alto = 1300, costoEnvio = 0 }: {
  tipo: TipoNegocio; rubro: string; plantilla?: Plantilla; datos: DatosNegocio; slug: string; color?: string; entrega?: Entrega; productos?: ProductoInicial[]; servicios?: ServicioInicial[]; alto?: number; costoEnvio?: number;
}) {
  const marco = useRef<HTMLDivElement>(null);
  const [escala, setEscala] = useState(0.4);
  useEffect(() => {
    const el = marco.current;
    if (!el) return;
    const obs = new ResizeObserver(() => setEscala(Math.min(1, el.clientWidth / 1200)));
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  const vista = useMemo(() => {
    const info = rubroDe(tipo, rubro);
    const nombre = datos.nombre.trim() || "Tu negocio";
    const inicial = inicioNegocio(tipo, rubro, { ...datos, nombre }, entrega, plantilla);
    const tema = normalizeTheme({ ...inicial.tema, color: color ?? inicial.tema.color });
    const vende = tipo === "tienda" || tipo === "carta";
    const store = {
      id: "vista-previa", slug: slug || "tu-negocio", nombre, categoria: info.categoria, rubro: info.nombre, descripcion: datos.descripcion ?? "",
      direccion: datos.direccion ?? "", telefono: datos.telefono ?? "", horario: "", imagen_url: null, logo_url: null, rating: 0, total_resenas: 0, tiempo_min: 0, tiempo_max: 0,
      costo_envio: costoEnvio, pedido_minimo: 0, esta_abierto: true, activo: true, aprobado: true, tienda_tema: tema,
      tipo_sitio: vende ? "tienda" : "sitio", en_market: false, envio_propio: vende && entrega.envioPropio, acepta_retiro: vende && entrega.retiro, pedidos_online: tipo === "carta" ? entrega.pedidos : true,
    } as unknown as DeliveryStore;
    const lista = vende ? (productos?.length ? productos : EJEMPLOS[tipo]) : [];
    const products = lista.map((p, i) => ({ id: `p${i}`, comercio_id: "vista-previa", descripcion: p.descripcion ?? null, precio_anterior: null, stock: null, disponible: true, destacado: i < 4, orden: i, etiquetas: [], grupos: [], nombre: p.nombre, precio: p.precio, categoria: p.categoria, imagen_url: p.imagen_url ?? null })) as unknown as DeliveryProduct[];
    const servs: ServicioTienda[] = tipo === "servicios" ? (servicios?.length ? servicios : [{ nombre: "Servicio de ejemplo", duracion_min: 45, precio: 12000 }]).map((s, i) => ({ id: `s${i}`, nombre: s.nombre, descripcion: null, duracion_min: s.duracion_min, precio: s.precio, imagen_url: null })) : [];
    const paginas: PaginaTienda[] = inicial.paginas.map((p, i) => ({ id: `g${i}`, slug: p.slug, titulo: p.titulo, tipo: p.tipo, clase: p.clase, contenido: null, bloques: p.bloques, imagen_url: null }));
    return { store, tema, products, servs, paginas };
  }, [tipo, rubro, datos, slug, color, plantilla, entrega, productos, servicios, costoEnvio]);

  return (
    <div ref={marco} className="overflow-hidden rounded-2xl border bg-background shadow-soft" style={{ height: Math.round(alto * escala) }}>
      <div className="pointer-events-none origin-top-left select-none" style={{ width: 1200, height: alto, transform: `scale(${escala})` }} aria-hidden>
        <div className="h-full overflow-hidden">
          <StorefrontView store={vista.store} tema={vista.tema} products={vista.products} sections={[]} paginas={vista.paginas} servicios={vista.servs} reservaHref={vista.servs.length ? `/t/${vista.store.slug}/reservar` : null} preview />
        </div>
      </div>
    </div>
  );
}
