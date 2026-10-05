import { describe, expect, it } from "vitest";
import { estaAtrasado, UMBRAL_SIN_ASIGNAR_MIN } from "./jobs";

describe("trabajos atrasados", () => {
  it("solo los pendientes que llevan mucho sin asignar", () => {
    expect(estaAtrasado({ estado: "pendiente", minutos_sin_asignar: UMBRAL_SIN_ASIGNAR_MIN })).toBe(true);
    expect(estaAtrasado({ estado: "pendiente", minutos_sin_asignar: UMBRAL_SIN_ASIGNAR_MIN - 1 })).toBe(false);
    expect(estaAtrasado({ estado: "pendiente", minutos_sin_asignar: null })).toBe(false);
    expect(estaAtrasado({ estado: "asignado", minutos_sin_asignar: 99 })).toBe(false);
  });
});
