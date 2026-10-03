import { describe, expect, it } from "vitest";
import { isSixDigits } from "./mfa";

describe("2FA", () => {
  it("acepta solo códigos de 6 números", () => {
    expect(isSixDigits("123456")).toBe(true);
    expect(isSixDigits("123 456")).toBe(true);
    expect(isSixDigits("12345")).toBe(false);
    expect(isSixDigits("12345a")).toBe(false);
    expect(isSixDigits("")).toBe(false);
  });
});
