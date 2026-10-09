import { describe, expect, it } from "vitest";
import { estadoOperativo } from "./delivery";

const base = { esta_abierto: true, horarios: null, pausado_hasta: null, aprobado: true, activo: true };
const enUnaHora = () => new Date(Date.now() + 60 * 60 * 1000).toISOString();

describe("estadoOperativo", () => {
  it("un local sin aprobar no está recibiendo pedidos aunque esté abierto", () => {
    const e = estadoOperativo({ ...base, aprobado: false });
    expect(e.clave).toBe("revision");
    expect(e.recibe).toBe(false);
  });

  it("la suspensión de administración pesa más que el estado abierto", () => {
    expect(estadoOperativo({ ...base, activo: false }).clave).toBe("suspendido");
  });

  it("cerrado a mano y en pausa no reciben pedidos", () => {
    expect(estadoOperativo({ ...base, esta_abierto: false })).toMatchObject({ clave: "cerrado", recibe: false });
    expect(estadoOperativo({ ...base, pausado_hasta: enUnaHora() })).toMatchObject({ clave: "pausa", recibe: false });
  });

  it("fuera de horario no recibe pedidos", () => {
    // Horario vacío para todos los días: siempre fuera de horario.
    const horarios = { "0": [], "1": [], "2": [], "3": [], "4": [], "5": [], "6": [] };
    expect(estadoOperativo({ ...base, horarios }).clave).toBe("fuera_horario");
  });

  it("aprobado, activo, abierto y sin pausa: recibiendo pedidos", () => {
    expect(estadoOperativo(base)).toMatchObject({ clave: "abierto", recibe: true });
  });
});
