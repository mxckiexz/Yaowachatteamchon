import { describe, expect, it } from "vitest";
import { canTransition } from "../../src/transitions.js";

const STATUSES = ["DRAFT", "PENDING", "APPROVED", "REJECTED"];

describe("F-03 status transitions (unit)", () => {
  it("TEST-34 / BR-01: only DRAFT to PENDING, PENDING to APPROVED and PENDING to REJECTED are allowed", () => {
    const allowed: string[] = [];
    for (const from of STATUSES) for (const to of STATUSES) if (canTransition(from, to)) allowed.push(`${from}>${to}`);
    expect(allowed.sort()).toEqual(["DRAFT>PENDING", "PENDING>APPROVED", "PENDING>REJECTED"]);
  });
});
