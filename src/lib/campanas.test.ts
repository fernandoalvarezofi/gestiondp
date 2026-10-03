import { describe, expect, it } from "vitest";
import { segmentLabel, validateCampaign } from "./campanas";

describe("campañas", () => {
  it("valida título y mensaje", () => {
    expect(validateCampaign("20% hoy", "Pedí hoy y ahorrá en tu pedido")).toBeNull();
    expect(validateCampaign("ab", "Mensaje válido")).toContain("título");
    expect(validateCampaign("Oferta", "abc")).toContain("mensaje");
    expect(validateCampaign("Oferta", "Entrá a https://malo.com ahora")).toContain("enlaces");
    expect(validateCampaign("Visitá www.sitio", "Mensaje válido")).toContain("enlaces");
    expect(validateCampaign("x".repeat(51), "Mensaje válido")).toContain("título");
  });
  it("nombra los grupos", () => {
    expect(segmentLabel("inactivos")).toBe("Hace tiempo que no piden");
    expect(segmentLabel("repartidores")).toBe("Repartidores y conductores");
  });
});
