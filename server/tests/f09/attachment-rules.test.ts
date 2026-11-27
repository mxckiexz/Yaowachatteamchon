import { describe, expect, it } from "vitest";
import { checkFile, parseFileName } from "../../src/attachmentRules.js";

describe("F-09 attachment rules", () => {
  it("TEST-152 / AC-121 (unit): the file name header is decoded, trimmed and checked", () => {
    expect(parseFileName(encodeURIComponent("  quote.pdf  "))).toBe("quote.pdf");
    expect(parseFileName(encodeURIComponent("ใบเสนอราคา.pdf"))).toBe("ใบเสนอราคา.pdf");
    expect(parseFileName(`${"a".repeat(96)}.pdf`)).toHaveLength(100);
    for (const bad of [undefined, "", "%", "%E0%A4%A", "%20%20", `${"a".repeat(97)}.pdf`, "a%2Fb.pdf", "a%5Cb.pdf", "a%00.pdf", "a%7F.pdf", "é.pdf"]) {
      expect(parseFileName(bad), String(bad)).toBeNull();
    }
  });

  it("TEST-150 / AC-119 (unit): the content must match the extension", () => {
    const pdfBytes = Buffer.from("%PDF-1.7");
    expect(checkFile("a.PDF", pdfBytes)).toBe("application/pdf");
    expect(checkFile("a.png", pdfBytes)).toBeNull();
    expect(checkFile("a.exe", pdfBytes)).toBeNull();
    expect(checkFile("pdf", pdfBytes)).toBeNull();
    expect(checkFile("a.pdf", Buffer.from("%PDF"))).toBeNull();
  });
});
