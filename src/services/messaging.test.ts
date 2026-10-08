import { describe, expect, it } from "vitest";
import { linkUbicacion, MAX_MENSAJE, mensajeValido, respuestasRapidas } from "./messaging";

describe("mensajeValido", () => {
  it("acepta texto normal", () => expect(mensajeValido("Hola, ¿tienen stock?")).toBe(true));
  it("rechaza vacío o solo espacios", () => { expect(mensajeValido("")).toBe(false); expect(mensajeValido("   \n ")).toBe(false); });
  it("respeta el máximo", () => { expect(mensajeValido("a".repeat(MAX_MENSAJE))).toBe(true); expect(mensajeValido("a".repeat(MAX_MENSAJE + 1))).toBe(false); });
});

describe("respuestas rápidas", () => {
  it("dependen de quién escribe y a quién", () => {
    expect(respuestasRapidas("repartidor", "cliente_repartidor")).toContain("Llegué, estoy afuera");
    expect(respuestasRapidas("conductor", "pasajero_conductor")).toContain("¿Dónde te encuentro?");
    expect(respuestasRapidas("pasajero", "pasajero_conductor")).toContain("Ya salgo");
    expect(respuestasRapidas("comercio", "comercio_repartidor")).toContain("El pedido está listo");
  });
  it("administración no tiene respuestas rápidas (solo mira)", () => expect(respuestasRapidas("admin", "cliente_comercio")).toEqual([]));
});

describe("ubicación compartida", () => {
  it("arma el enlace al mapa", () => expect(linkUbicacion(-34.86, -61.53)).toBe("https://www.google.com/maps?q=-34.86,-61.53"));
});
