import { describe, expect, it } from "vitest";
import { diaDeSemana, duracionTexto, hhmm, horaLocal, hoyLocal, sumarDias, tramosValidos } from "./bookings";

describe("fechas en horario de Argentina", () => {
  it("la hora se muestra en Argentina aunque el navegador esté en otra zona", () => {
    expect(horaLocal("2026-10-06T13:00:00Z")).toBe("10:00"); // UTC-3
    expect(horaLocal("2026-10-06T02:30:00Z")).toBe("23:30"); // el día anterior en Argentina
  });
  it("hoyLocal usa el día de Argentina", () => {
    expect(hoyLocal(new Date("2026-10-06T01:00:00Z"))).toBe("2026-10-05");
    expect(hoyLocal(new Date("2026-10-06T12:00:00Z"))).toBe("2026-10-06");
  });
  it("sumar días y día de la semana", () => {
    expect(sumarDias("2026-10-31", 1)).toBe("2026-11-01");
    expect(sumarDias("2026-03-01", -1)).toBe("2026-02-28");
    expect(diaDeSemana("2026-10-05")).toBe(1); // lunes
    expect(diaDeSemana("2026-10-04")).toBe(0); // domingo
  });
  it("formatos cortos", () => {
    expect(hhmm("09:00:00")).toBe("09:00");
    expect(duracionTexto(30)).toBe("30 min");
    expect(duracionTexto(60)).toBe("1 h");
    expect(duracionTexto(90)).toBe("1 h 30 min");
  });
});

describe("tramos de agenda", () => {
  it("acepta tramos separados y de días distintos", () => {
    expect(tramosValidos([{ dia_semana: 1, desde: "09:00", hasta: "13:00" }, { dia_semana: 1, desde: "15:00", hasta: "19:00" }, { dia_semana: 2, desde: "09:00", hasta: "12:00" }])).toBeNull();
  });
  it("rechaza inicio posterior al fin", () => {
    expect(tramosValidos([{ dia_semana: 3, desde: "18:00", hasta: "09:00" }])).toMatch(/Miércoles/);
  });
  it("rechaza tramos que se pisan en un mismo día", () => {
    expect(tramosValidos([{ dia_semana: 5, desde: "09:00", hasta: "13:00" }, { dia_semana: 5, desde: "12:00", hasta: "16:00" }])).toMatch(/se pisan/);
  });
  it("tramos pegados no se pisan", () => {
    expect(tramosValidos([{ dia_semana: 5, desde: "09:00", hasta: "13:00" }, { dia_semana: 5, desde: "13:00", hasta: "16:00" }])).toBeNull();
  });
});

import { googleCalendarUrl, icsDeTurno } from "./bookings";
describe("calendario", () => {
  const t = { id: "abc", inicio: "2026-10-06T13:00:00Z", fin: "2026-10-06T13:30:00Z", servicio: "Corte, barba", comercio: "Peluquería; Centro", direccion: "Calle 1", profesional: "Ana" };
  it(".ics con fechas en UTC y texto escapado", () => {
    const ics = icsDeTurno(t);
    expect(ics).toContain("DTSTART:20261006T130000Z");
    expect(ics).toContain("DTEND:20261006T133000Z");
    expect(ics).toContain("SUMMARY:Corte\\, barba · Peluquería\\; Centro");
    expect(ics.split("\r\n")[0]).toBe("BEGIN:VCALENDAR");
  });
  it("enlace de Google Calendar", () => {
    const url = googleCalendarUrl(t);
    expect(url).toContain("calendar.google.com");
    expect(url).toContain("dates=20261006T130000Z%2F20261006T133000Z");
  });
});

import { isoALocal, localAIso } from "./bookings";
describe("campos de fecha y hora", () => {
  it("ida y vuelta en horario de Argentina", () => {
    expect(localAIso("2026-10-06T10:30")).toBe("2026-10-06T10:30:00-03:00");
    expect(new Date(localAIso("2026-10-06T10:30")).toISOString()).toBe("2026-10-06T13:30:00.000Z");
    expect(isoALocal("2026-10-06T13:30:00Z")).toBe("2026-10-06T10:30");
  });
  it("vacío sigue vacío", () => { expect(localAIso("")).toBe(""); });
});
