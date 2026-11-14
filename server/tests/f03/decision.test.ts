import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent } from "../helpers/fixtures.js";
import { createDraft, createPending, decide } from "../helpers/requests.js";

const EMP = "f03-emp@test.local";
const APP_A = "f03-appa@test.local";
const APP_B = "f03-appb@test.local";
const APP_SELF = "f03-self@test.local";
const ALL = [EMP, APP_A, APP_B, APP_SELF];
let ids: Record<string, number> = {};

beforeAll(async () => {
  ids[EMP] = (await createUser(EMP, { role: "EMPLOYEE" })).id;
  ids[APP_A] = (await createUser(APP_A, { role: "APPROVER", name: "Somchai" })).id;
  ids[APP_B] = (await createUser(APP_B, { role: "APPROVER", name: "Malee" })).id;
  ids[APP_SELF] = (await createUser(APP_SELF, { role: "APPROVER" })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

async function pendingFor(approver: string) {
  const owner = await loginAgent(EMP);
  return createPending(owner, ids[approver]);
}
async function load(id: number) {
  return getPrisma().purchaseRequest.findUniqueOrThrow({ where: { id }, include: { history: { orderBy: { id: "asc" } } } });
}

describe("F-03 approver decision", () => {
  it("TEST-25 / AC-19, AC-26: the assigned approver approves and one history row is written", async () => {
    const request = await pendingFor(APP_A);
    const approver = await loginAgent(APP_A);
    const res = await decide(approver, request.id, "APPROVED", "OK");
    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ status: "APPROVED", decisionComment: "OK" });
    const row = await load(request.id);
    expect(row.status).toBe("APPROVED");
    expect(row.decidedAt).not.toBeNull();
    expect(row.history.map((h) => h.action)).toEqual(["CREATED", "SUBMITTED", "APPROVED"]);
    expect(row.history[2]).toMatchObject({ actorId: ids[APP_A], fromStatus: "PENDING", toStatus: "APPROVED", comment: "OK" });
  });

  it("TEST-26 / AC-20, AC-26: the assigned approver rejects with a reason", async () => {
    const request = await pendingFor(APP_A);
    const approver = await loginAgent(APP_A);
    const res = await decide(approver, request.id, "REJECTED", "Over budget");
    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ status: "REJECTED", decisionComment: "Over budget" });
    const row = await load(request.id);
    expect(row.history).toHaveLength(3);
    expect(row.history[2]).toMatchObject({ action: "REJECTED", fromStatus: "PENDING", toStatus: "REJECTED", comment: "Over budget" });
  });

  it("TEST-27 / AC-20: a rejection needs a reason of at least 5 characters", async () => {
    const request = await pendingFor(APP_A);
    const approver = await loginAgent(APP_A);
    for (const comment of [undefined, "", "abcd", "    "]) {
      const res = await decide(approver, request.id, "REJECTED", comment);
      expect(res.status, `comment ${String(comment)}`).toBe(422);
      expect(res.body.code).toBe("REASON_REQUIRED");
      expect((await load(request.id)).status).toBe("PENDING");
    }
    const ok = await decide(approver, request.id, "REJECTED", "abcde");
    expect(ok.status).toBe(200);
    expect(ok.body.request.status).toBe("REJECTED");
  });

  it("TEST-28 / AC-21: an employee cannot use the decision route", async () => {
    const request = await pendingFor(APP_A);
    const employee = await loginAgent(EMP);
    const res = await decide(employee, request.id, "APPROVED", "I approve myself");
    expect(res.status).toBe(403);
    const row = await load(request.id);
    expect(row.status).toBe("PENDING");
    expect(row.history).toHaveLength(2);
  });

  it("TEST-29 / AC-22: an approver who is not assigned cannot decide", async () => {
    const request = await pendingFor(APP_A);
    const other = await loginAgent(APP_B);
    const res = await decide(other, request.id, "APPROVED", "Looks fine");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("NOT_ASSIGNED");
    expect((await load(request.id)).status).toBe("PENDING");
  });

  it("TEST-30 / AC-23: a requester cannot decide their own request even with the APPROVER role", async () => {
    // The submit route refuses self-assignment (TEST-19), so this state is created directly in the database.
    const prisma = getPrisma();
    const row = await prisma.purchaseRequest.create({
      data: {
        requesterId: ids[APP_SELF],
        approverId: ids[APP_SELF],
        title: "Self assigned",
        status: "PENDING",
        totalSatang: 1000,
        submittedAt: new Date(),
        items: { create: [{ name: "Pen", quantity: 1, unitPriceSatang: 1000 }] },
      },
    });
    const self = await loginAgent(APP_SELF);
    const res = await decide(self, row.id, "APPROVED", "Approved by me");
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("SELF_APPROVAL");
    expect((await load(row.id)).status).toBe("PENDING");
  });

  it("TEST-31 / AC-24: a decided request cannot be decided again", async () => {
    const request = await pendingFor(APP_A);
    const approver = await loginAgent(APP_A);
    expect((await decide(approver, request.id, "APPROVED", "OK")).status).toBe(200);
    const again = await decide(approver, request.id, "REJECTED", "Changed my mind");
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("ILLEGAL_TRANSITION");
    const row = await load(request.id);
    expect(row.status).toBe("APPROVED");
    expect(row.history).toHaveLength(3);
  });

  it("TEST-32 / AC-24: a DRAFT cannot be decided", async () => {
    const owner = await loginAgent(EMP);
    const draft = await createDraft(owner);
    const approver = await loginAgent(APP_A);
    const res = await decide(approver, draft.id, "APPROVED", "OK");
    expect([403, 409]).toContain(res.status);
    const row = await load(draft.id);
    expect(row.status).toBe("DRAFT");
    expect(row.history).toHaveLength(1);
  });

  it("TEST-33 / AC-25: two simultaneous decisions produce exactly one decision", async () => {
    const request = await pendingFor(APP_A);
    const first = await loginAgent(APP_A);
    const second = await loginAgent(APP_A);
    const [a, b] = await Promise.all([
      decide(first, request.id, "APPROVED", "Go ahead"),
      decide(second, request.id, "REJECTED", "No thanks"),
    ]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = a.status === 200 ? a : b;
    const row = await load(request.id);
    expect(row.status).toBe(winner.body.request.status);
    expect(row.history.filter((h) => h.action === "APPROVED" || h.action === "REJECTED")).toHaveLength(1);
  });

  it("an unknown decision value is rejected", async () => {
    const request = await pendingFor(APP_A);
    const approver = await loginAgent(APP_A);
    const res = await decide(approver, request.id, "MAYBE", "hmm hmm");
    expect(res.status).toBe(422);
    expect((await load(request.id)).status).toBe("PENDING");
  });
});
