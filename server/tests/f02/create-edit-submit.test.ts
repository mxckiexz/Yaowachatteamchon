import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { createBody, createDraft, createSubmitted, loadRequest, submit } from "../helpers/requests.js";

const REQ = "f02-req@test.local";
const REQ2 = "f02-req2@test.local";
const APP = "f02-app@test.local";
const ADM = "f02-adm@test.local";
const ALL = [REQ, REQ2, APP, ADM];
let ids: Record<string, number> = {};

beforeAll(async () => {
  ids[REQ] = (await createUser(REQ, { role: "REQUESTER", name: "Ploy" })).id;
  ids[REQ2] = (await createUser(REQ2, { role: "REQUESTER" })).id;
  ids[APP] = (await createUser(APP, { role: "APPROVER", name: "Somchai" })).id;
  ids[ADM] = (await createUser(ADM, { role: "ADMIN" })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

const count = (userId: number) => getPrisma().purchaseRequest.count({ where: { requesterId: userId } });
const post = (agent: any, body: unknown) => agent.post("/api/requests").set("Origin", ORIGIN).send(body);
const patch = (agent: any, id: number, body: unknown) => agent.patch(`/api/requests/${id}`).set("Origin", ORIGIN).send(body);

describe("F-02 create", () => {
  it("TEST-16 / AC-13: creates a DRAFT with a request number; the server calculates the total and ignores a client total", async () => {
    const agent = await loginAgent(REQ);
    const res = await post(agent, createBody({ quantity: 2, unitPrice: 100.5, total: 1, status: "APPROVED" }));
    expect(res.status).toBe(201);
    const r = res.body.request;
    expect(r.status).toBe("DRAFT");
    expect(r.requestNumber).toMatch(/^PR-\d{4}-\d{4}$/);
    expect(r.total).toBe(201);
    expect(r.unitPrice).toBe(100.5);
    expect(r.requester).toMatchObject({ id: ids[REQ], name: "Ploy" });
    const row = await loadRequest(r.id);
    expect(row.totalSatang).toBe(20100n);
    expect(row.history).toHaveLength(1);
    expect(row.history[0]).toMatchObject({ action: "CREATED", fromStatus: null, toStatus: "DRAFT", actorId: ids[REQ] });
  });

  it("TEST-18 / AC-14: item name and description rules; nothing is stored on failure", async () => {
    const agent = await loginAgent(REQ2);
    const before = await count(ids[REQ2]);
    for (const itemName of ["", "   ", "x".repeat(101)]) {
      const res = await post(agent, createBody({ itemName }));
      expect(res.status, `itemName ${itemName.length}`).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.fields.itemName).toBeTruthy();
    }
    const noDescription = await post(agent, createBody({ description: "" }));
    expect(noDescription.status).toBe(422);
    expect(noDescription.body.fields.description).toBeTruthy();
    expect(await count(ids[REQ2])).toBe(before);
    expect((await post(agent, createBody({ itemName: "x".repeat(100) }))).status).toBe(201);
  });

  it("TEST-19 / AC-14: quantity boundaries (0, 1001, 1.5, -1 and text fail; 1 and 1000 pass)", async () => {
    const agent = await loginAgent(REQ2);
    for (const quantity of [0, 1001, 1.5, -1, "2"]) {
      const res = await post(agent, createBody({ quantity }));
      expect(res.status, `quantity ${String(quantity)}`).toBe(422);
      expect(res.body.fields.quantity).toBeTruthy();
    }
    expect((await post(agent, createBody({ quantity: 1 }))).status).toBe(201);
    expect((await post(agent, createBody({ quantity: 1000 }))).status).toBe(201);
  });

  it("TEST-20 / AC-14: unit price boundaries (0, -1, 10.505, 1000000.01 fail; 0.01 and 1000000 pass)", async () => {
    const agent = await loginAgent(REQ2);
    for (const unitPrice of [0, -1, 10.505, 1000000.01, "abc", null]) {
      const res = await post(agent, createBody({ unitPrice }));
      expect(res.status, `price ${String(unitPrice)}`).toBe(422);
      expect(res.body.fields.unitPrice).toBeTruthy();
    }
    const low = await post(agent, createBody({ unitPrice: 0.01, quantity: 1 }));
    expect(low.status).toBe(201);
    expect(low.body.request.total).toBe(0.01);
    const high = await post(agent, createBody({ unitPrice: 1000000, quantity: 1 }));
    expect(high.status).toBe(201);
    expect(high.body.request.total).toBe(1000000);
    // Both maxima together: 1000 x 1,000,000 baht = 1,000,000,000 baht = 100,000,000,000 satang (more than a 32-bit integer holds).
    const both = await post(agent, createBody({ unitPrice: 1000000, quantity: 1000 }));
    expect(both.status).toBe(201);
    expect(both.body.request.total).toBe(1000000000);
    expect((await loadRequest(both.body.request.id)).totalSatang).toBe(100000000000n);
  });

  it("TEST-21 / AC-14: the category must be one of the list and the reason has a length limit", async () => {
    const agent = await loginAgent(REQ2);
    for (const category of ["FOOD", "equipment", "Equipment"]) {
      const res = await post(agent, createBody({ category }));
      expect(res.status, category).toBe(422);
      expect(res.body.fields.category).toBeTruthy();
    }
    const tooLong = await post(agent, createBody({ reason: "x".repeat(501) }));
    expect(tooLong.status).toBe(422);
    expect(tooLong.body.fields.reason).toBeTruthy();
    for (const category of ["EQUIPMENT", "SOFTWARE", "FURNITURE", "STATIONERY", "OTHER"]) {
      expect((await post(agent, createBody({ category }))).status, category).toBe(201);
    }
    const draftOnly = await post(agent, createBody({ reason: "", category: undefined }));
    expect(draftOnly.status).toBe(201);
    expect(draftOnly.body.request.category).toBeNull();
  });

  it("TEST-22 / AC-15: 20 simultaneous creates get 20 different request numbers", async () => {
    const agent = await loginAgent(REQ);
    const results = await Promise.all(Array.from({ length: 20 }, () => post(agent, createBody())));
    expect(results.every((r) => r.status === 201)).toBe(true);
    const numbers = results.map((r) => r.body.request.requestNumber as string);
    expect(new Set(numbers).size).toBe(20);
    expect(numbers.every((n) => /^PR-\d{4}-\d{4}$/.test(n))).toBe(true);
  });

  it("TEST-31 / AC-22: the administrator cannot create a request", async () => {
    const agent = await loginAgent(ADM);
    const before = await getPrisma().purchaseRequest.count();
    const res = await post(agent, createBody());
    expect(res.status).toBe(403);
    expect(await getPrisma().purchaseRequest.count()).toBe(before);
  });

  it("TEST-32 / AC-22: an approver can create a request of their own", async () => {
    const agent = await loginAgent(APP);
    const res = await post(agent, createBody());
    expect(res.status).toBe(201);
    expect(res.body.request.requester.id).toBe(ids[APP]);
  });
});

describe("F-02 edit", () => {
  it("TEST-23 / AC-16: the owner edits a DRAFT; the total is recalculated and the number stays", async () => {
    const agent = await loginAgent(REQ);
    const draft = await createDraft(agent);
    const res = await patch(agent, draft.id, { itemName: "Monitor", quantity: 3, unitPrice: 50 });
    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ itemName: "Monitor", quantity: 3, unitPrice: 50, total: 150, status: "DRAFT", requestNumber: draft.requestNumber });
    const bad = await patch(agent, draft.id, { quantity: 0 });
    expect(bad.status).toBe(422);
    expect(bad.body.fields.quantity).toBeTruthy();
    const row = await loadRequest(draft.id);
    expect(row).toMatchObject({ itemName: "Monitor", quantity: 3, totalSatang: 15000n });
  });

  it("TEST-24 / AC-17: only a DRAFT can be edited (SUBMITTED, APPROVED, REJECTED, CANCELLED are refused)", async () => {
    const agent = await loginAgent(REQ);
    const submitted = await createSubmitted(agent);
    const first = await patch(agent, submitted.id, { itemName: "Changed" });
    expect(first.status).toBe(409);
    expect(first.body.code).toBe("NOT_EDITABLE");
    for (const status of ["APPROVED", "REJECTED", "CANCELLED"] as const) {
      await getPrisma().purchaseRequest.update({ where: { id: submitted.id }, data: { status } });
      const res = await patch(agent, submitted.id, { itemName: "Changed" });
      expect(res.status, status).toBe(409);
      expect(res.body.code).toBe("NOT_EDITABLE");
    }
    expect((await loadRequest(submitted.id)).itemName).toBe("Laser printer");
  });

  it("TEST-25 / AC-17: someone who is not the owner (requester, approver, administrator) gets 404", async () => {
    const owner = await loginAgent(REQ);
    const draft = await createDraft(owner);
    for (const email of [REQ2, APP, ADM]) {
      const res = await patch(await loginAgent(email), draft.id, { itemName: "Hijacked" });
      expect(res.status, email).toBe(404);
    }
    expect((await loadRequest(draft.id)).itemName).toBe("Laser printer");
  });
});

