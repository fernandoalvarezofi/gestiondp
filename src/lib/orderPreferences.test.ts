import { describe, expect, it } from "vitest";
import { deliveryNote, initialPayment } from "./orderPreferences";

describe("preferencias de pedido", () => {
  it("elige el pago inicial", () => {
    expect(initialPayment("auto", true)).toBe("mercadopago");
    expect(initialPayment("auto", false)).toBe("efectivo");
    expect(initialPayment("efectivo", true)).toBe("efectivo");
    expect(initialPayment("mercadopago", false)).toBe("efectivo");
  });
  it("arma la nota de entrega", () => {
    expect(deliveryNote({ entrega_sin_contacto: false, entrega_instrucciones: null })).toBe("");
    expect(deliveryNote({ entrega_sin_contacto: true, entrega_instrucciones: " Timbre 2B " })).toBe("Entrega sin contacto: dejar en la puerta y avisar. Timbre 2B");
  });
});
