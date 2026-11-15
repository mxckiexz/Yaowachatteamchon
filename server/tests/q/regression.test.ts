import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { SAMPLE_ITEMS, submitRequest } from "../helpers/requests.js";

const EMP = "q-reg-emp@test.local";
const OUTSIDER = "q-reg-out@test.local";
const APP = "q-reg-app@test.local";
const APP2 = "q-reg-app2@test.local";
const ALL = [EMP, OUTSIDER, APP, APP2];
let ids: Record<string, number> = {};

beforeAll(async () => {
  ids[EMP] = (await createUser(EMP, { role: "EMPLOYEE", name: "Ploy" })).id;
  ids[OUTSIDER] = (await createUser(OUTSIDER, { role: "EMPLOYEE" })).id;
  ids[APP] = (await createUser(APP, { role: "APPROVER", name: "Somchai" })).id;
  ids[APP2] = (await createUser(APP2, { role: "APPROVER" })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

describe("Regression: one journey through F-01 to F-04", () => {
  it("TEST-61 / AC-46: create, submit, list, queue, approve, detail, second decision refused, outsider refused", async () => {
    const employee = await loginAgent(EMP);
    const approver = await loginAgent(APP);

    const created = await employee.post("/api/requests").set("Origin", ORIGIN).send({ title: "Journey", items: SAMPLE_ITEMS });
    expect(created.status).toBe(201);
    const id = created.body.request.id;

    expect((await submitRequest(employee, id, ids[APP])).status).toBe(200);
    const mine = await employee.get("/api/requests");
    expect(mine.body.requests.find((r: any) => r.id === id)).toMatchObject({ status: "PENDING", total: 261 });
    const queue = await approver.get("/api/reviews");
    expect(queue.body.requests.map((r: any) => r.id)).toContain(id);

    const approved = await approver.post(`/api/requests/${id}/decision`).set("Origin", ORIGIN).send({ decision: "APPROVED", comment: "Fine" });
    expect(approved.status).toBe(200);

    const detail = await employee.get(`/api/requests/${id}`);
    expect(detail.body.request).toMatchObject({ status: "APPROVED", total: 261, decisionComment: "Fine" });
    expect(detail.body.request.history.map((h: any) => h.action)).toEqual(["CREATED", "SUBMITTED", "APPROVED"]);
    expect((await approver.get("/api/reviews")).body.requests.map((r: any) => r.id)).not.toContain(id);

    const again = await approver.post(`/api/requests/${id}/decision`).set("Origin", ORIGIN).send({ decision: "REJECTED", comment: "Changed my mind" });
    expect(again.status).toBe(409);

    for (const email of [OUTSIDER, APP2]) {
      const outsider = await loginAgent(email);
      expect((await outsider.get(`/api/requests/${id}`)).status, email).toBe(404);
    }
    const noSession = await employee.post("/api/auth/logout").set("Origin", ORIGIN);
    expect(noSession.status).toBe(204);
    expect((await employee.get(`/api/requests/${id}`)).status).toBe(401);
  });
});
