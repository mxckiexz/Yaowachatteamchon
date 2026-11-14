import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { createDraft, createPending, decide } from "../helpers/requests.js";

const U1 = "f04-u1@test.local";
const U2 = "f04-u2@test.local";
const APP_A = "f04-appa@test.local";
const APP_B = "f04-appb@test.local";
const ALL = [U1, U2, APP_A, APP_B];
let ids: Record<string, number> = {};

beforeAll(async () => {
  ids[U1] = (await createUser(U1, { role: "EMPLOYEE", name: "Ploy" })).id;
  ids[U2] = (await createUser(U2, { role: "EMPLOYEE", name: "Nattapong" })).id;
  ids[APP_A] = (await createUser(APP_A, { role: "APPROVER", name: "Somchai" })).id;
  ids[APP_B] = (await createUser(APP_B, { role: "APPROVER", name: "Malee" })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

describe("NFR-01 anonymous access", () => {
  const routes: [string, string][] = [
    ["GET", "/api/auth/me"],
    ["GET", "/api/approvers"],
    ["GET", "/api/requests"],
    ["POST", "/api/requests"],
    ["GET", "/api/requests/1"],
    ["POST", "/api/requests/1/submit"],
    ["POST", "/api/requests/1/decision"],
    ["GET", "/api/reviews"],
  ];

  it("TEST-11 / AC-08: every protected route returns 401 with no data when there is no session", async () => {
    for (const [method, path] of routes) {
      const call = method === "GET" ? request(app).get(path) : request(app).post(path).set("Origin", ORIGIN).send({});
      const res = await call;
      expect(res.status, `${method} ${path}`).toBe(401);
      expect(Object.keys(res.body), `${method} ${path}`).toEqual(["error"]);
    }
  });
});

describe("F-04 lists, detail and history", () => {
  it("TEST-35 / AC-27: a user lists only their own requests, newest first", async () => {
    const a = await loginAgent(U1);
    const first = await createDraft(a, { title: "First request" });
    const second = await createDraft(a, { title: "Second request" });
    const b = await loginAgent(U2);
    const other = await createDraft(b, { title: "Other person's request" });

    const listA = await a.get("/api/requests");
    expect(listA.status).toBe(200);
    const idsA = (listA.body.requests as { id: number }[]).map((r) => r.id);
    expect(idsA.indexOf(second.id)).toBeLessThan(idsA.indexOf(first.id));
    expect(idsA).not.toContain(other.id);
    expect(listA.body.requests[0]).toMatchObject({ title: "Second request", status: "DRAFT", total: 261 });

    const listB = await b.get("/api/requests");
    const idsB = (listB.body.requests as { id: number }[]).map((r) => r.id);
    expect(idsB).toEqual([other.id]);
  });

  it("TEST-36 / AC-28: detail for the owner has items, total, decision fields and history in order", async () => {
    const owner = await loginAgent(U1);
    const approver = await loginAgent(APP_A);
    const pending = await createPending(owner, ids[APP_A], { title: "Detail check" });
    expect((await decide(approver, pending.id, "APPROVED", "Fine")).status).toBe(200);

    const res = await owner.get(`/api/requests/${pending.id}`);
    expect(res.status).toBe(200);
    const r = res.body.request;
    expect(r).toMatchObject({ title: "Detail check", status: "APPROVED", total: 261, decisionComment: "Fine" });
    expect(r.items).toHaveLength(2);
    expect(r.items[0]).toMatchObject({ name: "A4 paper box", quantity: 2, unitPrice: 100.5 });
    expect(r.requester).toMatchObject({ id: ids[U1], name: "Ploy" });
    expect(r.approver).toMatchObject({ id: ids[APP_A], name: "Somchai" });
    expect(r.decidedAt).toBeTruthy();
    expect(r.history.map((h: any) => h.action)).toEqual(["CREATED", "SUBMITTED", "APPROVED"]);
    expect(r.history[2]).toMatchObject({ fromStatus: "PENDING", toStatus: "APPROVED", comment: "Fine", actor: { name: "Somchai" } });
  });

  it("TEST-37 / AC-29: the assigned approver can read the request", async () => {
    const owner = await loginAgent(U1);
    const pending = await createPending(owner, ids[APP_A], { title: "For Somchai" });
    const approver = await loginAgent(APP_A);
    const res = await approver.get(`/api/requests/${pending.id}`);
    expect(res.status).toBe(200);
    expect(res.body.request.title).toBe("For Somchai");
  });

  it("TEST-38 / AC-29: anyone else, including another approver, gets 404 and no data", async () => {
    const owner = await loginAgent(U1);
    const pending = await createPending(owner, ids[APP_A], { title: "Private title" });
    // Control: the owner can read it, so a 404 for the others is a real refusal and not a missing route.
    expect((await owner.get(`/api/requests/${pending.id}`)).status).toBe(200);
    for (const email of [U2, APP_B]) {
      const agent = await loginAgent(email);
      const res = await agent.get(`/api/requests/${pending.id}`);
      expect(res.status, email).toBe(404);
      expect(JSON.stringify(res.body)).not.toContain("Private title");
      expect(res.body.request).toBeUndefined();
    }
    expect((await (await loginAgent(U1)).get("/api/requests/abc")).status).toBe(404);
  });

  it("TEST-39 / AC-30: the review queue holds only the caller's PENDING requests", async () => {
    const owner = await loginAgent(U1);
    const mine = await createPending(owner, ids[APP_A], { title: "Waiting for A" });
    const decided = await createPending(owner, ids[APP_A], { title: "Already decided" });
    await createPending(owner, ids[APP_B], { title: "Waiting for B" });
    await createDraft(owner, { title: "Still a draft" });
    const approver = await loginAgent(APP_A);
    expect((await decide(approver, decided.id, "APPROVED", "ok")).status).toBe(200);

    const res = await approver.get("/api/reviews");
    expect(res.status).toBe(200);
    const queue = res.body.requests as { id: number; title: string; requester: { name: string } }[];
    const titles = queue.map((q) => q.title);
    expect(titles).toContain("Waiting for A");
    expect(titles).not.toContain("Waiting for B");
    expect(titles).not.toContain("Already decided");
    expect(titles).not.toContain("Still a draft");
    expect(queue.find((q) => q.id === mine.id)?.requester.name).toBe("Ploy");
  });

  it("TEST-40 / AC-30: an employee gets 403 and no data from the review queue", async () => {
    const employee = await loginAgent(U1);
    const res = await employee.get("/api/reviews");
    expect(res.status).toBe(403);
    expect(res.body.requests).toBeUndefined();
  });
});
