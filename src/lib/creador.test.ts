import { describe, expect, it } from "vitest";
import { datosAlta, inicioNegocio, productosValidos, RUBROS, TIPOS_NEGOCIO, type TipoNegocio } from "./creador";
import { menuHref, normalizeBloque, normalizeTheme } from "./storefront";

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const entrega = { envioPropio: true, retiro: false, pedidos: true, envioDetalle: "Correo, 3 a 5 días" };

describe("creador: punto de partida de cada tipo y rubro", () => {
  for (const tipo of TIPOS_NEGOCIO.map((t) => t.id)) {
    for (const rubro of RUBROS[tipo]) {
      it(`${tipo} / ${rubro.nombre}: secciones válidas, páginas y menú consistentes`, () => {
        const { tema, paginas } = inicioNegocio(tipo, rubro.id, { nombre: "La Esquina", descripcion: "Un lugar de barrio", whatsapp: "5492355123456" }, entrega);
        const bloques = tema.bloques ?? [];
        expect(bloques.length).toBeGreaterThan(2);
        bloques.forEach((b, i) => expect(normalizeBloque(b, i)).not.toBeNull());
        // Sin testimonios escritos de ejemplo ("opiniones" sí puede estar: muestra solo reseñas reales de compradores).
        expect(bloques.some((b) => b.tipo === "testimonios")).toBe(false);
        const slugs = paginas.map((p) => p.slug);
        expect(new Set(slugs).size).toBe(slugs.length);
        for (const p of paginas) { expect(p.slug).toMatch(SLUG); p.bloques.forEach((b, i) => expect(normalizeBloque(b, i)).not.toBeNull()); }
        for (const m of tema.menu ?? []) if (m.tipo === "pagina") expect(slugs).toContain(m.destino);
        expect(normalizeTheme(tema).plantilla).toBe(tipo === "sitio" ? normalizeTheme(tema).plantilla : rubro.plantilla);
      });
    }
  }

  it("la tienda muestra catálogo y solo las ventajas que de verdad ofrece", () => {
    const soloRetiro = inicioNegocio("tienda", "moda", { nombre: "Ropa QA" }, { envioPropio: false, retiro: true, pedidos: true });
    const items = (soloRetiro.tema.bloques ?? []).flatMap((b) => (b.tipo === "confianza" ? b.items : []));
    expect(items.some((i) => i.icono === "envio")).toBe(false);
    expect(items.some((i) => i.icono === "local")).toBe(true);
    expect((soloRetiro.tema.bloques ?? []).some((b) => b.tipo === "catalogo")).toBe(true);
    expect(soloRetiro.paginas.map((p) => p.clase)).toContain("cambios");
  });

  it("la carta tiene catálogo, ubicación y reservas, y servicios tiene reserva de turnos", () => {
    const carta = inicioNegocio("carta", "restaurante", { nombre: "Bodegón" }, { envioPropio: false, retiro: false, pedidos: false });
    const tiposCarta = (carta.tema.bloques ?? []).map((b) => b.tipo);
    for (const t of ["catalogo", "ubicacion", "formulario"]) expect(tiposCarta).toContain(t);
    const turnos = inicioNegocio("servicios", "belleza", { nombre: "Estudio" }, entrega);
    expect((turnos.tema.bloques ?? []).map((b) => b.tipo)).toContain("servicios");
    expect((turnos.tema.menu ?? []).some((m) => m.tipo === "reservar")).toBe(true);
    expect(menuHref("estudio", { texto: "Reservar", tipo: "reservar" })).toBe("/t/estudio/reservar");
  });

  it("respeta la plantilla elegida", () => {
    for (const tipo of ["tienda", "carta", "servicios", "sitio"] as TipoNegocio[]) {
      const { tema } = inicioNegocio(tipo, RUBROS[tipo][0].id, { nombre: "QA" }, entrega, "urbano");
      expect(tema.plantilla).toBe("urbano");
    }
  });
});

describe("creador: datos de alta", () => {
  it("una tienda manda sus formas de entrega y una página web no manda datos de venta", () => {
    expect(datosAlta("tienda", "moda", { nombre: " Ropa ", slug: "ropa" }, entrega, 3000)).toMatchObject({ nombre: "Ropa", pedidos_online: true, envio_propio: true, acepta_retiro: false, costo_envio: 3000, envio_detalle: "Correo, 3 a 5 días", categoria: "tiendas" });
    const web = datosAlta("sitio", "profesional", { nombre: "Estudio", slug: "estudio" }, entrega, 3000);
    expect(web).not.toHaveProperty("envio_propio");
    expect(web).not.toHaveProperty("pedidos_online");
  });
  it("una carta sin pedidos no ofrece envío ni retiro", () => {
    expect(datosAlta("carta", "restaurante", { nombre: "Bodegón", slug: "bodegon" }, { envioPropio: true, retiro: true, pedidos: false }, 0)).toMatchObject({ pedidos_online: false, envio_propio: false, acepta_retiro: false, categoria: "comida" });
  });
  it("solo pasan los productos con nombre y precio", () => {
    expect(productosValidos([{ nombre: "Remera", precio: "10000", categoria: "" }, { nombre: "", precio: "5", categoria: "x" }, { nombre: "Gorra", precio: "0", categoria: "x" }])).toEqual([{ nombre: "Remera", precio: 10000, categoria: "Destacados", descripcion: undefined, imagen_url: undefined }]);
  });
});
