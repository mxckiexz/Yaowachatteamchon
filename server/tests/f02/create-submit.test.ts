import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { createDraft, createPending, SAMPLE_ITEMS, submitRequest } from "../helpers/requests.js";

const EMP = "f02-emp@test.local";
const EMP2 = "f02-emp2@test.local";
const APP_A = "f02-appa@test.local";
const APP_B = "f02-appb@test.local";
const APP_OFF = "f02-appoff@test.local";
const ALL = [EMP, EMP2, APP_A, APP_B, APP_OFF];
let ids: Record<string, number> = {};

beforeAll(async () => {
  ids[EMP] = (await createUser(EMP, { role: "EMPLOYEE", name: "Ploy" })).id;
  ids[EMP2] = (await createUser(EMP2, { role: "EMPLOYEE" })).id;
  ids[APP_A] = (await createUser(APP_A, { role: "APPROVER", name: "Somchai" })).id;
  ids[APP_B] = (await createUser(APP_B, { role: "APPROVER", name: "Malee" })).id;
  ids[APP_OFF] = (await createUser(APP_OFF, { role: "APPROVER", isActive: false })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

async function countRequests(userId: number) {
  return getPrisma().purchaseRequest.count({ where: { requesterId: userId } });
}

describe("F-02 create a request", () => {
  it("TEST-13 / AC-11: creates a DRAFT, the server calculates the total and ignores a client total", async () => {
    const agent = await loginAgent(EMP);
    const res = await agent
      .post("/api/requests")
      .set("Origin", ORIGIN)
      .send({ title: "Office supplies", justification: "Low stock", total: 1, items: SAMPLE_ITEMS });
    expect(res.status).toBe(201);
    expect(res.body.request.status).toBe("DRAFT");
    expect(res.body.request.total).toBe(261);
    expect(res.body.request.items).toHaveLength(2);
    const row = await getPrisma().purchaseRequest.findUniqueOrThrow({ where: { id: res.body.request.id }, include: { history: true } });
    expect(row.totalSatang).toBe(26100);
    expect(row.requesterId).toBe(ids[EMP]);
    expect(row.history).toHaveLength(1);
    expect(row.history[0]).toMatchObject({ action: "CREATED", toStatus: "DRAFT", fromStatus: null, actorId: ids[EMP] });
  });

  it("TEST-15 / AC-12: title boundaries (empty and 2 characters fail, 3 passes) and nothing is stored on failure", async () => {
    const agent = await loginAgent(EMP2);
    const before = await countRequests(ids[EMP2]);
    for (const title of ["", "ab", "   a "]) {
      const res = await agent.post("/api/requests").set("Origin", ORIGIN).send({ title, items: SAMPLE_ITEMS });
      expect(res.status).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.fields.title).toBeTruthy();
    }
    expect(await countRequests(ids[EMP2])).toBe(before);
    const ok = await agent.post("/api/requests").set("Origin", ORIGIN).send({ title: "abc", items: SAMPLE_ITEMS });
    expect(ok.status).toBe(201);
    const long = await agent.post("/api/requests").set("Origin", ORIGIN).send({ title: "x".repeat(121), items: SAMPLE_ITEMS });
    expect(long.status).toBe(422);
  });

  it("TEST-16 / AC-12: quantity boundaries (0, 1001, 1.5 fail; 1 and 1000 pass) and at least one item", async () => {
    const agent = await loginAgent(EMP2);
    const post = (items: unknown) => agent.post("/api/requests").set("Origin", ORIGIN).send({ title: "Boundary", items });
    for (const quantity of [0, 1001, 1.5, -1]) {
      const res = await post([{ name: "Pen", quantity, unitPrice: 5 }]);
      expect(res.status, `quantity ${quantity}`).toBe(422);
      expect(res.body.fields).toBeTruthy();
    }
    expect((await post([])).status).toBe(422);
    expect((await post(undefined)).status).toBe(422);
    expect((await post([{ name: "", quantity: 1, unitPrice: 5 }])).status).toBe(422);
    expect((await post([{ name: "Pen", quantity: 1, unitPrice: 5 }])).status).toBe(201);
    expect((await post([{ name: "Pen", quantity: 1000, unitPrice: 5 }])).status).toBe(201);
  });

  it("TEST-17 / AC-12: unit price boundaries (0, -1, 10.505, 1000000.01 fail; 0.01 and 1000000 pass)", async () => {
    const agent = await loginAgent(EMP2);
    const post = (unitPrice: unknown) =>
      agent.post("/api/requests").set("Origin", ORIGIN).send({ title: "Price check", items: [{ name: "Thing", quantity: 1, unitPrice }] });
    for (const price of [0, -1, 10.505, 1000000.01, "abc", null]) {
      const res = await post(price);
      expect(res.status, `price ${String(price)}`).toBe(422);
    }
    const low = await post(0.01);
    expect(low.status).toBe(201);
    expect(low.body.request.total).toBe(0.01);
    const high = await post(1000000);
    expect(high.status).toBe(201);
    expect(high.body.request.total).toBe(1000000);
  });
});

describe("F-02 submit a request", () => {
  it("TEST-18 / AC-13: the owner submits a DRAFT to an active approver", async () => {
    const agent = await loginAgent(EMP);
    const draft = await createDraft(agent);
    const res = await submitRequest(agent, draft.id, ids[APP_A]);
    expect(res.status).toBe(200);
    expect(res.body.request).toMatchObject({ status: "PENDING", approver: { id: ids[APP_A], name: "Somchai" } });
    const row = await getPrisma().purchaseRequest.findUniqueOrThrow({
      where: { id: draft.id },
      include: { history: { orderBy: { id: "asc" } } },
    });
    expect(row.status).toBe("PENDING");
    expect(row.approverId).toBe(ids[APP_A]);
    expect(row.submittedAt).not.toBeNull();
    expect(row.history.map((h) => h.action)).toEqual(["CREATED", "SUBMITTED"]);
    expect(row.history[1]).toMatchObject({ fromStatus: "DRAFT", toStatus: "PENDING", actorId: ids[EMP] });
  });

  it("TEST-19 / AC-14: a request cannot be assigned to its own requester (SELF_REVIEW)", async () => {
    const agent = await loginAgent(APP_A);
    const draft = await createDraft(agent);
    const res = await submitRequest(agent, draft.id, ids[APP_A]);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("SELF_REVIEW");
    const row = await getPrisma().purchaseRequest.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.status).toBe("DRAFT");
    expect(row.approverId).toBeNull();
  });

  it("TEST-20 / AC-15: an employee, an inactive approver and an unknown id are not valid approvers", async () => {
    const agent = await loginAgent(EMP);
    const draft = await createDraft(agent);
    for (const approverId of [ids[EMP2], ids[APP_OFF], 999999, "x"]) {
      const res = await submitRequest(agent, draft.id, approverId as number);
      expect(res.status, `approver ${String(approverId)}`).toBe(422);
      expect(res.body.code).toBe("INVALID_APPROVER");
    }
    const row = await getPrisma().purchaseRequest.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.status).toBe("DRAFT");
  });

  it("TEST-21 / AC-16: someone who is not the owner gets 404 and nothing changes", async () => {
    const owner = await loginAgent(EMP);
    const draft = await createDraft(owner);
    const other = await loginAgent(EMP2);
    const res = await submitRequest(other, draft.id, ids[APP_A]);
    expect(res.status).toBe(404);
    const row = await getPrisma().purchaseRequest.findUniqueOrThrow({ where: { id: draft.id } });
    expect(row.status).toBe("DRAFT");
  });

  it("TEST-22 / AC-16: submitting a request that is not a DRAFT gives 409 and changes nothing", async () => {
    const agent = await loginAgent(EMP);
    const pending = await createPending(agent, ids[APP_A]);
    const res = await submitRequest(agent, pending.id, ids[APP_B]);
    expect(res.status).toBe(409);
    expect(res.body.code).toBe("ILLEGAL_TRANSITION");
    const row = await getPrisma().purchaseRequest.findUniqueOrThrow({ where: { id: pending.id }, include: { history: true } });
    expect(row.approverId).toBe(ids[APP_A]);
    expect(row.history).toHaveLength(2);
  });

  it("TEST-23 / AC-17: the approver list holds active approvers except the caller", async () => {
    const asApprover = await loginAgent(APP_A);
    const res = await asApprover.get("/api/approvers");
    expect(res.status).toBe(200);
    const listed = (res.body.approvers as { id: number }[]).map((a) => a.id);
    expect(listed).toContain(ids[APP_B]);
    expect(listed).not.toContain(ids[APP_A]);
    expect(listed).not.toContain(ids[APP_OFF]);
    expect(listed).not.toContain(ids[EMP]);
    const asEmployee = await loginAgent(EMP);
    const res2 = await asEmployee.get("/api/approvers");
    const listed2 = (res2.body.approvers as { id: number }[]).map((a) => a.id);
    expect(listed2).toContain(ids[APP_A]);
    expect(listed2).toContain(ids[APP_B]);
  });
});
