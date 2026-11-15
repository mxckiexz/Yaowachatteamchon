import { describe, expect, it } from "vitest";
import { bahtToSatang, calculateTotalSatang } from "../../src/money.js";
import { validateRequestInput } from "../../src/validation.js";

const base = { itemName: "Pen", description: "Blue pens", quantity: 1, unitPrice: 10 };
const ok = (over: Record<string, unknown> = {}) => validateRequestInput({ ...base, ...over }).ok;

describe("F-02 money helpers (unit)", () => {
  it("TEST-17 / AC-13: the total is the exact product in satang (0.1 baht x 3 = 30 satang)", () => {
    expect(calculateTotalSatang(3, bahtToSatang(0.1)!)).toBe(30);
    expect(calculateTotalSatang(2, 10050)).toBe(20100);
    expect(calculateTotalSatang(1000, 100000000)).toBe(100000000000);
  });

  it("TEST-33 / AC-13, AC-14: bahtToSatang accepts numbers and numeric strings with at most 2 decimals", () => {
    expect(bahtToSatang(250.5)).toBe(25050);
    expect(bahtToSatang("12")).toBe(1200);
    expect(bahtToSatang(0.01)).toBe(1);
    expect(bahtToSatang(10.505)).toBeNull();
    expect(bahtToSatang("abc")).toBeNull();
    expect(bahtToSatang(Number.NaN)).toBeNull();
    expect(bahtToSatang(undefined)).toBeNull();
  });
});

describe("F-02 validation (unit)", () => {
  it("TEST-34 / AC-14: accepts exactly the valid boundaries and names every invalid field", () => {
    expect(ok()).toBe(true);
    expect(ok({ itemName: "x".repeat(100) })).toBe(true);
    expect(ok({ itemName: "x".repeat(101) })).toBe(false);
    expect(ok({ itemName: "   " })).toBe(false);
    expect(ok({ description: "" })).toBe(false);
    expect(ok({ description: "x".repeat(1000) })).toBe(true);
    expect(ok({ description: "x".repeat(1001) })).toBe(false);
    expect(ok({ quantity: 1 })).toBe(true);
    expect(ok({ quantity: 1000 })).toBe(true);
    expect(ok({ quantity: 0 })).toBe(false);
    expect(ok({ quantity: 1001 })).toBe(false);
    expect(ok({ quantity: 2.5 })).toBe(false);
    expect(ok({ unitPrice: 0.01 })).toBe(true);
    expect(ok({ unitPrice: 1000000 })).toBe(true);
    expect(ok({ unitPrice: 0 })).toBe(false);
    expect(ok({ unitPrice: 1000000.01 })).toBe(false);
    expect(ok({ unitPrice: 10.505 })).toBe(false);
    expect(ok({ category: "EQUIPMENT" })).toBe(true);
    expect(ok({ category: "FOOD" })).toBe(false);
    expect(ok({ category: "equipment" })).toBe(false);
    expect(ok({ reason: "x".repeat(500) })).toBe(true);
    expect(ok({ reason: "x".repeat(501) })).toBe(false);

    const bad = validateRequestInput({ itemName: "", description: "", quantity: 0, unitPrice: -1, category: "X", reason: "y".repeat(501) });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fields).sort()).toEqual(["category", "description", "itemName", "quantity", "reason", "unitPrice"]);
  });

  it("trims text, treats an empty category as none, and never reads a total sent by the client", () => {
    const result = validateRequestInput({ ...base, itemName: "  Pen  ", category: "", total: 1, totalSatang: 1 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.itemName).toBe("Pen");
      expect(result.value.category).toBeNull();
      expect(JSON.stringify(result.value)).not.toContain("total");
    }
  });
});
