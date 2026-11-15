import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent } from "../helpers/fixtures.js";
import { approve, createDraft, createSubmitted, reject } from "../helpers/requests.js";

const A = "f04-a@test.local";
const B = "f04-b@test.local";
const APP = "f04-app@test.local";
const APP2 = "f04-app2@test.local";
const ADM = "f04-adm@test.local";
const ALL = [A, B, APP, APP2, ADM];
let ids: Record<string, number> = {};

beforeAll(async () => {
  ids[A] = (await createUser(A, { role: "REQUESTER", name: "Ploy" })).id;
  ids[B] = (await createUser(B, { role: "REQUESTER", name: "Nattapong" })).id;
  ids[APP] = (await createUser(APP, { role: "APPROVER", name: "Somchai" })).id;
  ids[APP2] = (await createUser(APP2, { role: "APPROVER", name: "Malee" })).id;
  ids[ADM] = (await createUser(ADM, { role: "ADMIN", name: "Admin" })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

const idsOf = (res: any) => (res.body.requests as { id: number }[]).map((r) => r.id);

describe("F-04 lists", () => {
  it("TEST-51 / AC-33: a user lists only their own requests, newest first", async () => {
    const a = await loginAgent(A);
    const first = await createDraft(a, { itemName: "First item" });
    const second = await createDraft(a, { itemName: "Second item" });
    const b = await loginAgent(B);
    const other = await createDraft(b, { itemName: "B's item" });

    const listA = await a.get("/api/requests");
    expect(listA.status).toBe(200);
    const idsA = idsOf(listA);
    expect(idsA.indexOf(second.id)).toBeLessThan(idsA.indexOf(first.id));
    expect(idsA).not.toContain(other.id);
    expect(listA.body.requests[0]).toMatchObject({ itemName: "Second item", status: "DRAFT", quantity: 2, total: 201 });
    expect(listA.body.requests[0].requestNumber).toMatch(/^PR-\d{4}-\d{4}$/);
    expect(idsOf(await a.get("/api/requests?scope=mine"))).toEqual(idsA);
    expect(idsOf(await b.get("/api/requests"))).toEqual([other.id]);
    expect((await a.get("/api/requests?scope=bogus")).status).toBe(422);
  });

  it("TEST-52 / AC-34: the review queue holds only submitted requests of others, oldest first", async () => {
    const a = await loginAgent(A);
    const b = await loginAgent(B);
    const approver = await loginAgent(APP);
    const first = await createSubmitted(a, { itemName: "Queue first" });
    const second = await createSubmitted(b, { itemName: "Queue second" });
    const decided = await createSubmitted(a, { itemName: "Queue decided" });
    expect((await approve(approver, decided.id, "ok")).status).toBe(200);
    const draft = await createDraft(a, { itemName: "Queue draft" });
    const own = await createSubmitted(approver, { itemName: "Queue own" });

    const res = await approver.get("/api/requests?scope=review");
    expect(res.status).toBe(200);
    const list = idsOf(res);
    expect(list).toContain(first.id);
    expect(list).toContain(second.id);
    expect(list.indexOf(first.id)).toBeLessThan(list.indexOf(second.id));
    for (const excluded of [decided.id, draft.id, own.id]) expect(list).not.toContain(excluded);
    const row = res.body.requests.find((r: any) => r.id === first.id);
    expect(row).toMatchObject({ itemName: "Queue first", status: "SUBMITTED", requester: { name: "Ploy" } });
    expect(row.submittedAt).toBeTruthy();
    expect(idsOf(await (await loginAgent(APP2)).get("/api/requests?scope=review"))).toContain(own.id);
  });

  it("TEST-53 / AC-34: a requester and the administrator get 403 and no data from the review queue", async () => {
    for (const email of [A, ADM]) {
      const res = await (await loginAgent(email)).get("/api/requests?scope=review");
      expect(res.status, email).toBe(403);
      expect(res.body.requests).toBeUndefined();
    }
  });

  it("TEST-58 / AC-37: only the administrator can list all requests, and can read any of them", async () => {
    const a = await loginAgent(A);
    const draft = await createDraft(a, { itemName: "Admin sees drafts" });
    const sub = await createSubmitted(await loginAgent(B), { itemName: "Admin sees submitted" });
    const admin = await loginAgent(ADM);
    const res = await admin.get("/api/requests?scope=all");
    expect(res.status).toBe(200);
    expect(idsOf(res)).toEqual(expect.arrayContaining([draft.id, sub.id]));
    expect((await admin.get(`/api/requests/${draft.id}`)).status).toBe(200);
    for (const email of [A, APP]) {
      const denied = await (await loginAgent(email)).get("/api/requests?scope=all");
      expect(denied.status, email).toBe(403);
      expect(denied.body.requests).toBeUndefined();
    }
  });
});

describe("F-04 detail and history", () => {
  it("TEST-54 / AC-35: the owner sees every field, the rejection reason and the history in order", async () => {
    const owner = await loginAgent(A);
    const approver = await loginAgent(APP);
    const approved = await createSubmitted(owner, { itemName: "Detail approved" });
    expect((await approve(approver, approved.id, "Fine")).status).toBe(200);
    const rejected = await createSubmitted(owner, { itemName: "Detail rejected" });
    expect((await reject(approver, rejected.id, "Over budget")).status).toBe(200);

    const res = await owner.get(`/api/requests/${approved.id}`);
    expect(res.status).toBe(200);
    const r = res.body.request;
    expect(r).toMatchObject({ itemName: "Detail approved", status: "APPROVED", quantity: 2, unitPrice: 100.5, total: 201, category: "EQUIPMENT", reason: "The old one broke" });
    expect(r.requestNumber).toMatch(/^PR-\d{4}-\d{4}$/);
    expect(r.requester).toMatchObject({ id: ids[A], name: "Ploy" });
    expect(r.decidedAt).toBeTruthy();
    expect(r.history.map((h: any) => h.action)).toEqual(["CREATED", "SUBMITTED", "APPROVED"]);
    expect(r.history[2]).toMatchObject({ fromStatus: "SUBMITTED", toStatus: "APPROVED", comment: "Fine", actor: { name: "Somchai" } });

    const rej = (await owner.get(`/api/requests/${rejected.id}`)).body.request;
    expect(rej).toMatchObject({ status: "REJECTED", rejectionReason: "Over budget" });
  });

  it("TEST-55 / AC-35: an approver can open a submitted request but not another user's draft", async () => {
    const owner = await loginAgent(A);
    const submitted = await createSubmitted(owner, { itemName: "Approver may read" });
    const draft = await createDraft(owner, { itemName: "Approver may not read" });
    const approver = await loginAgent(APP);
    const ok = await approver.get(`/api/requests/${submitted.id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.request.itemName).toBe("Approver may read");
    const no = await approver.get(`/api/requests/${draft.id}`);
    expect(no.status).toBe(404);
    expect(JSON.stringify(no.body)).not.toContain("Approver may not read");
    const own = await createDraft(approver, { itemName: "Own draft" });
    expect((await approver.get(`/api/requests/${own.id}`)).status).toBe(200);
  });

  it("TEST-56 / AC-35: another requester gets 404 and no request data", async () => {
    const owner = await loginAgent(A);
    const request = await createSubmitted(owner, { itemName: "Private item name" });
    // Control: the owner can read it, so the 404 for the other requester is a real refusal and not a missing route.
    expect((await owner.get(`/api/requests/${request.id}`)).status).toBe(200);
    const res = await (await loginAgent(B)).get(`/api/requests/${request.id}`);
    expect(res.status).toBe(404);
    expect(res.body.request).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toContain("Private item name");
    for (const bad of ["abc", "1 OR 1=1", "99999999999"]) {
      expect((await owner.get(`/api/requests/${encodeURIComponent(bad)}`)).status, bad).toBe(404);
    }
  });

  it("TEST-57 / AC-36: the history endpoint has the same visibility and order as the detail", async () => {
    const owner = await loginAgent(A);
    const request = await createSubmitted(owner, { itemName: "History item" });
    const approver = await loginAgent(APP);
    expect((await reject(approver, request.id, "Not needed now")).status).toBe(200);
    for (const agent of [owner, approver]) {
      const res = await agent.get(`/api/requests/${request.id}/history`);
      expect(res.status).toBe(200);
      expect(res.body.history.map((h: any) => h.action)).toEqual(["CREATED", "SUBMITTED", "REJECTED"]);
      expect(res.body.history[2]).toMatchObject({ comment: "Not needed now", actor: { name: "Somchai" } });
    }
    expect((await (await loginAgent(B)).get(`/api/requests/${request.id}/history`)).status).toBe(404);
    const draft = await createDraft(owner, { itemName: "Draft history" });
    expect((await approver.get(`/api/requests/${draft.id}/history`)).status).toBe(404);
  });
});
