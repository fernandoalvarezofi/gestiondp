import { describe, expect, it } from "vitest";
import { MAX_MENSAJE, mensajeValido } from "./conversations";

describe("mensajeValido", () => {
  it("acepta texto normal", () => expect(mensajeValido("Hola, ¿tienen stock?")).toBe(true));
  it("rechaza vacío o solo espacios", () => { expect(mensajeValido("")).toBe(false); expect(mensajeValido("   \n ")).toBe(false); });
  it("respeta el máximo", () => { expect(mensajeValido("a".repeat(MAX_MENSAJE))).toBe(true); expect(mensajeValido("a".repeat(MAX_MENSAJE + 1))).toBe(false); });
});
