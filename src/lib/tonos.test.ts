import { describe, expect, it } from "vitest";
import { tonoCategoria, tonoDe, tonoSeccion } from "./tonos";

describe("tonos", () => {
  it("cada sección principal tiene su color y no todo es verde", () => {
    expect(tonoSeccion("/app/comercio")).toBe("verde");
    expect(tonoSeccion("/app/comercio/pedidos")).toBe("naranja");
    expect(tonoSeccion("/app/comercio/turnos")).toBe("rosa");
    expect(tonoSeccion("/app/admin/logistica")).toBe("amarillo");
    expect(tonoSeccion("/app/repartidor/ganancias")).toBe("tinta");
    expect(tonoSeccion("/app/club")).toBe("amarillo");
    const barra = ["/app", "/app/explorar", "/app/pedidos", "/app/mensajes", "/app/perfil"].map(tonoSeccion);
    expect(new Set(barra).size).toBe(5);
    expect(tonoSeccion("/app/perfil/pedidos")).toBe("naranja");
    const menu = ["pedidos", "turnos", "mensajes", "envios", "clientes", "productos", "inventario", "colecciones"].map((s) => tonoSeccion(`/app/comercio/${s}`));
    expect(new Set(menu).size).toBeGreaterThanOrEqual(7);
  });
  it("categorías con nombre conocido y estables para el resto", () => {
    expect(tonoCategoria("Restaurantes")).toBe("coral");
    expect(tonoCategoria("Café")).toBe("naranja");
    expect(tonoDe("algo nuevo")).toBe(tonoDe("algo nuevo"));
  });
});
