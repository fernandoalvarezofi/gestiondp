import { describe, expect, it } from "vitest";
import { hace, rutaSegura } from "./notifications";

describe("rutaSegura", () => {
  it("acepta rutas internas", () => { expect(rutaSegura("/app/pedidos/abc?chat=comercio")).toBe("/app/pedidos/abc?chat=comercio"); expect(rutaSegura("/")).toBe("/"); });
  it("rechaza enlaces externos y protocolos", () => {
    for (const bad of ["https://malo.example", "//malo.example", "javascript:alert(1)", "app/x", "", null, undefined, "/x y", "/<script>"]) expect(rutaSegura(bad as string | null)).toBeNull();
  });
});
describe("hace", () => {
  const ahora = new Date("2026-10-10T12:00:00Z").getTime();
  it("formatea tiempos relativos", () => {
    expect(hace("2026-10-10T11:59:50Z", ahora)).toBe("ahora");
    expect(hace("2026-10-10T11:55:00Z", ahora)).toBe("hace 5 min");
    expect(hace("2026-10-10T09:00:00Z", ahora)).toBe("hace 3 h");
    expect(hace("2026-10-09T09:00:00Z", ahora)).toBe("ayer");
  });
});
