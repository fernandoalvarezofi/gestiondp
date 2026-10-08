import { beforeEach, describe, expect, it } from "vitest";
import { consiente, guardarConsentimiento, leerConsentimiento, VERSION_COOKIES } from "./cookies";

describe("consentimiento de cookies", () => {
  beforeEach(() => { window.localStorage.clear(); window.sessionStorage.clear(); });

  it("sin elegir, lo opcional queda apagado", () => {
    expect(leerConsentimiento()).toBeNull();
    expect(consiente("preferencias")).toBe(false);
    expect(consiente("medicion")).toBe(false);
  });

  it("guarda la elección con versión y fecha", () => {
    guardarConsentimiento({ preferencias: true, medicion: false }, new Date("2026-10-08T12:00:00Z"));
    expect(leerConsentimiento()).toEqual({ version: VERSION_COOKIES, preferencias: true, medicion: false, fecha: "2026-10-08T12:00:00.000Z" });
    expect(consiente("preferencias")).toBe(true);
    expect(consiente("medicion")).toBe(false);
  });

  it("al rechazar una categoría borra lo que tenía guardado", () => {
    window.localStorage.setItem("woref-fav-productos", "[\"p1\"]");
    window.localStorage.setItem("woref-origen-tienda", "{}");
    window.sessionStorage.setItem("woref-visita-pizzeria", "1");
    window.localStorage.setItem("woref-delivery-cart", "{}");
    guardarConsentimiento({ preferencias: false, medicion: false });
    expect(window.localStorage.getItem("woref-fav-productos")).toBeNull();
    expect(window.localStorage.getItem("woref-origen-tienda")).toBeNull();
    expect(window.sessionStorage.getItem("woref-visita-pizzeria")).toBeNull();
    // Lo necesario (el carrito) no se toca.
    expect(window.localStorage.getItem("woref-delivery-cart")).toBe("{}");
  });

  it("una versión vieja del consentimiento se vuelve a preguntar", () => {
    window.localStorage.setItem("woref-cookies", JSON.stringify({ version: 0, preferencias: true, medicion: true, fecha: "x" }));
    expect(leerConsentimiento()).toBeNull();
  });
});
