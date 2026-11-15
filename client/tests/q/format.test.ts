import { describe, expect, it } from "vitest";
import { formatBaht } from "../../src/format";
import { estimateTotal } from "../../src/NewRequest";

const row = (quantity: string, unitPrice: string, key = 1) => ({ key, name: "x", quantity, unitPrice });

describe("client helpers (unit)", () => {
  it("TEST-63 / AC-48: formatBaht always shows two decimals and a thousands separator", () => {
    expect(formatBaht(261)).toBe("฿261.00");
    expect(formatBaht(0.5)).toBe("฿0.50");
    expect(formatBaht(1000000)).toBe("฿1,000,000.00");
    expect(formatBaht(0)).toBe("฿0.00");
  });

  it("TEST-63 / AC-48: the estimate sums quantity times price and skips rows that are not numbers", () => {
    expect(estimateTotal([row("2", "100.50", 1), row("3", "20", 2)])).toBe(261);
    expect(estimateTotal([row("2", "10", 1), row("abc", "5", 2), row("1", "", 3)])).toBe(20);
    expect(estimateTotal([])).toBe(0);
  });
});
