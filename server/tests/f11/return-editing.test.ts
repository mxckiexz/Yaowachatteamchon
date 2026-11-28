import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { approve, cancel, createSubmitted, loadRequest, submit } from "../helpers/requests.js";

const OWNER = "f11-owner@test.local";
const OTHER = "f11-other@test.local";
const APPROVER = "f11-approver@test.local";
const APPROVER2 = "f11-approver2@test.local";
const ALL = [OWNER, OTHER, APPROVER, APPROVER2];

beforeAll(async () => {
  await createUser(OWNER, { role: "REQUESTER", name: "F11 owner" });
  await createUser(OTHER, { role: "REQUESTER", name: "F11 other" });
  await createUser(APPROVER, { role: "APPROVER", name: "F11 approver" });
  await createUser(APPROVER2, { role: "APPROVER", name: "F11 approver two" });
});
afterAll(async () => { await cleanupUsers(ALL); await getPrisma().$disconnect(); });

async function returned(agent: any, id: number, reason = "Please add the missing details") {
  return agent.post(`/api/requests/${id}/return`).set("Origin", ORIGIN).send({ reason, status: "APPROVED", decidedAt: "2000-01-01T00:00:00.000Z" });
}

describe("F-11 return for editing", () => {
  it("TEST-191 / AC-160 to AC-162: valid return updates status and records history", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER);
    const row = await createSubmitted(owner); const response = await returned(approver, row.id);
    expect(response.status).toBe(200);
    expect(response.body.request).toMatchObject({ id: row.id, status: "DRAFT", submittedAt: null, decidedAt: null });
    expect((await loadRequest(row.id)).history.at(-1)).toMatchObject({ action: "RETURNED", fromStatus: "SUBMITTED", toStatus: "DRAFT", comment: "Please add the missing details" });
  });

  it("TEST-192 / AC-163: owner edits and resubmits a returned request", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER); const row = await createSubmitted(owner);
    expect((await returned(approver, row.id)).status).toBe(200);
    expect((await owner.patch(`/api/requests/${row.id}`).set("Origin", ORIGIN).send({ reason: "Updated reason", category: "SOFTWARE" })).status).toBe(200);
    expect((await submit(owner, row.id)).status).toBe(200);
  });

  it("TEST-193 / AC-164: only another approver may return", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER); const other = await loginAgent(OTHER); const row = await createSubmitted(owner);
    expect((await returned(owner, row.id)).status).toBe(403); expect((await returned(other, row.id)).status).toBe(403); expect((await returned(approver, row.id)).status).toBe(200);
    const own = await createSubmitted(approver); expect((await returned(approver, own.id)).status).toBe(404);
  });

  it("TEST-194 / AC-165: draft is hidden and terminal statuses return 409", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER);
    const draft = await owner.post("/api/requests").set("Origin", ORIGIN).send({ itemName: "Draft", description: "Draft", quantity: 1, unitPrice: 1, reason: "", category: "" });
    expect((await returned(approver, draft.body.request.id)).status).toBe(404);
    for (const status of ["APPROVED", "REJECTED", "CANCELLED"] as const) { const row = await createSubmitted(owner); await getPrisma().purchaseRequest.update({ where: { id: row.id }, data: { status } }); expect((await returned(approver, row.id)).status).toBe(409); }
  });

  it("TEST-195 / AC-166 and AC-179: valid boundaries pass and invalid reasons fail", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER);
    for (const reason of ["12345", "x".repeat(500)]) { const row = await createSubmitted(owner); expect((await returned(approver, row.id, reason)).status).toBe(200); }
    for (const reason of ["", "1234", "x".repeat(501), "bad\u0000reason"]) { const row = await createSubmitted(owner); expect((await returned(approver, row.id, reason)).status).toBe(422); }
  });

  it("TEST-196 / AC-167: hidden, unknown and non-numeric ids return 404", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER); const row = await createSubmitted(owner); expect((await returned(approver, row.id)).status).toBe(200);
    for (const path of [`/api/requests/${row.id}/return`, "/api/requests/999999999/return", "/api/requests/abc/return"]) { const response = await approver.post(path).set("Origin", ORIGIN).send({ reason: "Please add details" }); expect(response.status).toBe(404); expect(response.body).not.toHaveProperty("request"); }
  });

  it("TEST-197 / AC-168: origin, session and malformed JSON checks are enforced", async () => {
    const owner = await loginAgent(OWNER); const row = await createSubmitted(owner);
    expect((await owner.post(`/api/requests/${row.id}/return`).set("Origin", "https://evil.example").send({ reason: "Please add details" })).status).toBe(403);
    expect((await request(app).post(`/api/requests/${row.id}/return`).set("Origin", ORIGIN).send({ reason: "Please add details" })).status).toBe(401);
    expect((await request(app).post(`/api/requests/${row.id}/return`).set("Origin", ORIGIN).set("Content-Type", "application/json").send("{")).status).toBe(400);
  });

  it("TEST-198 / AC-169: concurrent returns and cancel have only contract-allowed outcomes", async () => {
    const owner = await loginAgent(OWNER); const a = await loginAgent(APPROVER); const b = await loginAgent(APPROVER2); const row = await createSubmitted(owner);
    const [first, second] = await Promise.all([returned(a, row.id), returned(b, row.id)]);
    expect([first.status, second.status].filter((s) => s === 200)).toHaveLength(1); expect([first.status, second.status].some((s) => s === 404 || s === 409)).toBe(true); expect((await loadRequest(row.id)).history.filter((h) => h.action === "RETURNED")).toHaveLength(1);
    const row2 = await createSubmitted(owner); const [ret, stop] = await Promise.all([returned(a, row2.id), cancel(owner, row2.id)]); expect([ret.status, stop.status].every((s) => [200, 404, 409].includes(s))).toBe(true);
  });

  it("TEST-199 / AC-170: history failure rolls back status", async () => {
    const owner = await loginAgent(OWNER); const approver = await loginAgent(APPROVER); const row = await createSubmitted(owner); const prisma = getPrisma(); const transaction = prisma.$transaction.bind(prisma);
    const forcedFailure = vi.spyOn(prisma, "$transaction").mockImplementationOnce(async (callback: any) => transaction(async (tx: any) => { const failingTx = Object.create(tx); const history = Object.create(tx.requestHistory); history.create = async () => { throw new Error("forced history failure"); }; failingTx.requestHistory = history; return callback(failingTx); }) as any);
    try { expect((await returned(approver, row.id)).status).toBe(500); } finally { forcedFailure.mockRestore(); }
    const unchanged = await loadRequest(row.id); expect(unchanged.status).toBe("SUBMITTED"); expect(unchanged.history.at(-1)?.action).toBe("SUBMITTED");
  });
});
