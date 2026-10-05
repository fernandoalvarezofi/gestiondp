import { describe, expect, it } from "vitest";
import { firmar, leerCabecera, verificarFirma } from "../../supabase/functions/_shared/pagos/firma";

const secreto = "clave-secreta-de-prueba-123";
const ahora = 1_800_000_000_000;

async function cabecera(dataId: string, requestId: string, ts = String(ahora)) {
  return `ts=${ts},v1=${await firmar(secreto, dataId, requestId, ts)}`;
}

describe("firma de notificaciones de Mercado Pago", () => {
  it("acepta una firma correcta (el id se compara en minúsculas)", async () => {
    const r = await verificarFirma({ secreto, xSignature: await cabecera("ABC123", "req-1"), xRequestId: "req-1", dataId: "ABC123", ahora });
    expect(r).toBe("ok");
  });
  it("rechaza si cambia el id, el request-id o el secreto", async () => {
    const x = await cabecera("111", "req-1");
    expect(await verificarFirma({ secreto, xSignature: x, xRequestId: "req-1", dataId: "222", ahora })).toBe("invalida");
    expect(await verificarFirma({ secreto, xSignature: x, xRequestId: "req-2", dataId: "111", ahora })).toBe("invalida");
    expect(await verificarFirma({ secreto: "otra-clave-distinta-123", xSignature: x, xRequestId: "req-1", dataId: "111", ahora })).toBe("invalida");
  });
  it("marca ausente si falta la cabecera o el request-id", async () => {
    expect(await verificarFirma({ secreto, xSignature: null, xRequestId: "r", dataId: "1", ahora })).toBe("ausente");
    expect(await verificarFirma({ secreto, xSignature: "basura", xRequestId: "r", dataId: "1", ahora })).toBe("ausente");
    expect(await verificarFirma({ secreto, xSignature: await cabecera("1", "r"), xRequestId: null, dataId: "1", ahora })).toBe("ausente");
  });
  it("rechaza avisos viejos (repetición)", async () => {
    const viejo = String(ahora - 3_600_000);
    expect(await verificarFirma({ secreto, xSignature: await cabecera("1", "r", viejo), xRequestId: "r", dataId: "1", ahora })).toBe("vencida");
  });
  it("lee la cabecera con espacios", () => {
    expect(leerCabecera("ts=10, v1=abc")).toEqual({ ts: "10", v1: "abc" });
  });
});
