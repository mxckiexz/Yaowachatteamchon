import { describe, expect, it } from "vitest";
import { validateRequestInput } from "../../src/validation.js";

const item = (over: Record<string, unknown> = {}) => ({ name: "Pen", quantity: 1, unitPrice: 10, ...over });
const body = (over: Record<string, unknown> = {}) => ({ title: "Office pens", items: [item()], ...over });

describe("BR-02 validation (unit)", () => {
  it("TEST-62 / AC-47: accepts exactly the valid boundaries and names every invalid field", () => {
    const ok = (b: unknown) => validateRequestInput(b).ok;
    expect(ok(body())).toBe(true);
    expect(ok(body({ title: "abc" }))).toBe(true);
    expect(ok(body({ title: "x".repeat(120) }))).toBe(true);
    expect(ok(body({ title: "ab" }))).toBe(false);
    expect(ok(body({ title: "x".repeat(121) }))).toBe(false);
    expect(ok(body({ items: [item({ quantity: 1 })] }))).toBe(true);
    expect(ok(body({ items: [item({ quantity: 1000 })] }))).toBe(true);
    expect(ok(body({ items: [item({ quantity: 0 })] }))).toBe(false);
    expect(ok(body({ items: [item({ quantity: 1001 })] }))).toBe(false);
    expect(ok(body({ items: [item({ quantity: 2.5 })] }))).toBe(false);
    expect(ok(body({ items: [item({ unitPrice: 0.01 })] }))).toBe(true);
    expect(ok(body({ items: [item({ unitPrice: 1000000 })] }))).toBe(true);
    expect(ok(body({ items: [item({ unitPrice: 0 })] }))).toBe(false);
    expect(ok(body({ items: [item({ unitPrice: 1000000.01 })] }))).toBe(false);
    expect(ok(body({ items: [item({ unitPrice: 10.505 })] }))).toBe(false);
    expect(ok(body({ items: [] }))).toBe(false);
    expect(ok(body({ items: Array.from({ length: 51 }, () => item()) }))).toBe(false);
    expect(ok(body({ items: Array.from({ length: 50 }, () => item()) }))).toBe(true);

    const bad = validateRequestInput({ title: "a", items: [item({ name: "", quantity: 0, unitPrice: -1 })] });
    expect(bad.ok).toBe(false);
    if (!bad.ok) expect(Object.keys(bad.fields).sort()).toEqual(["items.0.name", "items.0.quantity", "items.0.unitPrice", "title"]);
  });

  it("trims text and never reads a total sent by the client", () => {
    const result = validateRequestInput({ title: "  Office pens  ", total: 1, totalSatang: 1, items: [item({ name: "  Pen  " })] });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.title).toBe("Office pens");
      expect(result.value.items[0].name).toBe("Pen");
      expect(JSON.stringify(result.value)).not.toContain("total");
    }
  });
});
