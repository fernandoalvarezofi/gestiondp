import { describe, expect, it } from "vitest";
import { contextFromPath, contextsFor } from "./contexts";
import { isPublicClientPath } from "./guards";
import { ADMIN_SECTIONS, adminNav, CLIENT_TABS, merchantNav, merchantSectionPermission, merchantTabs } from "./menus";
import type { Permission } from "@/pages/delivery/merchant/context";

const cliente = { isAdmin: false, isCourier: false, isDriver: false, storeId: null };

describe("contextos", () => {
  it("cada ruta pertenece a un solo contexto", () => {
    expect(contextFromPath("/app")).toBe("cliente");
    expect(contextFromPath("/app/pedidos/abc")).toBe("cliente");
    expect(contextFromPath("/app/comercio/menu")).toBe("comercio");
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
    expect(items).not.toContain("/app/comercio/menu");
    expect(merchantTabs(operador)).toEqual(["/app/comercio", "/app/comercio/pedidos"]);
    expect(merchantSectionPermission("finanzas")).toBe("finanzas");
    expect(merchantSectionPermission("nuevo")).toBe("equipo");
  });

  it("cada sección de administración aparece una sola vez en el menú", () => {
    const ids = ADMIN_SECTIONS.map((s) => s.id);
    expect(new Set(ids).size).toBe(ids.length);
    const tos = adminNav({}).flatMap((g) => g.items.map((i) => i.to));
    expect(tos).toHaveLength(ids.length);
    expect(tos[0]).toBe("/app/admin");
  });
});