describe("F-02 submit", () => {
  it("TEST-26 / AC-18: the owner submits a complete DRAFT", async () => {
    const agent = await loginAgent(REQ);
    const draft = await createDraft(agent);
    const res = await submit(agent, draft.id);
    expect(res.status).toBe(200);
    expect(res.body.request.status).toBe("SUBMITTED");
    expect(res.body.request.submittedAt).toBeTruthy();
    const row = await loadRequest(draft.id);
    expect(row.history.map((h) => h.action)).toEqual(["CREATED", "SUBMITTED"]);
    expect(row.history[1]).toMatchObject({ fromStatus: "DRAFT", toStatus: "SUBMITTED", actorId: ids[REQ] });
  });

  it("TEST-27 / AC-19: a draft without a reason or a category cannot be submitted (INCOMPLETE)", async () => {
    const agent = await loginAgent(REQ);
    const noReason = await createDraft(agent, { reason: "" });
    const res1 = await submit(agent, noReason.id);
    expect(res1.status).toBe(422);
    expect(res1.body.code).toBe("INCOMPLETE");
    expect(Object.keys(res1.body.fields)).toEqual(["reason"]);

    const noCategory = await createDraft(agent, { category: undefined });
    const res2 = await submit(agent, noCategory.id);
    expect(res2.status).toBe(422);
    expect(Object.keys(res2.body.fields)).toEqual(["category"]);

    const neither = await createDraft(agent, { reason: "   ", category: undefined });
    const res3 = await submit(agent, neither.id);
    expect(Object.keys(res3.body.fields).sort()).toEqual(["category", "reason"]);
    expect((await loadRequest(neither.id)).status).toBe("DRAFT");

    expect((await patch(agent, neither.id, { reason: "Needed now", category: "SOFTWARE" })).status).toBe(200);
    expect((await submit(agent, neither.id)).status).toBe(200);
  });

  it("TEST-28 / AC-20: submitting a request that is not a DRAFT gives 409 and changes nothing", async () => {
    const agent = await loginAgent(REQ);
    const request = await createSubmitted(agent);
    const res = await submit(agent, request.id);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ILLEGAL_TRANSITION");
    expect((await loadRequest(request.id)).history).toHaveLength(2);
  });

  it("TEST-29 / AC-20: someone who is not the owner gets 404 when submitting", async () => {
    const owner = await loginAgent(REQ);
    const draft = await createDraft(owner);
    for (const email of [REQ2, APP]) {
      const res = await submit(await loginAgent(email), draft.id);
      expect(res.status, email).toBe(404);
    }
    expect((await loadRequest(draft.id)).status).toBe("DRAFT");
  });

  it("TEST-30 / AC-21: editing and submitting one user's request leaves another user's request untouched", async () => {
    const a = await loginAgent(REQ);
    const b = await loginAgent(REQ2);
    const bDraft = await createDraft(b, { itemName: "B's item" });
    const before = JSON.stringify(await loadRequest(bDraft.id));
    const aDraft = await createDraft(a);
    expect((await patch(a, aDraft.id, { itemName: "A edited", quantity: 7 })).status).toBe(200);
    expect((await submit(a, aDraft.id)).status).toBe(200);
    expect(JSON.stringify(await loadRequest(bDraft.id))).toBe(before);
  });
});
