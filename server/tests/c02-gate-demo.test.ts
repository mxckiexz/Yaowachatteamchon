import { describe, expect, it } from "vitest";

// C-02 evidence only. This test fails on purpose so that the ruleset on main blocks the merge. Never merge this branch.
describe("C-02 quality gate demonstration", () => {
  it("fails on purpose", () => {
    expect(1 + 1).toBe(3);
  });
});
