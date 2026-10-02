import { describe, expect, it } from "vitest";
import { passwordStrength } from "./password";

describe("passwordStrength", () => {
  it("rechaza las muy cortas y las muy comunes", () => {
    expect(passwordStrength("abc123").score).toBe(0);
    expect(passwordStrength("password99").score).toBe(1);
    expect(passwordStrength("aaaaaaaaaa").score).toBe(1);
  });
  it("puntúa por variedad y largo", () => {
    expect(passwordStrength("casitaroja").score).toBe(2);
    expect(passwordStrength("Casita2026").score).toBe(3);
    expect(passwordStrength("Casita-Roja-2026!").score).toBe(4);
  });
  it("devuelve vacío sin texto", () => {
    expect(passwordStrength("").label).toBe("");
  });
});
