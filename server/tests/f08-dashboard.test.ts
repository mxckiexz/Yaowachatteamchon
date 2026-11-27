import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../src/app.js";
import { getPrisma } from "../src/prisma.js";
import { cleanupUsers, createUser, loginAgent, ORIGIN } from "./helpers/fixtures.js";
import { createDraft, createSubmitted } from "./helpers/requests.js";

const OWNER = "f08-owner@test.local";
const OTHER = "f08-other@test.local";
const APPROVER = "f08-approver@test.local";
const ADMIN = "f08-admin@test.local";
const USERS = [OWNER, OTHER, APPROVER, ADMIN];

beforeAll(async () => {
  await createUser(OWNER, { name: "F08 owner" });
  await createUser(OTHER, { name: "F08 other" });
  await createUser(APPROVER, { role: "APPROVER", name: "F08 approver" });
  await createUser(ADMIN, { role: "ADMIN", name: "F08 admin" });
});

afterAll(async () => {
  await cleanupUsers(USERS);
  await getPrisma().$disconnect();
});

describe("F-08 dashboard", () => {
  it("TEST-132 / AC-100: requester receives only own status counts", async () => {
    const owner = await loginAgent(OWNER);
    const own = await createDraft(owner, { itemName: "F08 own dashboard" });
    await createDraft(await loginAgent(OTHER), { itemName: "F08 other dashboard" });
    const response = await owner.get("/api/dashboard").expect(200);
    expect(response.body).toEqual({ counts: { DRAFT: 1, SUBMITTED: 0, APPROVED: 0, REJECTED: 0, CANCELLED: 0 } });
    expect(own.id).toBeGreaterThan(0);
  });

  it("TEST-134 / AC-102: approver gets own counts and review waiting", async () => {
    const approver = await loginAgent(APPROVER);
    await createDraft(approver, { itemName: "F08 approver own" });
    await createSubmitted(await loginAgent(OTHER), { itemName: "F08 waiting" });
    const response = await approver.get("/api/dashboard").expect(200);
    expect(response.body.counts.DRAFT).toBe(1);
    expect(response.body.reviewWaiting).toBeGreaterThanOrEqual(1);
    expect(response.body).not.toHaveProperty("requests");
  });

  it("TEST-135 / AC-103: administrator counts match database groupBy", async () => {
    const admin = await loginAgent(ADMIN);
    const grouped = await getPrisma().purchaseRequest.groupBy({ by: ["status"], _count: { _all: true } });
    const expected = Object.fromEntries(["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"].map((status) => [status, grouped.find((row) => row.status === status)?._count._all ?? 0]));
    const response = await admin.get("/api/dashboard").expect(200);
    expect(response.body).toEqual({ counts: expected });
  });

  it("TEST-137 / AC-105: anonymous access returns 401 without data", async () => {
    const response = await request(app).get("/api/dashboard").set("Origin", ORIGIN).expect(401);
    expect(response.body).not.toHaveProperty("counts");
    expect(response.body).not.toHaveProperty("requests");
  });

  it("TEST-138 / AC-106: response contains counts only for requester", async () => {
    const response = await (await loginAgent(OWNER)).get("/api/dashboard").expect(200);
    expect(Object.keys(response.body)).toEqual(["counts"]);
    expect(response.body.counts).not.toHaveProperty("requests");
  });
});
