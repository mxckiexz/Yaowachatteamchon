import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, FIXTURE_PASSWORD, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { createDraft, createPending, decide, SAMPLE_ITEMS } from "../helpers/requests.js";

const EMP = "q-emp@test.local";
const EMP2 = "q-emp2@test.local";
const APP = "q-app@test.local";
const ALL = [EMP, EMP2, APP];
let ids: Record<string, number> = {};

beforeAll(async () => {
  ids[EMP] = (await createUser(EMP, { role: "EMPLOYEE" })).id;
  ids[EMP2] = (await createUser(EMP2, { role: "EMPLOYEE" })).id;
  ids[APP] = (await createUser(APP, { role: "APPROVER" })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

const SQL_TEXTS = ["' OR '1'='1", "admin'--", '"; DROP TABLE "User";--', "Robert'); DROP TABLE \"PurchaseRequest\";--"];

describe("NFR-08 input is data (penetration-style checks, automated)", () => {
  it("TEST-50 / AC-35: SQL metacharacters never log anyone in, never cause a 500, and are stored unchanged", async () => {
    const prisma = getPrisma();
    const usersBefore = await prisma.user.count();
    for (const text of SQL_TEXTS) {
      const asEmail = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: text, password: FIXTURE_PASSWORD });
      expect(asEmail.status, `email ${text}`).toBe(401);
      const asPassword = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: EMP, password: text });
      expect(asPassword.status, `password ${text}`).toBe(401);
    }
    const agent = await loginAgent(EMP);
    const title = SQL_TEXTS[3];
    const created = await agent
      .post("/api/requests")
      .set("Origin", ORIGIN)
      .send({ title, justification: "'; --", items: [{ name: SQL_TEXTS[2], quantity: 1, unitPrice: 5 }] });
    expect(created.status).toBe(201);
    const detail = await agent.get(`/api/requests/${created.body.request.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.request.title).toBe(title);
    expect(detail.body.request.items[0].name).toBe(SQL_TEXTS[2]);
    for (const id of ["1 OR 1=1", "1;DROP TABLE x", "-1", "9999999999999"]) {
      const res = await agent.get(`/api/requests/${encodeURIComponent(id)}`);
      expect(res.status, `id ${id}`).toBe(404);
    }
    expect(await prisma.user.count()).toBe(usersBefore);
    expect(await prisma.purchaseRequest.count({ where: { requesterId: ids[EMP], title } })).toBe(1);
  });

  it("TEST-51 / AC-36: fields owned by the server cannot be set by the client", async () => {
    const agent = await loginAgent(EMP);
    const created = await agent.post("/api/requests").set("Origin", ORIGIN).send({
      title: "Mass assignment",
      items: SAMPLE_ITEMS,
      status: "APPROVED",
      requesterId: ids[EMP2],
      approverId: ids[APP],
      totalSatang: 1,
      total: 1,
      id: 1,
      decidedAt: new Date().toISOString(),
      decisionComment: "pre-approved",
    });
    expect(created.status).toBe(201);
    const r = created.body.request;
    expect(r).toMatchObject({ status: "DRAFT", total: 261, approver: null, decidedAt: null, decisionComment: null });
    expect(r.requester.id).toBe(ids[EMP]);
    expect(r.id).not.toBe(1);

    const submitted = await agent
      .post(`/api/requests/${r.id}/submit`)
      .set("Origin", ORIGIN)
      .send({ approverId: ids[APP], status: "APPROVED", requesterId: ids[EMP2] });
    expect(submitted.status).toBe(200);
    expect(submitted.body.request.status).toBe("PENDING");
    expect(submitted.body.request.requester.id).toBe(ids[EMP]);

    const approver = await loginAgent(APP);
    const decided = await approver
      .post(`/api/requests/${r.id}/decision`)
      .set("Origin", ORIGIN)
      .send({ decision: "REJECTED", comment: "Not needed", status: "APPROVED", approverId: ids[EMP] });
    expect(decided.status).toBe(200);
    expect(decided.body.request.status).toBe("REJECTED");
  });

  it("TEST-52 / AC-37: forged session cookies get 401 on every protected route and never a 500", async () => {
    const forged = ["", "00000000-0000-0000-0000-000000000000", "x".repeat(5000), encodeURIComponent("' OR 1=1--"), "%00%00"];
    const routes = ["/api/auth/me", "/api/approvers", "/api/requests", "/api/requests/1", "/api/reviews"];
    for (const value of forged) {
      for (const route of routes) {
        const res = await request(app).get(route).set("Cookie", `buyflow_session=${value}`);
        expect(res.status, `${route} with cookie ${value.slice(0, 20)}`).toBe(401);
      }
    }
  });

  it("TEST-53 / AC-38: an oversized body gives 413 and a JSON error without a stack", async () => {
    const agent = await loginAgent(EMP);
    const res = await agent
      .post("/api/requests")
      .set("Origin", ORIGIN)
      .send({ title: "Big", justification: "x".repeat(200 * 1024), items: SAMPLE_ITEMS });
    expect(res.status).toBe(413);
    expect(typeof res.body.error).toBe("string");
    expect(JSON.stringify(res.body)).not.toMatch(/\bat \S+ \(|node_modules|\.ts:\d+/);
  });

  it("TEST-54 / AC-39: the session cookie is HttpOnly, SameSite=Lax, Path=/ and lasts 8 hours", async () => {
    const res = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: EMP, password: FIXTURE_PASSWORD });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    const expires = new Date(cookie.match(/Expires=([^;]+)/i)![1]).getTime();
    const hours = (expires - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(7.9);
    expect(hours).toBeLessThan(8.1);
  });

  it("TEST-55 / AC-40: no technology header, and the basic protective headers are sent", async () => {
    for (const res of [await request(app).get("/api/health"), await request(app).get("/api/requests")]) {
      expect(res.headers["x-powered-by"]).toBeUndefined();
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["referrer-policy"]).toBe("no-referrer");
    }
  });
});

describe("AC-41 data side: HTML in text is stored as typed", () => {
  it("returns HTML text unchanged from the API (the UI escapes it, see TEST-56)", async () => {
    const agent = await loginAgent(EMP);
    const title = `<img src=x onerror="window.__xss=1">`;
    const draft = await createDraft(agent, { title });
    const detail = await agent.get(`/api/requests/${draft.id}`);
    expect(detail.body.request.title).toBe(title);
    const approver = await createPending(agent, ids[APP], { title: "For comment check" });
    const html = "<script>window.__xss=2</script>";
    const appAgent = await loginAgent(APP);
    const res = await decide(appAgent, approver.id, "REJECTED", html);
    expect(res.status).toBe(200);
    expect(res.body.request.decisionComment).toBe(html);
  });
});
