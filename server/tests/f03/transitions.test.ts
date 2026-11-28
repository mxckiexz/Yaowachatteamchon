import { describe, expect, it } from "vitest";
import { canTransition } from "../../src/transitions.js";

const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"];

describe("F-03 status transitions (unit)", () => {
  it("TEST-46 / AC-31: only DRAFT to SUBMITTED, SUBMITTED to APPROVED and SUBMITTED to REJECTED are allowed", () => {
    const allowed: string[] = [];
    for (const from of STATUSES) for (const to of STATUSES) if (canTransition(from, to)) allowed.push(`${from}>${to}`);
    expect(allowed.sort()).toEqual(["DRAFT>SUBMITTED", "SUBMITTED>APPROVED", "SUBMITTED>REJECTED"]);
  });
});
