import { describe, expect, it } from "vitest";
import { minScheduleValue, validSchedule, viajeActivo } from "./remis";

describe("remises", () => {
  const now = new Date(2026, 9, 3, 12, 0);
  it("calcula la hora mínima para reservar", () => {
    expect(minScheduleValue(now)).toBe("2026-10-03T12:31");
  });
  it("valida reservas entre 30 minutos y 7 días", () => {
    expect(validSchedule("2026-10-03T12:10", now)).toBe(false);
    expect(validSchedule("2026-10-03T13:00", now)).toBe(true);
    expect(validSchedule("2026-10-20T13:00", now)).toBe(false);
    expect(validSchedule("", now)).toBe(false);
  });
  it("distingue viajes activos de cerrados", () => {
    expect(viajeActivo("a_bordo")).toBe(true);
    expect(viajeActivo("completado")).toBe(false);
    expect(viajeActivo("cancelado")).toBe(false);
  });
});
