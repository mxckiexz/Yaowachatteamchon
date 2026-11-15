import { describe, expect, it } from "vitest";
import { formatBaht } from "../../src/format";
import { estimateTotal } from "../../src/RequestForm";

describe("client helpers (unit)", () => {
  it("TEST-92 / AC-57: formatBaht always shows two decimals and a thousands separator", () => {
    expect(formatBaht(261)).toBe("฿261.00");
    expect(formatBaht(0.5)).toBe("฿0.50");
    expect(formatBaht(1000000)).toBe("฿1,000,000.00");
    expect(formatBaht(0)).toBe("฿0.00");
  });

  it("TEST-92 / AC-57: the estimate is quantity times price, and 0 when a value is empty or not a number", () => {
    expect(estimateTotal("2", "100.50")).toBe(201);
    expect(estimateTotal("3", "20")).toBe(60);
    expect(estimateTotal("abc", "5")).toBe(0);
    expect(estimateTotal("1", "")).toBe(0);
    expect(estimateTotal("", "")).toBe(0);
  });
});
