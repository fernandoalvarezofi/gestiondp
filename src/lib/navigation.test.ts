import { describe, expect, it } from "vitest";
import { isRootPath, pageTitle, parentPath } from "./navigation";

describe("navegación", () => {
  it("las pantallas de la barra de abajo y los paneles son raíz", () => {
    for (const path of ["/app", "/app/buscar", "/app/pedidos/", "/app/perfil", "/app/comercio", "/app/admin"]) expect(isRootPath(path)).toBe(true);
    expect(isRootPath("/app/perfil/seguridad")).toBe(false);
  });
  it("calcula la pantalla madre", () => {
    expect(parentPath("/app/perfil/seguridad")).toBe("/app/perfil");
    expect(parentPath("/app/pedidos/abc")).toBe("/app/pedidos");
    expect(parentPath("/app/ayuda/123")).toBe("/app/ayuda");
    expect(parentPath("/app/ayuda")).toBe("/app/perfil/ayuda");
    expect(parentPath("/app/tienda/pizzeria")).toBe("/app");
    expect(parentPath("/app/comercio/menu")).toBe("/app/comercio");
    expect(parentPath("/app/comercio/configuracion/horarios")).toBe("/app/comercio");
    expect(parentPath("/app/admin/pagos")).toBe("/app/admin");
  });
  it("da título a las pantallas conocidas", () => {
    expect(pageTitle("/app/carrito")).toBe("Mi pedido");
    expect(pageTitle("/app/desconocida")).toBe("");
  });
});
