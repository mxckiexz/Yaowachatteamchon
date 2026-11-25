import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent } from "../helpers/fixtures.js";
import { approve, cancel, createDraft, createSubmitted, loadRequest, reject } from "../helpers/requests.js";
import { ORIGIN } from "../helpers/fixtures.js";

const REQ = "f06-req@test.local";
const OTHER = "f06-other@test.local";
const APP = "f06-app@test.local";
const ADM = "f06-adm@test.local";
const ALL = [REQ, OTHER, APP, ADM];

beforeAll(async () => {
  await createUser(REQ, { role: "REQUESTER", name: "F06 requester" });
  await createUser(OTHER, { role: "REQUESTER", name: "F06 other" });
  await createUser(APP, { role: "APPROVER", name: "F06 approver" });
  await createUser(ADM, { role: "ADMIN", name: "F06 admin" });
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

describe("F-06 cancel request", () => {
  it("TEST-93 / AC-58: the owner cancels a draft", async () => {
    const owner = await loginAgent(REQ);
    const request = await createDraft(owner);
    const response = await cancel(owner, request.id);
    expect(response.status).toBe(200);
    expect(response.body.request.status).toBe("CANCELLED");
    expect((await loadRequest(request.id)).history.map((h) => h.action)).toEqual(["CREATED", "CANCELLED"]);
  });

  it("TEST-94 / AC-59: the owner cancels a submitted request", async () => {
    const owner = await loginAgent(REQ);
    const request = await createSubmitted(owner);
    const response = await cancel(owner, request.id);
    expect(response.status).toBe(200);
    expect(response.body.request.status).toBe("CANCELLED");
  });

  it("TEST-95 / AC-60, AC-61: cancellation keeps data and appends one history row", async () => {
    const owner = await loginAgent(REQ);
    const request = await createDraft(owner, { itemName: "Keep all fields" });
    const before = await loadRequest(request.id);
    expect((await cancel(owner, request.id)).status).toBe(200);
    const after = await loadRequest(request.id);
    expect(after).toMatchObject({ itemName: before.itemName, totalSatang: before.totalSatang, requesterId: before.requesterId, status: "CANCELLED" });
    expect(after.history.filter((h) => h.action === "CANCELLED")).toHaveLength(1);
    expect(after.history[1]).toMatchObject({ actorId: before.requesterId, fromStatus: "DRAFT", toStatus: "CANCELLED" });
  });

  it("TEST-96 / AC-62, AC-63: non-owners receive 404", async () => {
    const owner = await loginAgent(REQ);
    const request = await createSubmitted(owner);
    for (const email of [OTHER, APP, ADM]) {
      const response = await cancel(await loginAgent(email), request.id);
      expect(response.status, email).toBe(404);
      expect(response.body.code).toBe("NOT_FOUND");
    }
    expect((await loadRequest(request.id)).status).toBe("SUBMITTED");
  });

  it("TEST-97 / AC-64: terminal requests cannot be cancelled", async () => {
    const owner = await loginAgent(REQ);
    for (const status of ["APPROVED", "REJECTED", "CANCELLED"] as const) {
      const request = await createSubmitted(owner);
      await getPrisma().purchaseRequest.update({ where: { id: request.id }, data: { status } });
      const response = await cancel(owner, request.id);
      expect(response.status, status).toBe(409);
      expect(response.body.code).toBe("ILLEGAL_TRANSITION");
    }
  });

  it("TEST-98 / AC-65: concurrent cancels produce one transition", async () => {
    const owner = await loginAgent(REQ);
    const request = await createSubmitted(owner);
    const [a, b] = await Promise.all([cancel(owner, request.id), cancel(owner, request.id)]);
    expect([a.status, b.status].sort()).toEqual([200, 409]);
    expect((await loadRequest(request.id)).history.filter((h) => h.action === "CANCELLED")).toHaveLength(1);
  });

  it("TEST-99 / AC-66: a decision racing with cancel produces one transition", async () => {
    const owner = await loginAgent(REQ);
    const request = await createSubmitted(owner);
    const approver = await loginAgent(APP);
    const [decision, cancellation] = await Promise.all([approve(approver, request.id, "OK"), cancel(owner, request.id)]);
    expect([decision.status, cancellation.status].sort()).toEqual([200, 409]);
    expect((await loadRequest(request.id)).history.filter((h) => ["APPROVED", "CANCELLED"].includes(h.action))).toHaveLength(1);
  });

  it("TEST-101 / AC-68: nonnumeric id is 404 and anonymous request with the correct origin is 401", async () => {
    const owner = await loginAgent(REQ);
    expect((await owner.post("/api/requests/not-a-number/cancel").set("Origin", ORIGIN).send({})).status).toBe(404);
    expect((await request(app).post("/api/requests/1/cancel").set("Origin", ORIGIN).send({})).status).toBe(401);
  });

  it("TEST-102 / AC-69: a foreign origin is refused", async () => {
    const owner = await loginAgent(REQ);
    const request = await createDraft(owner);
    const response = await owner.post(`/api/requests/${request.id}/cancel`).set("Origin", "https://evil.example").send({});
    expect(response.status).toBe(403);
    expect((await loadRequest(request.id)).status).toBe("DRAFT");
  });

  it("TEST-103 / AC-70: cancellation blocks later actions and leaves the owner-visible request", async () => {
    const owner = await loginAgent(REQ);
    const approver = await loginAgent(APP);
    const request = await createSubmitted(owner);
    expect((await cancel(owner, request.id)).status).toBe(200);
    expect((await owner.patch(`/api/requests/${request.id}`).set("Origin", ORIGIN).send({ itemName: "No" })).status).toBe(409);
    expect((await owner.post(`/api/requests/${request.id}/submit`).set("Origin", ORIGIN).send({})).status).toBe(409);
    expect((await approve(approver, request.id, "No")).status).toBe(409);
    expect((await reject(approver, request.id, "No")).status).toBe(409);
    expect((await approver.get("/api/requests?scope=review")).body.requests.map((r: { id: number }) => r.id)).not.toContain(request.id);
    expect((await owner.get(`/api/requests/${request.id}`)).body.request.status).toBe("CANCELLED");
  });
});
