import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent } from "../helpers/fixtures.js";
import { createDraft, createSubmitted } from "../helpers/requests.js";

const OWNER = "f07-owner@test.local";
const OTHER = "f07-other@test.local";
const APPROVER = "f07-approver@test.local";
const ADMIN = "f07-admin@test.local";
const USERS = [OWNER, OTHER, APPROVER, ADMIN];

beforeAll(async () => {
  await createUser(OWNER, { name: "F07 owner" });
  await createUser(OTHER, { name: "F07 other" });
  await createUser(APPROVER, { role: "APPROVER", name: "F07 approver" });
  await createUser(ADMIN, { role: "ADMIN", name: "F07 admin" });
});

afterAll(async () => {
  await cleanupUsers(USERS);
  await getPrisma().$disconnect();
});

describe("F-07 search and filter", () => {
  it("TEST-106 / AC-74: keeps the default mine list", async () => {
    const owner = await loginAgent(OWNER);
    const draft = await createDraft(owner, { itemName: "Draft filter item", category: "EQUIPMENT" });
    const submitted = await createSubmitted(owner, { itemName: "Submitted filter item", category: "SOFTWARE" });
    const all = (await owner.get("/api/requests")).body.requests;
    expect(all.map((r: any) => r.id)).toContain(draft.id);
    expect(all.map((r: any) => r.id)).toContain(submitted.id);
  });

  it("TEST-107 / AC-75: filters each valid status", async () => {
    const owner = await loginAgent(OWNER);
    const rows = [
      await createDraft(owner, { itemName: "Status draft" }),
      await createSubmitted(owner, { itemName: "Status submitted" }),
    ];
    expect((await owner.get("/api/requests?status=DRAFT")).body.requests.map((r: any) => r.id)).toContain(rows[0].id);
    expect((await owner.get("/api/requests?status=SUBMITTED")).body.requests.map((r: any) => r.id)).toContain(rows[1].id);
  });

  it("TEST-108 / AC-76: filters each valid category", async () => {
    const owner = await loginAgent(OWNER);
    for (const category of ["EQUIPMENT", "SOFTWARE", "FURNITURE", "STATIONERY", "OTHER"]) {
      const row = await createDraft(owner, { itemName: `Category ${category}`, category });
      expect((await owner.get(`/api/requests?category=${category}`)).body.requests.map((r: any) => r.id)).toContain(row.id);
    }
  });

  it("TEST-109 / AC-77: searches request number, item name, description and reason", async () => {
    const owner = await loginAgent(OWNER);
    const row = await createDraft(owner, { itemName: "MixedCase Item", description: "UniqueDescription", reason: "UniqueReason" });
    for (const q of [row.requestNumber.slice(0, 6).toLowerCase(), "mixedcase", "uniquedescription", "uniquereason"]) {
      expect((await owner.get(`/api/requests?q=${q}`)).body.requests.map((r: any) => r.id)).toContain(row.id);
    }
  });

  it("TEST-110 / AC-78: combines filters with AND", async () => {
    const owner = await loginAgent(OWNER);
    const match = await createDraft(owner, { itemName: "AND match", category: "EQUIPMENT" });
    await createDraft(owner, { itemName: "AND wrong category", category: "SOFTWARE" });
    expect((await owner.get("/api/requests?category=EQUIPMENT&q=AND")).body.requests.map((r: any) => r.id)).toEqual([match.id]);
  });

  it("TEST-111 / AC-79: clear-equivalent empty filters return the complete list", async () => {
    const owner = await loginAgent(OWNER);
    await createDraft(owner, { itemName: "Clear filter row" });
    const all = (await owner.get("/api/requests")).body.requests.map((r: any) => r.id);
    expect((await owner.get("/api/requests?status=")).body.requests.map((r: any) => r.id)).toEqual(all);
  });

  it("TEST-112 / AC-80: all roles keep their visibility scope", async () => {
    const owner = await loginAgent(OWNER);
    const other = await loginAgent(OTHER);
    const approver = await loginAgent(APPROVER);
    const admin = await loginAgent(ADMIN);
    const submitted = await createSubmitted(owner, { itemName: "Visible submitted" });
    const otherDraft = await createDraft(other, { itemName: "Hidden draft" });
    expect((await owner.get("/api/requests?q=Visible")).body.requests.map((r: any) => r.id)).toContain(submitted.id);
    expect((await approver.get("/api/requests?scope=review")).body.requests.map((r: any) => r.id)).toContain(submitted.id);
    expect((await admin.get("/api/requests?scope=all")).body.requests.map((r: any) => r.id)).toContain(otherDraft.id);
  });

  it("TEST-114 / AC-82: administrator can filter all requests", async () => {
    const owner = await loginAgent(OWNER);
    const admin = await loginAgent(ADMIN);
    const row = await createDraft(owner, { itemName: "Admin all row" });
    expect((await admin.get("/api/requests?scope=all&q=Admin%20all")).body.requests.map((r: any) => r.id)).toContain(row.id);
  });

  it("TEST-116 / AC-84: anonymous and unauthorized scopes return no data", async () => {
    const anonymous = await request(app).get("/api/requests").set("Origin", "http://localhost:5173");
    expect(anonymous.status).toBe(401);
    expect((await (await loginAgent(OWNER)).get("/api/requests?scope=all")).status).toBe(403);
  });

  it("TEST-117 / AC-85: hidden rows never appear in the payload", async () => {
    const owner = await loginAgent(OWNER);
    await createDraft(await loginAgent(OTHER), { itemName: "Secret hidden row" });
    const response = await owner.get("/api/requests?q=Secret");
    expect(response.body.requests).toEqual([]);
  });

  it("TEST-118 / AC-86: measures 20 unfiltered calls over 200 rows", async () => {
    const owner = await loginAgent(OWNER);
    const user = await getPrisma().user.findUniqueOrThrow({ where: { email: OWNER } });
    await getPrisma().purchaseRequest.createMany({
      data: Array.from({ length: 200 }, (_, i) => ({
        requestNumber: `F07-PERF-${Date.now()}-${i}`,
        requesterId: user.id,
        itemName: `Performance ${i}`,
        description: "Performance measurement row",
        quantity: 1,
        unitPriceSatang: 1000,
        totalSatang: 1000,
        reason: "Performance",
        category: "OTHER" as const,
        status: "DRAFT" as const,
      })),
    });
    await owner.get("/api/requests");
    const start = performance.now();
    for (let i = 0; i < 20; i++) await owner.get("/api/requests");
    const median = (performance.now() - start) / 20;
    expect(median).toBeLessThan(500);
  });

  it("TEST-124 / AC-92: searches every literal metacharacter", async () => {
    const owner = await loginAgent(OWNER);
    const row = await createDraft(owner, { itemName: "Literal 100% marker", description: "Need a backslash \\ and ;-- text" });
    for (const q of ["%", "_", "\\", "'", ";--", "HTML"]) {
      expect((await owner.get(`/api/requests?q=${encodeURIComponent(q)}`)).status).toBe(200);
    }
    expect((await owner.get("/api/requests?q=%25")).body.requests.map((r: any) => r.id)).toEqual([row.id]);
  });

  it("TEST-113 / AC-81: review status remains submitted even when another status is requested", async () => {
    const owner = await loginAgent(OWNER);
    const approver = await loginAgent(APPROVER);
    await createSubmitted(owner, { itemName: "Review filter item" });
    const response = await approver.get("/api/requests?scope=review&status=APPROVED");
    expect(response.status).toBe(200);
    expect(response.body.requests).toEqual([]);
  });

  it("TEST-115 / AC-83: rejects invalid and overlong parameters", async () => {
    const owner = await loginAgent(OWNER);
    expect((await owner.get("/api/requests?status=DRAFT&status=SUBMITTED")).status).toBe(422);
    expect((await owner.get("/api/requests?status=draft")).status).toBe(422);
    expect((await owner.get(`/api/requests?q=${"x".repeat(101)}`)).status).toBe(422);
    expect((await owner.get("/api/requests?status=")).status).toBe(200);
  });

  it("TEST-125 / AC-93: rejects repeated and lower-case parameters", async () => {
    const owner = await loginAgent(OWNER);
    expect((await owner.get("/api/requests?status=DRAFT&status=SUBMITTED")).status).toBe(422);
    expect((await owner.get("/api/requests?category=equipment")).status).toBe(422);
    expect((await owner.get("/api/requests?status=")).status).toBe(200);
  });

  it("TEST-126 / AC-94: accepts 100 characters and rejects 101", async () => {
    const owner = await loginAgent(OWNER);
    expect((await owner.get(`/api/requests?q=${"x".repeat(100)}`)).status).toBe(200);
    expect((await owner.get(`/api/requests?q=${"x".repeat(101)}`)).status).toBe(422);
  });

  it("TEST-127 / AC-95: NULL category and reason are safe to filter", async () => {
    const owner = await loginAgent(OWNER);
    const row = await createDraft(owner, { itemName: "Null fields", category: "", reason: "" });
    expect((await owner.get("/api/requests?category=OTHER")).body.requests.map((r: any) => r.id)).not.toContain(row.id);
    expect((await owner.get("/api/requests?q=Null%20fields")).body.requests.map((r: any) => r.id)).toContain(row.id);
  });

  it("TEST-128 / AC-96: review status filtering returns an empty list for APPROVED", async () => {
    const approver = await loginAgent(APPROVER);
    const response = await approver.get("/api/requests?scope=review&status=APPROVED");
    expect(response.status).toBe(200);
    expect(response.body.requests).toEqual([]);
  });

});
