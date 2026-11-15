import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, FIXTURE_PASSWORD, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { approve, createBody, createDraft, createSubmitted, loadRequest, reject, submit } from "../helpers/requests.js";

const REQ = "q-req@test.local";
const REQ2 = "q-req2@test.local";
const APP = "q-app@test.local";
const ALL = [REQ, REQ2, APP];
let ids: Record<string, number> = {};

beforeAll(async () => {
  ids[REQ] = (await createUser(REQ, { role: "REQUESTER" })).id;
  ids[REQ2] = (await createUser(REQ2, { role: "REQUESTER" })).id;
  ids[APP] = (await createUser(APP, { role: "APPROVER" })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

const SQL_TEXTS = ["' OR '1'='1", "admin'--", '"; DROP TABLE "User";--', "Robert'); DROP TABLE \"PurchaseRequest\";--"];

describe("NFR-09 input is data (penetration-style checks, automated)", () => {
  it("TEST-80 / AC-45: SQL metacharacters never log anyone in, never cause a 500, and are stored unchanged", async () => {
    const prisma = getPrisma();
    const usersBefore = await prisma.user.count();
    for (const text of SQL_TEXTS) {
      const asEmail = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: text, password: FIXTURE_PASSWORD });
      expect(asEmail.status, `email ${text}`).toBe(401);
      const asPassword = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: REQ, password: text });
      expect(asPassword.status, `password ${text}`).toBe(401);
    }
    const agent = await loginAgent(REQ);
    const created = await agent
      .post("/api/requests")
      .set("Origin", ORIGIN)
      .send(createBody({ itemName: SQL_TEXTS[3], description: SQL_TEXTS[2], reason: "'; --" }));
    expect(created.status).toBe(201);
    const detail = await agent.get(`/api/requests/${created.body.request.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.request.itemName).toBe(SQL_TEXTS[3]);
    expect(detail.body.request.description).toBe(SQL_TEXTS[2]);
    expect(detail.body.request.reason).toBe("'; --");
    for (const id of ["1 OR 1=1", "1;DROP TABLE x", "-1", "9999999999999"]) {
      const res = await agent.get(`/api/requests/${encodeURIComponent(id)}`);
      expect(res.status, `id ${id}`).toBe(404);
    }
    expect(await prisma.user.count()).toBe(usersBefore);
    expect(await prisma.purchaseRequest.count({ where: { requesterId: ids[REQ], itemName: SQL_TEXTS[3] } })).toBe(1);
  });

  it("TEST-81 / AC-46: fields owned by the server cannot be set by the client", async () => {
    const agent = await loginAgent(REQ);
    const extras = { status: "APPROVED", requesterId: ids[REQ2], totalSatang: 1, total: 1, id: 1, requestNumber: "PR-0000-0000", decidedAt: new Date().toISOString(), rejectionReason: "pre-rejected" };
    const created = await agent.post("/api/requests").set("Origin", ORIGIN).send(createBody({ ...extras }));
    expect(created.status).toBe(201);
    const r = created.body.request;
    expect(r).toMatchObject({ status: "DRAFT", total: 201, decidedAt: null, rejectionReason: null });
    expect(r.requester.id).toBe(ids[REQ]);
    expect(r.id).not.toBe(1);
    expect(r.requestNumber).not.toBe("PR-0000-0000");

    const edited = await agent.patch(`/api/requests/${r.id}`).set("Origin", ORIGIN).send({ itemName: "Edited", ...extras });
    expect(edited.status).toBe(200);
    expect(edited.body.request).toMatchObject({ itemName: "Edited", status: "DRAFT", total: 201 });
    expect(edited.body.request.requester.id).toBe(ids[REQ]);

    const submitted = await agent.post(`/api/requests/${r.id}/submit`).set("Origin", ORIGIN).send({ status: "APPROVED", requesterId: ids[REQ2] });
    expect(submitted.status).toBe(200);
    expect(submitted.body.request.status).toBe("SUBMITTED");

    const approver = await loginAgent(APP);
    const rejected = await approver
      .post(`/api/requests/${r.id}/reject`)
      .set("Origin", ORIGIN)
      .send({ reason: "Not needed", status: "APPROVED", requesterId: ids[APP] });
    expect(rejected.status).toBe(200);
    expect(rejected.body.request.status).toBe("REJECTED");
    expect((await loadRequest(r.id)).requesterId).toBe(ids[REQ]);
  });

  it("TEST-82 / AC-47: forged session cookies get 401 on protected routes and never a 500", async () => {
    const forged = ["", "00000000-0000-0000-0000-000000000000", "x".repeat(5000), encodeURIComponent("' OR 1=1--"), "%00%00"];
    const routes = ["/api/auth/me", "/api/requests", "/api/requests/1", "/api/requests?scope=review", "/api/admin/users"];
    for (const value of forged) {
      for (const route of routes) {
        const res = await request(app).get(route).set("Cookie", `purchaseflow_session=${value}`);
        expect(res.status, `${route} with cookie ${value.slice(0, 20)}`).toBe(401);
      }
    }
  });

  it("TEST-83 / AC-48: an oversized body gives 413 and a JSON error without a stack", async () => {
    const agent = await loginAgent(REQ);
    const res = await agent.post("/api/requests").set("Origin", ORIGIN).send(createBody({ description: "x".repeat(200 * 1024) }));
    expect(res.status).toBe(413);
    expect(typeof res.body.error).toBe("string");
    expect(JSON.stringify(res.body)).not.toMatch(/\bat \S+ \(|node_modules|\.ts:\d+/);
  });

  it("TEST-84 / AC-49: the session cookie is HttpOnly, SameSite=Lax, Path=/ and lasts 8 hours", async () => {
    const res = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: REQ, password: FIXTURE_PASSWORD });
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toMatch(/HttpOnly/i);
    expect(cookie).toMatch(/SameSite=Lax/i);
    expect(cookie).toMatch(/Path=\//);
    const expires = new Date(cookie.match(/Expires=([^;]+)/i)![1]).getTime();
    const hours = (expires - Date.now()) / 3_600_000;
    expect(hours).toBeGreaterThan(7.9);
    expect(hours).toBeLessThan(8.1);
  });

  it("TEST-85 / AC-50: no technology header, and the basic protective headers are sent", async () => {
    for (const res of [await request(app).get("/api/health"), await request(app).get("/api/requests")]) {
      expect(res.headers["x-powered-by"]).toBeUndefined();
      expect(res.headers["x-content-type-options"]).toBe("nosniff");
      expect(res.headers["x-frame-options"]).toBe("DENY");
      expect(res.headers["referrer-policy"]).toBe("no-referrer");
    }
  });
});

describe("AC-51 data side: HTML in text is stored as typed", () => {
  it("returns HTML text unchanged from the API (the UI escapes it, see TEST-86)", async () => {
    const agent = await loginAgent(REQ);
    const itemName = `<img src=x onerror="window.__xss=1">`;
    const draft = await createDraft(agent, { itemName });
    expect((await agent.get(`/api/requests/${draft.id}`)).body.request.itemName).toBe(itemName);
    const submitted = await createSubmitted(agent, { itemName: "For the reason check" });
    const html = "<script>window.__xss=2</script>";
    const res = await reject(await loginAgent(APP), submitted.id, html);
    expect(res.status).toBe(200);
    expect(res.body.request.rejectionReason).toBe(html);
  });
});
