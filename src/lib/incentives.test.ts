import { describe, expect, it } from "vitest";
import { goalPercent, goalWindow, shiftDayLabel } from "./incentives";

describe("incentivos", () => {
  it("calcula el avance con tope en 100", () => {
    expect(goalPercent(3, 10)).toBe(30);
    expect(goalPercent(12, 10)).toBe(100);
    expect(goalPercent(0, 0)).toBe(0);
  });
  it("describe la franja de una meta", () => {
    expect(goalWindow({ hora_desde: "20:00", hora_hasta: "23:00" })).toBe("de 20:00 a 23:00");
    expect(goalWindow({ hora_desde: null, hora_hasta: null })).toBe("todo el día");
  });
  it("nombra hoy y mañana", () => {
    const now = new Date("2026-10-03T15:00:00Z");
    expect(shiftDayLabel("2026-10-03", now)).toBe("Hoy");
    expect(shiftDayLabel("2026-10-04", now)).toBe("Mañana");
    expect(shiftDayLabel("2026-10-07", now)).toContain("7");
  });
});
