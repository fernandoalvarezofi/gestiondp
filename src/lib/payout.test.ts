import { describe, expect, it } from "vitest";
import { isValidAlias, isValidCbu, maskCbu } from "./payout";

describe("datos de cobro", () => {
  it("valida el CBU con sus dígitos verificadores", () => {
    expect(isValidCbu("0170099220000067797370")).toBe(true);
    expect(isValidCbu("0170 0992 2000 0067 7973 70")).toBe(true);
    expect(isValidCbu("0170099220000067797371")).toBe(false);
    expect(isValidCbu("0170099320000067797370")).toBe(false);
    expect(isValidCbu("123")).toBe(false);
  });
  it("valida el alias y enmascara el CBU", () => {
    expect(isValidAlias("woref.cobros")).toBe(true);
    expect(isValidAlias("ab")).toBe(false);
    expect(isValidAlias("con espacios aca")).toBe(false);
    expect(maskCbu("0170099220000067797370")).toBe("•••• •••• •••• •••• 7370");
  });
});
