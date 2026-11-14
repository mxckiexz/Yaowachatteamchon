import { describe, expect, it } from "vitest";
import { bahtToSatang, calculateTotalSatang } from "../../src/money.js";

describe("F-02 money helpers (unit)", () => {
  it("TEST-14 / AC-11: the total is the exact sum in satang (0.1 x 3 = 30 satang)", () => {
    expect(calculateTotalSatang([{ quantity: 3, unitPriceSatang: bahtToSatang(0.1)! }])).toBe(30);
    expect(
      calculateTotalSatang([
        { quantity: 2, unitPriceSatang: 10050 },
        { quantity: 3, unitPriceSatang: 2000 },
      ])
    ).toBe(26100);
    expect(calculateTotalSatang([])).toBe(0);
  });

  it("TEST-24 / AC-11, AC-12: bahtToSatang accepts numbers and numeric strings with at most 2 decimals", () => {
    expect(bahtToSatang(250.5)).toBe(25050);
    expect(bahtToSatang("12")).toBe(1200);
    expect(bahtToSatang(0.01)).toBe(1);
    expect(bahtToSatang(10.505)).toBeNull();
    expect(bahtToSatang("abc")).toBeNull();
    expect(bahtToSatang(Number.NaN)).toBeNull();
    expect(bahtToSatang(undefined)).toBeNull();
  });
});
