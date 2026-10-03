import { describe, expect, it } from "vitest";
import { formatOsmHours, normalize, phoneLink } from "./directorio";

describe("directorio", () => {
  it("traduce horarios de OpenStreetMap", () => {
    expect(formatOsmHours("Mo-Sa 08:00-20:00")).toBe("Lun-Sáb 08:00-20:00");
    expect(formatOsmHours("Mo-Sa 10:00-12:30, 16:30-21:30; Su off")).toBe("Lun-Sáb 10:00-12:30, 16:30-21:30 · Dom cerrado");
    expect(formatOsmHours(null)).toBeNull();
  });
  it("busca sin tildes ni mayúsculas", () => {
    expect(normalize("Panadería ÉL Maestro")).toBe("panaderia el maestro");
  });
  it("arma el enlace de llamada", () => {
    expect(phoneLink("+54 2355 42 2091")).toBe("tel:+542355422091");
  });
});
