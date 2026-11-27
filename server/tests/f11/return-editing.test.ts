import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { approve, createSubmitted, loadRequest, reject, submit } from "../helpers/requests.js";

const OWNER = "f11-owner@test.local";
const OTHER = "f11-other@test.local";
const APPROVER = "f11-approver@test.local";
const REQUESTER = "f11-requester@test.local";
const ALL = [OWNER, OTHER, APPROVER, REQUESTER];

beforeAll(async () => {
  await createUser(OWNER, { role: "REQUESTER", name: "F11 owner" });
  await createUser(OTHER, { role: "REQUESTER", name: "F11 other" });
  await createUser(APPROVER, { role: "APPROVER", name: "F11 approver" });
  await createUser(REQUESTER, { role: "REQUESTER", name: "F11 requester" });
});
afterAll(async () => { await cleanupUsers(ALL); await getPrisma().$disconnect(); });

async function returned(agent: any, id: number, reason = "Please add the missing details") {
  return agent.post(`/api/requests/${id}/return`).set("Origin", ORIGIN).send({ reason });
}

describe("F-11 return for editing", () => {
  it("TEST-191 / AC-160: approver returns another user's submitted request", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER);
    const row = await createSubmitted(owner);
    const response = await returned(approver, row.id);
    expect(response.status).toBe(200);
    expect(response.body.request).toMatchObject({ id: row.id, status: "DRAFT", submittedAt: null, decidedAt: null });
    expect((await loadRequest(row.id)).history.at(-1)).toMatchObject({ action: "RETURNED", fromStatus: "SUBMITTED", toStatus: "DRAFT", comment: "Please add the missing details" });
  });

  it("TEST-192 / AC-161, AC-162: only an approver can return and only another owner is eligible", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER); const other = await loginAgent(OTHER);
    const row = await createSubmitted(owner);
    expect((await returned(owner, row.id)).status).toBe(403);
    expect((await returned(other, row.id)).status).toBe(403);
    expect((await returned(approver, row.id)).status).toBe(200);
    const own = await createSubmitted(approver);
    expect((await returned(approver, own.id)).status).toBe(404);
  });

  it("TEST-193 / AC-163, AC-164, AC-165: reason boundaries and status errors", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER);
    for (const reason of ["", "1234", "x".repeat(501), "bad\u0000reason"]) {
      const row = await createSubmitted(owner); expect((await returned(approver, row.id, reason)).status).toBe(422);
    }
    for (const status of ["APPROVED", "REJECTED", "CANCELLED"] as const) {
      const row = await createSubmitted(owner);
      await getPrisma().purchaseRequest.update({ where: { id: row.id }, data: { status } });
      expect((await returned(approver, row.id)).status).toBe(409);
    }
  });

  it("TEST-194 / AC-166: requester can edit and resubmit a returned draft", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER);
    const row = await createSubmitted(owner); expect((await returned(approver, row.id)).status).toBe(200);
    expect((await owner.patch(`/api/requests/${row.id}`).set("Origin", ORIGIN).send({ reason: "Updated reason", category: "SOFTWARE" })).status).toBe(200);
    expect((await submit(owner, row.id)).status).toBe(200);
  });

  it("TEST-195 / AC-167: approver cannot read the returned draft after success", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER);
    const row = await createSubmitted(owner); expect((await returned(approver, row.id)).status).toBe(200);
    expect((await approver.get(`/api/requests/${row.id}`).set("Origin", ORIGIN)).status).toBe(404);
    expect((await approver.get(`/api/requests/${row.id}/history`).set("Origin", ORIGIN)).status).toBe(404);
  });

  it("TEST-196 / AC-168, AC-169: invalid origin and unauthenticated calls are refused", async () => {
    const owner = await loginAgent(OWNER); const row = await createSubmitted(owner);
    expect((await owner.post(`/api/requests/${row.id}/return`).set("Origin", "https://evil.example").send({ reason: "Please add details" })).status).toBe(403);
    expect((await request(app).post(`/api/requests/${row.id}/return`).set("Origin", ORIGIN).send({ reason: "Please add details" })).status).toBe(401);
  });

  it("TEST-197 / AC-170: return and a decision are mutually exclusive", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER); const row = await createSubmitted(owner);
    const [a, b] = await Promise.all([returned(approver, row.id), approve(approver, row.id, "Looks good")]);
    expect([a.status, b.status].filter((status) => status === 200)).toHaveLength(1);
    expect([a.status, b.status].filter((status) => status === 404 || status === 409)).toHaveLength(1);
  });

  it("TEST-198 / AC-171: return preserves existing data and appends one history row", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER); const row = await createSubmitted(owner, { itemName: "Preserve me" });
    const before = await loadRequest(row.id); expect((await returned(approver, row.id)).status).toBe(200); const after = await loadRequest(row.id);
    expect(after.itemName).toBe(before.itemName); expect(after.history.filter((h) => h.action === "RETURNED")).toHaveLength(1);
  });

  it("TEST-199 / AC-172: returned request is visible to its owner and not the review queue", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER); const row = await createSubmitted(owner);
    expect((await returned(approver, row.id)).status).toBe(200);
    expect((await owner.get(`/api/requests/${row.id}`).set("Origin", ORIGIN)).body.request.status).toBe("DRAFT");
    expect((await approver.get("/api/requests?scope=review").set("Origin", ORIGIN)).body.requests.map((r: { id: number }) => r.id)).not.toContain(row.id);
  });
});
