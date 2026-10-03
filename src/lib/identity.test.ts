import { describe, expect, it } from "vitest";
import { isAdult, validateIdentityData } from "./identity";

describe("identidad", () => {
  const today = new Date(2026, 9, 2);
  it("calcula la mayoría de edad al día", () => {
    expect(isAdult("2008-10-02", today)).toBe(true);
    expect(isAdult("2008-10-03", today)).toBe(false);
    expect(isAdult("1990-02-30", today)).toBe(false);
    expect(isAdult("no-es-fecha", today)).toBe(false);
  });
  it("valida nombre, DNI y edad", () => {
    expect(validateIdentityData("Juan Perez", "12345678", "1990-01-01")).toBeNull();
    expect(validateIdentityData("Juan", "12345678", "1990-01-01")).toContain("nombre y apellido");
    expect(validateIdentityData("Juan Perez", "123", "1990-01-01")).toContain("DNI");
    expect(validateIdentityData("Juan Perez", "12.345.678", "1990-01-01")).toBeNull();
    expect(validateIdentityData("Juan Perez", "12345678", "2020-01-01")).toContain("mayor");
  });
});
