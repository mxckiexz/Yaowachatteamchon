import { afterAll, beforeAll, describe, expect, it } from "vitest";
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
  it("TEST-106 / AC-74: keeps the default mine list and filters by status/category", async () => {
    const owner = await loginAgent(OWNER);
    const draft = await createDraft(owner, { itemName: "Draft filter item", category: "EQUIPMENT" });
    const submitted = await createSubmitted(owner, { itemName: "Submitted filter item", category: "SOFTWARE" });
    const all = (await owner.get("/api/requests")).body.requests;
    expect(all.map((r: any) => r.id)).toContain(draft.id);
    expect(all.map((r: any) => r.id)).toContain(submitted.id);
    expect((await owner.get("/api/requests?status=SUBMITTED")).body.requests.map((r: any) => r.id)).toEqual([submitted.id]);
    expect((await owner.get("/api/requests?category=EQUIPMENT")).body.requests.map((r: any) => r.id)).toEqual([draft.id]);
  });

  it("TEST-109 / AC-77 and TEST-124 / AC-92: searches literal text case-insensitively", async () => {
    const owner = await loginAgent(OWNER);
    const row = await createDraft(owner, { itemName: "Literal 100% marker", description: "Need a backslash \\ and ;-- text" });
    const percent = await owner.get("/api/requests?q=%");
    expect(percent.status).toBe(200);
    expect(percent.body.requests.map((r: any) => r.id)).toEqual([row.id]);
    expect((await owner.get("/api/requests?q=LITERAL")).body.requests.map((r: any) => r.id)).toContain(row.id);
  });

  it("TEST-113 / AC-81: review status remains submitted even when another status is requested", async () => {
    const owner = await loginAgent(OWNER);
    const approver = await loginAgent(APPROVER);
    await createSubmitted(owner, { itemName: "Review filter item" });
    const response = await approver.get("/api/requests?scope=review&status=APPROVED");
    expect(response.status).toBe(200);
    expect(response.body.requests).toEqual([]);
  });

  it("TEST-115 / AC-83 and TEST-125 / AC-93: rejects repeated, invalid and overlong parameters", async () => {
    const owner = await loginAgent(OWNER);
    expect((await owner.get("/api/requests?status=DRAFT&status=SUBMITTED")).status).toBe(422);
    expect((await owner.get("/api/requests?status=draft")).status).toBe(422);
    expect((await owner.get(`/api/requests?q=${"x".repeat(101)}`)).status).toBe(422);
    expect((await owner.get("/api/requests?status=")).status).toBe(200);
  });

  it("TEST-112 / AC-80: filtering does not bypass visibility", async () => {
    const owner = await loginAgent(OWNER);
    const other = await loginAgent(OTHER);
    const own = await createDraft(owner, { itemName: "Private owner row" });
    await createDraft(other, { itemName: "Private other row" });
    const mine = await owner.get("/api/requests?q=Private");
    expect(mine.body.requests.map((r: any) => r.id)).toEqual([own.id]);
    expect((await owner.get("/api/requests?scope=all")).status).toBe(403);
  });
});
