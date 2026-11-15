import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { approve, createBody, submit } from "../helpers/requests.js";

const REQ = "q-reg-req@test.local";
const OUTSIDER = "q-reg-out@test.local";
const APP = "q-reg-app@test.local";
const ADM = "q-reg-adm@test.local";
const ALL = [REQ, OUTSIDER, APP, ADM];

beforeAll(async () => {
  await createUser(REQ, { role: "REQUESTER", name: "Ploy" });
  await createUser(OUTSIDER, { role: "REQUESTER" });
  await createUser(APP, { role: "APPROVER", name: "Somchai" });
  await createUser(ADM, { role: "ADMIN" });
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

describe("Regression: one journey through the features", () => {
  it("TEST-91 / AC-56: create, edit, submit, list, queue, approve, detail, second decision refused, outsider refused, administrator reads", async () => {
    const requester = await loginAgent(REQ);
    const approver = await loginAgent(APP);

    const created = await requester.post("/api/requests").set("Origin", ORIGIN).send(createBody({ itemName: "Journey item" }));
    expect(created.status).toBe(201);
    const id = created.body.request.id;
    expect((await requester.patch(`/api/requests/${id}`).set("Origin", ORIGIN).send({ quantity: 3 })).body.request.total).toBe(301.5);
    expect((await submit(requester, id)).status).toBe(200);

    const mine = await requester.get("/api/requests");
    expect(mine.body.requests.find((r: any) => r.id === id)).toMatchObject({ status: "SUBMITTED", total: 301.5 });
    expect((await approver.get("/api/requests?scope=review")).body.requests.map((r: any) => r.id)).toContain(id);

    expect((await approve(approver, id, "Fine")).status).toBe(200);
    const detail = await requester.get(`/api/requests/${id}`);
    expect(detail.body.request).toMatchObject({ status: "APPROVED", total: 301.5 });
    expect(detail.body.request.history.map((h: any) => h.action)).toEqual(["CREATED", "SUBMITTED", "APPROVED"]);
    expect((await approver.get("/api/requests?scope=review")).body.requests.map((r: any) => r.id)).not.toContain(id);

    const again = await approver.post(`/api/requests/${id}/reject`).set("Origin", ORIGIN).send({ reason: "Changed my mind" });
    expect(again.status).toBe(409);
    expect((await (await loginAgent(OUTSIDER)).get(`/api/requests/${id}`)).status).toBe(404);
    expect((await (await loginAgent(ADM)).get("/api/requests?scope=all")).body.requests.map((r: any) => r.id)).toContain(id);

    expect((await requester.post("/api/auth/logout").set("Origin", ORIGIN)).status).toBe(204);
    expect((await requester.get(`/api/requests/${id}`)).status).toBe(401);
  });
});
