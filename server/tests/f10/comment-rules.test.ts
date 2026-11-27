import { describe, expect, it } from "vitest";
import { parseCommentText } from "../../src/commentRules.js";

describe("F-10 comment text rules", () => {
  it("TEST-175 / AC-144 (unit): returns the trimmed text, or null when it is not allowed", () => {
    for (const bad of [undefined, null, 5, ["a"], { text: "a" }, "", " \n\t ", "a".repeat(1001), "a\u0000b", "😀".repeat(501)]) {
      expect(parseCommentText(bad), JSON.stringify(bad)?.slice(0, 30)).toBeNull();
    }
    expect(parseCommentText("a")).toBe("a");
    expect(parseCommentText("a".repeat(1000))).toBe("a".repeat(1000));
    expect(parseCommentText(`  ${"a".repeat(1000)}\n`)).toBe("a".repeat(1000));
    expect(parseCommentText(" two  spaces\nand a line ")).toBe("two  spaces\nand a line");
  });
});
