import { describe, expect, it } from "vitest";
import { contextFromPath, contextsFor } from "./contexts";
import { isPublicClientPath } from "./guards";
import { ADMIN_SECTIONS, adminNav, CLIENT_TABS, COURIER_TABS, courierNav, driverNav, merchantNav, merchantSectionAvailable, merchantSectionPermission, merchantTabs } from "./menus";
import type { Permission } from "@/pages/delivery/merchant/context";

const cliente = { isAdmin: false, isCourier: false, isDriver: false, storeId: null };

describe("contextos", () => {
  it("cada ruta pertenece a un solo contexto", () => {
    expect(contextFromPath("/app")).toBe("cliente");
    expect(contextFromPath("/app/pedidos/abc")).toBe("cliente");
    expect(contextFromPath("/app/comercio/productos")).toBe("comercio");
    expect(contextFromPath("/app/repartidor")).toBe("repartidor");
    expect(contextFromPath("/app/conductor/historial")).toBe("conductor");
    expect(contextFromPath("/app/admin/pagos")).toBe("admin");
    // Un prefijo parecido no es el contexto (no hay /app/comerciosx en el comercio).
    expect(contextFromPath("/app/comerciosx")).toBe("cliente");
  });

  it("un cliente solo tiene su contexto y se le ofrece sumarse a los de trabajo (nunca a administración)", () => {
    const { available, joinable } = contextsFor(cliente);
    expect(available.map((c) => c.id)).toEqual(["cliente"]);
    expect(joinable.map((c) => c.id)).toEqual(["comercio", "repartidor", "conductor"]);
  });

  it("una cuenta con varios roles ve todos sus contextos", () => {
    const { available, joinable } = contextsFor({ isAdmin: true, isCourier: true, isDriver: false, storeId: "x" });
    expect(available.map((c) => c.id)).toEqual(["cliente", "comercio", "repartidor", "admin"]);
    expect(joinable.map((c) => c.id)).toEqual(["conductor"]);
  });
});

describe("guardas", () => {
  it("solo lo de explorar y comprar del cliente es público", () => {
    for (const path of ["/app", "/app/explorar", "/app/buscar", "/app/tienda/pizzeria", "/app/carrito"]) expect(isPublicClientPath(path)).toBe(true);
    for (const path of ["/app/pedidos", "/app/perfil", "/app/mensajes", "/app/comercio", "/app/repartidor", "/app/conductor", "/app/admin"]) expect(isPublicClientPath(path)).toBe(false);
  });
});

describe("menús", () => {
  it("el cliente tiene 5 pestañas sin paneles de trabajo", () => {
    expect(CLIENT_TABS).toHaveLength(5);
    expect(CLIENT_TABS.some((tab) => /comercio|repartidor|conductor|admin/.test(tab.to))).toBe(false);
  });

  it("el menú del comercio respeta el rol del equipo", () => {
    const operador = (p: Permission) => p === "pedidos";
    const items = merchantNav(operador, { pedidos: 2, preguntas: 0 }).flatMap((g) => g.items.map((i) => i.to));
    expect(items).toContain("/app/comercio/pedidos");
    expect(items).not.toContain("/app/comercio/finanzas");
    expect(items).not.toContain("/app/comercio/productos");
    expect(merchantTabs(operador)).toEqual(["/app/comercio", "/app/comercio/pedidos"]);
    expect(merchantSectionPermission("finanzas")).toBe("finanzas");
    expect(merchantSectionPermission("nuevo")).toBe("equipo");
  });

  it("repartidor y conductor tienen Mapa; el comercio, Clientes con permiso de estadísticas; admin, Analytics y Seguridad", () => {
    expect(courierNav(0)[0].items.map((i) => i.to)).toContain("/app/repartidor/mapa");
    expect(COURIER_TABS).toEqual(["/app/repartidor", "/app/repartidor/mapa", "/app/repartidor/ganancias", "/app/repartidor/historial", "/app/repartidor/perfil"]);
    expect(driverNav(0)[0].items.map((i) => i.to)).toContain("/app/conductor/mapa");
    expect(merchantSectionPermission("clientes")).toBe("estadisticas");
    expect(ADMIN_SECTIONS.map((s) => s.id)).toEqual(expect.arrayContaining(["analytics", "seguridad"]));
  });

  it("cada sección de administración aparece una sola vez en el menú", () => {
    const ids = ADMIN_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tos = adminNav({}).flatMap((g) => g.items.map((i) => i.to));
    expect(tos).toHaveLength(ids.length);
    expect(tos[0]).toBe("/app/admin");
  });
});

describe("sitio web (negocio sin venta en línea)", () => {
  const todo = () => true;
  const rutas = (tipo: "tienda" | "sitio") => merchantNav(todo, { pedidos: 0, preguntas: 0 }, tipo).flatMap((g) => g.items.map((i) => i.to));

  it("el panel de un sitio no muestra pedidos, catálogo, ventas ni finanzas, y sí el sitio, el CRM y las consultas", () => {
    const sitio = rutas("sitio");
    for (const r of ["/app/comercio/pedidos", "/app/comercio/productos", "/app/comercio/inventario", "/app/comercio/finanzas", "/app/comercio/estadisticas", "/app/comercio/envios", "/app/comercio/tienda"]) expect(sitio).not.toContain(r);
    for (const r of ["/app/comercio", "/app/comercio/tienda/resumen", "/app/comercio/tienda/editor", "/app/comercio/tienda/temas", "/app/comercio/tienda/seo", "/app/comercio/clientes", "/app/comercio/clientes/seguimientos", "/app/comercio/configuracion"]) expect(sitio).toContain(r);
  });

  it("el panel de una tienda queda igual que antes", () => {
    const tienda = rutas("tienda");
    for (const r of ["/app/comercio/pedidos", "/app/comercio/productos", "/app/comercio/tienda", "/app/comercio/finanzas"]) expect(tienda).toContain(r);
    expect(tienda.some((r) => r.startsWith("/app/comercio/tienda/"))).toBe(false);
    expect(merchantTabs(todo)).toEqual(merchantTabs(todo, "tienda"));
  });

  it("las direcciones de venta no existen para un sitio (el panel las devuelve al inicio)", () => {
    expect(merchantSectionAvailable("pedidos", "sitio")).toBe(false);
    expect(merchantSectionAvailable("productos", "sitio")).toBe(false);
    expect(merchantSectionAvailable("tienda", "sitio")).toBe(true);
    expect(merchantSectionAvailable("clientes", "sitio")).toBe(true);
    expect(merchantSectionAvailable("turnos", "sitio")).toBe(true);
    expect(merchantSectionAvailable("pedidos", "tienda")).toBe(true);
  });

  it("la barra de abajo de un sitio lleva al sitio y a los clientes, respetando los permisos del rol", () => {
    expect(merchantTabs(todo, "sitio")).toEqual(["/app/comercio", "/app/comercio/clientes", "/app/comercio/tienda/resumen", "/app/comercio/mensajes", "/app/comercio/configuracion"]);
    const operador = (p: Permission) => p === "pedidos";
    expect(merchantTabs(operador, "sitio")).toEqual(["/app/comercio", "/app/comercio/mensajes"]);
  });

  it("la presentación del creador es pública; el alta pide iniciar sesión", () => {
    expect(isPublicClientPath("/app/sitio-web")).toBe(true);
    expect(isPublicClientPath("/app/crear")).toBe(false);
  });
});
