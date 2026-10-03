import { describe, expect, it } from "vitest";
import { walletApplied } from "./wallet";

describe("billetera", () => {
  it("usa el saldo sin pasarse del total", () => {
    expect(walletApplied(500, 2000)).toBe(500);
    expect(walletApplied(5000, 2000)).toBe(2000);
    expect(walletApplied(0, 2000)).toBe(0);
    expect(walletApplied(-10, 2000)).toBe(0);
  });
});
