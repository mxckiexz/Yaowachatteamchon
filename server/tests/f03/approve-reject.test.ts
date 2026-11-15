import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent } from "../helpers/fixtures.js";
import { approve, createDraft, createSubmitted, loadRequest, reject } from "../helpers/requests.js";

const REQ = "f03-req@test.local";
const APP = "f03-app@test.local";
const APP2 = "f03-app2@test.local";
const ADM = "f03-adm@test.local";
const ALL = [REQ, APP, APP2, ADM];
let ids: Record<string, number> = {};

beforeAll(async () => {
  ids[REQ] = (await createUser(REQ, { role: "REQUESTER", name: "Ploy" })).id;
  ids[APP] = (await createUser(APP, { role: "APPROVER", name: "Somchai" })).id;
  ids[APP2] = (await createUser(APP2, { role: "APPROVER", name: "Malee" })).id;
  ids[ADM] = (await createUser(ADM, { role: "ADMIN" })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

async function submittedRequest() {
  return createSubmitted(await loginAgent(REQ));
}

describe("F-03 approve and reject", () => {
  it("TEST-36 / AC-24: an approver approves a submitted request and one history row is written", async () => {
    const request = await submittedRequest();
    const approver = await loginAgent(APP);
    const res = await approve(approver, request.id, "OK");
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe("APPROVED");
    const row = await loadRequest(request.id);
    expect(row.status).toBe("APPROVED");
    expect(row.decidedAt).not.toBeNull();
    expect(row.history.map((h) => h.action)).toEqual(["CREATED", "SUBMITTED", "APPROVED"]);
    expect(row.history[2]).toMatchObject({ actorId: ids[APP], fromStatus: "SUBMITTED", toStatus: "APPROVED", comment: "OK" });
  });

  it("TEST-37 / AC-25: an approver rejects with a reason; the reason is stored in the request and in the history", async () => {
    const request = await submittedRequest();
    const approver = await loginAgent(APP);
    const res = await reject(approver, request.id, "Over budget");
    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ status: "REJECTED", rejectionReason: "Over budget" });
    const row = await loadRequest(request.id);
    expect(row.rejectionReason).toBe("Over budget");
    expect(row.history).toHaveLength(3);
    expect(row.history[2]).toMatchObject({ action: "REJECTED", fromStatus: "SUBMITTED", toStatus: "REJECTED", comment: "Over budget" });
  });

  it("TEST-38 / AC-25: a rejection needs a reason of at least 5 characters", async () => {
    const request = await submittedRequest();
    const approver = await loginAgent(APP);
    for (const reason of [undefined, "", "abcd", "    "]) {
      const res = await reject(approver, request.id, reason);
      expect(res.status, `reason ${String(reason)}`).toBe(422);
      expect(res.body.code).toBe("REASON_REQUIRED");
      expect((await loadRequest(request.id)).status).toBe("SUBMITTED");
    }
    const ok = await reject(approver, request.id, "abcde");
    expect(ok.status).toBe(200);
    expect(ok.body.request.status).toBe("REJECTED");
  });

  it("TEST-39 / AC-26: a requester and the administrator cannot approve or reject", async () => {
    const request = await submittedRequest();
    for (const email of [REQ, ADM]) {
      const agent = await loginAgent(email);
      expect((await approve(agent, request.id, "I approve")).status, `${email} approve`).toBe(403);
      expect((await reject(agent, request.id, "I reject it")).status, `${email} reject`).toBe(403);
    }
    const row = await loadRequest(request.id);
    expect(row.status).toBe("SUBMITTED");
    expect(row.history).toHaveLength(2);
  });

  it("TEST-40 / AC-27: an approver cannot approve or reject their own request", async () => {
    const approver = await loginAgent(APP);
    const own = await createSubmitted(approver);
    const a = await approve(approver, own.id, "Approved by me");
    expect(a.status).toBe(403);
    expect(a.body.code).toBe("SELF_APPROVAL");
    const r = await reject(approver, own.id, "Rejected by me");
    expect(r.status).toBe(403);
    expect(r.body.code).toBe("SELF_APPROVAL");
    expect((await loadRequest(own.id)).status).toBe("SUBMITTED");
  });

  it("TEST-41 / AC-28: any other approver can decide a submitted request (there is no assignment)", async () => {
    const request = await submittedRequest();
    const second = await loginAgent(APP2);
    const res = await approve(second, request.id);
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe("APPROVED");
  });

  it("TEST-42 / AC-29: a decided request cannot be decided again", async () => {
    const request = await submittedRequest();
    const approver = await loginAgent(APP);
    expect((await approve(approver, request.id, "OK")).status).toBe(200);
    const again = await reject(approver, request.id, "Changed my mind");
    expect(again.status).toBe(409);
    expect(again.body.code).toBe("ILLEGAL_TRANSITION");
    const row = await loadRequest(request.id);
    expect(row.status).toBe("APPROVED");
    expect(row.history).toHaveLength(3);
  });

  it("TEST-43 / AC-29: the draft of another user is not found", async () => {
    const approver = await loginAgent(APP);
    // Control: the approver can decide a submitted request, so a 404 for the draft is a real refusal and not a missing route.
    const control = await submittedRequest();
    expect((await approve(approver, control.id, "OK")).status).toBe(200);
    const draft = await createDraft(await loginAgent(REQ));
    expect((await approve(approver, draft.id, "OK")).status).toBe(404);
    expect((await reject(approver, draft.id, "No way")).status).toBe(404);
    expect((await loadRequest(draft.id)).status).toBe("DRAFT");
  });

  it("TEST-44 / AC-29: a CANCELLED request cannot be decided", async () => {
    const request = await submittedRequest();
    await getPrisma().purchaseRequest.update({ where: { id: request.id }, data: { status: "CANCELLED" } });
    const approver = await loginAgent(APP);
    expect((await approve(approver, request.id, "OK")).status).toBe(409);
    expect((await loadRequest(request.id)).status).toBe("CANCELLED");
  });

  it("TEST-45 / AC-30: two simultaneous decisions produce exactly one decision", async () => {
    const request = await submittedRequest();
    const first = await loginAgent(APP);
    const second = await loginAgent(APP2);
    const [a, b] = await Promise.all([approve(first, request.id, "Go ahead"), reject(second, request.id, "No thanks")]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    const winner = a.status === 200 ? a : b;
    const row = await loadRequest(request.id);
    expect(row.status).toBe(winner.body.request.status);
    expect(row.history.filter((h) => h.action === "APPROVED" || h.action === "REJECTED")).toHaveLength(1);
  });
});
