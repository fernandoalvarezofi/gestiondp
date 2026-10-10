import { describe, expect, it, vi } from "vitest";
import { cookiesDecididas, EVENTO_DECIDIDO, guardarConsentimiento } from "./cookies";

describe("orden de avisos: cookies antes que ubicación", () => {
  it("avisa cuando la persona elige y queda decidido", () => {
    window.localStorage.clear();
    expect(cookiesDecididas()).toBe(false);
    const escucha = vi.fn();
    window.addEventListener(EVENTO_DECIDIDO, escucha);
    guardarConsentimiento({ preferencias: false, medicion: false });
    window.removeEventListener(EVENTO_DECIDIDO, escucha);
    expect(escucha).toHaveBeenCalledTimes(1);
    expect(cookiesDecididas()).toBe(true);
  });
});
