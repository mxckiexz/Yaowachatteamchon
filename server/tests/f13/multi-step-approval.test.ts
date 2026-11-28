import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { ORIGIN, cleanupUsers, createUser, loginAgent } from "../helpers/fixtures.js";
import { approve, cancel, createDraft, reject, submit } from "../helpers/requests.js";

const OWNER = "f13-owner@test.local";
const OTHER = "f13-other@test.local";
const APPROVER1 = "f13-approver1@test.local";
const APPROVER2 = "f13-approver2@test.local";
const APPROVER3 = "f13-approver3@test.local";
const APPROVER4 = "f13-approver4@test.local";
const APPROVER5 = "f13-approver5@test.local";
const APPROVER6 = "f13-approver6@test.local";
const ADMIN = "f13-admin@test.local";
const USERS = [OWNER, OTHER, APPROVER1, APPROVER2, APPROVER3, APPROVER4, APPROVER5, APPROVER6, ADMIN];
type Agent = ReturnType<typeof request.agent>;
let owner: Agent;
let other: Agent;
let approver1: Agent;
let approver2: Agent;
let approver3: Agent;
let admin: Agent;
const ids: Record<string, number> = {};

beforeAll(async () => {
  ids.owner = (await createUser(OWNER, { name: "F13 owner" })).id;
  ids.other = (await createUser(OTHER, { name: "F13 other" })).id;
  ids.approver1 = (await createUser(APPROVER1, { role: "APPROVER", name: "F13 approver one" })).id;
  ids.approver2 = (await createUser(APPROVER2, { role: "APPROVER", name: "F13 approver two" })).id;
  ids.approver3 = (await createUser(APPROVER3, { role: "APPROVER", name: "F13 approver three" })).id;
  ids.approver4 = (await createUser(APPROVER4, { role: "APPROVER", name: "F13 approver four" })).id;
  ids.approver5 = (await createUser(APPROVER5, { role: "APPROVER", name: "F13 approver five" })).id;
  ids.approver6 = (await createUser(APPROVER6, { role: "APPROVER", name: "F13 approver six" })).id;
  ids.admin = (await createUser(ADMIN, { role: "ADMIN", name: "F13 administrator" })).id;
  [owner, other, approver1, approver2, approver3, , , , admin] = await Promise.all(USERS.map((email) => loginAgent(email)));
  for (const id of [ids.approver1, ids.approver2, ids.approver3, ids.approver4, ids.approver5, ids.approver6]) {
    await admin.patch(`/api/admin/users/${id}`).set("Origin", ORIGIN).send({ role: "APPROVER", isActive: true });
  }
});

afterAll(async () => {
  await cleanupUsers(USERS);
  await getPrisma().$disconnect();
});

const putSteps = (agent: Agent, id: number, approverIds: unknown) => agent.put(`/api/requests/${id}/approval-steps`).set("Origin", ORIGIN).send({ approverIds });
const getSteps = (agent: Agent, id: number) => agent.get(`/api/requests/${id}/approval-steps`);
const detail = (agent: Agent, id: number) => agent.get(`/api/requests/${id}`).set("Origin", ORIGIN);

async function configure(id: number, idsToUse = [ids.approver1, ids.approver2]) {
  const result = await putSteps(admin, id, idsToUse);
  expect(result.status).toBe(200);
  return result.body.steps;
}

describe("F-13 multi-step approval", () => {
  it("TEST-232 / AC-201: administrator saves 1 to 5 ordered approvers", async () => {
    const draft = await createDraft(owner);
    const steps = await configure(draft.id, [ids.approver3, ids.approver1, ids.approver2]);
    expect(steps.map((s: any) => [s.stepNumber, s.approver.id])).toEqual([[1, ids.approver3], [2, ids.approver1], [3, ids.approver2]]);
  });

  it("TEST-233 / AC-202: only ADMIN configures and visible users can read steps", async () => {
    const draft = await createDraft(owner);
    await configure(draft.id);
    expect((await putSteps(owner, draft.id, [ids.approver1])).status).toBe(403);
    expect((await putSteps(approver1, draft.id, [ids.approver1])).status).toBe(403);
    expect((await request(app).put(`/api/requests/${draft.id}/approval-steps`).set("Origin", ORIGIN).send({ approverIds: [] })).status).toBe(401);
    expect((await getSteps(owner, draft.id)).status).toBe(200);
    expect((await getSteps(approver1, draft.id)).status).toBe(404);
    expect((await getSteps(other, draft.id)).status).toBe(404);
  });

  it("TEST-234 / AC-203: invalid arrays and ids return 422 without changing data", async () => {
    const draft = await createDraft(owner);
    await configure(draft.id, [ids.approver1]);
    for (const value of [null, "x", [ids.approver1, ids.approver1], [ids.owner], [999999], [ids.approver1, ids.approver2, ids.approver3, ids.approver4, ids.approver5, ids.approver6]]) {
      const response = await putSteps(admin, draft.id, value);
      expect(response.status).toBe(422);
      expect(response.body.fields).toHaveProperty("approverIds");
    }
    expect((await getSteps(owner, draft.id)).body.steps.map((s: any) => s.approver.id)).toEqual([ids.approver1]);
  });

  it("TEST-235 / AC-204: non-draft is 409 and an empty array clears a draft", async () => {
    const draft = await createDraft(owner);
    await configure(draft.id);
    expect((await putSteps(admin, draft.id, [])).status).toBe(200);
    expect((await getSteps(owner, draft.id)).body.steps).toEqual([]);
    const submitted = await createDraft(owner);
    await configure(submitted.id);
    await submit(owner, submitted.id);
    expect((await putSteps(admin, submitted.id, [])).status).toBe(409);
  });

  it("TEST-236 / AC-205: submit snapshots steps and rejects an inactive planned approver", async () => {
    const draft = await createDraft(owner);
    await configure(draft.id, [ids.approver1, ids.approver2]);
    expect((await submit(owner, draft.id)).status).toBe(200);
    expect((await getSteps(owner, draft.id)).body.steps.map((s: any) => s.status)).toEqual(["CURRENT", "WAITING"]);
    const blocked = await createDraft(owner);
    await configure(blocked.id, [ids.approver3]);
    expect((await admin.patch(`/api/admin/users/${ids.approver3}`).set("Origin", ORIGIN).send({ isActive: false })).status).toBe(200);
    expect((await submit(owner, blocked.id)).body.code).toBe("APPROVER_IN_USE");
    expect((await detail(owner, blocked.id)).body.request.status).toBe("DRAFT");
    await admin.patch(`/api/admin/users/${ids.approver3}`).set("Origin", ORIGIN).send({ isActive: true });
  });

  it("TEST-237 / AC-206: intermediate approval keeps SUBMITTED and advances one step", async () => {
    const submitted = await createDraft(owner);
    await configure(submitted.id, [ids.approver1, ids.approver2]);
    await submit(owner, submitted.id);
    expect((await approve(approver1, submitted.id, "Step one complete")).status).toBe(200);
    expect((await detail(owner, submitted.id)).body.request.status).toBe("SUBMITTED");
    expect((await getSteps(owner, submitted.id)).body.steps.map((s: any) => s.status)).toEqual(["APPROVED", "CURRENT"]);
  });

  it("TEST-238 / AC-207: only the current assigned approver may decide", async () => {
    const submitted = await createDraft(owner);
    await configure(submitted.id, [ids.approver1, ids.approver2]); await submit(owner, submitted.id);
    expect((await approve(approver2, submitted.id, "Wrong step")).status).toBe(403);
    expect((await approve(approver1, submitted.id, "Correct step")).status).toBe(200);
  });

  it("TEST-239 / AC-208: steps exclude requester and are distinct", async () => {
    const draft = await createDraft(owner);
    expect((await putSteps(admin, draft.id, [ids.owner])).status).toBe(422);
    expect((await putSteps(admin, draft.id, [ids.approver1, ids.approver1])).status).toBe(422);
  });

  it("TEST-240 / AC-209: final approval changes status only after every step", async () => {
    const submitted = await createDraft(owner); await configure(submitted.id); await submit(owner, submitted.id);
    await approve(approver1, submitted.id, "First");
    expect((await detail(owner, submitted.id)).body.request.status).toBe("SUBMITTED");
    expect((await approve(approver2, submitted.id, "Final")).status).toBe(200);
    expect((await detail(owner, submitted.id)).body.request.status).toBe("APPROVED");
  });

  it("TEST-241 / AC-210: rejection ends the chain and records the reason", async () => {
    const submitted = await createDraft(owner); await configure(submitted.id); await submit(owner, submitted.id);
    expect((await reject(approver1, submitted.id, "Not needed")).status).toBe(200);
    const result = await detail(owner, submitted.id);
    expect(result.body.request.status).toBe("REJECTED");
    expect(result.body.request.history.at(-1)).toMatchObject({ action: "REJECTED", comment: "Not needed" });
  });

  it("TEST-242 / AC-211: return resets steps and resubmit starts step one", async () => {
    const submitted = await createDraft(owner); await configure(submitted.id); await submit(owner, submitted.id);
    const returned = await approver1.post(`/api/requests/${submitted.id}/return`).set("Origin", ORIGIN).send({ reason: "Please correct this" });
    expect(returned.status).toBe(200);
    expect((await getSteps(owner, submitted.id)).body.steps.map((s: any) => s.status)).toEqual(["PLANNED", "PLANNED"]);
    expect((await submit(owner, submitted.id)).status).toBe(200);
    expect((await getSteps(owner, submitted.id)).body.steps.map((s: any) => s.status)).toEqual(["CURRENT", "WAITING"]);
  });

  it("TEST-243 / AC-212: cancel does not decide configured steps", async () => {
    const draft = await createDraft(owner); await configure(draft.id); expect((await cancel(owner, draft.id)).status).toBe(200);
    expect((await getSteps(owner, draft.id)).body.steps[0].status).toBe("PLANNED");
  });

  it("TEST-244 / AC-213: each step decision has one matching history row", async () => {
    const submitted = await createDraft(owner); await configure(submitted.id); await submit(owner, submitted.id);
    await approve(approver1, submitted.id, "First"); await approve(approver2, submitted.id, "Final");
    const history = (await detail(owner, submitted.id)).body.request.history;
    expect(history.filter((h: any) => h.action === "STEP_APPROVED")).toHaveLength(1);
    expect(history.filter((h: any) => h.action === "APPROVED")).toHaveLength(1);
  });

  it("TEST-245 / AC-214: concurrent decisions have one winner and one history row", async () => {
    const submitted = await createDraft(owner); await configure(submitted.id); await submit(owner, submitted.id);
    const [a, b] = await Promise.all([approve(approver1, submitted.id, "one"), approve(approver1, submitted.id, "two")]);
    expect([a.status, b.status].filter((status) => status === 200)).toHaveLength(1);
    expect((await getSteps(owner, submitted.id)).body.steps.filter((s: any) => s.status === "APPROVED")).toHaveLength(1);
  });

  it("TEST-246 / AC-215: history failure rolls back the step decision", async () => {
    const submitted = await createDraft(owner); await configure(submitted.id); await submit(owner, submitted.id);
    const prisma = getPrisma();
    await prisma.$executeRawUnsafe("CREATE OR REPLACE FUNCTION f13_fail_history() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced f13 history failure'; END $$");
    await prisma.$executeRawUnsafe(`CREATE TRIGGER f13_fail_history BEFORE INSERT ON "RequestHistory" FOR EACH ROW WHEN (NEW."requestId" = ${submitted.id}) EXECUTE FUNCTION f13_fail_history()`);
    try { expect((await approve(approver1, submitted.id, "will fail")).status).toBe(500); }
    finally { await prisma.$executeRawUnsafe('DROP TRIGGER IF EXISTS f13_fail_history ON "RequestHistory"'); await prisma.$executeRawUnsafe("DROP FUNCTION IF EXISTS f13_fail_history()"); }
    expect((await detail(owner, submitted.id)).body.request.status).toBe("SUBMITTED");
    expect((await getSteps(owner, submitted.id)).body.steps[0].status).toBe("CURRENT");
  });

  it("TEST-247 / AC-216: detail includes exact approvalSteps while lists remain summaries", async () => {
    const submitted = await createDraft(owner); await configure(submitted.id); await submit(owner, submitted.id);
    const body = (await detail(owner, submitted.id)).body.request;
    expect(Object.keys(body.approvalSteps[0]).sort()).toEqual(["approver", "decidedAt", "decisionComment", "id", "status", "stepNumber"]);
    const list = await owner.get("/api/requests?scope=mine");
    expect(list.body.requests[0]).not.toHaveProperty("approvalSteps");
  });

  it("TEST-251 / AC-220: a request without a chain keeps legacy approval behavior", async () => {
    const submitted = await createDraft(owner);
    await submit(owner, submitted.id);
    expect((await approve(approver2, submitted.id, "Legacy approval")).status).toBe(200);
    expect((await detail(owner, submitted.id)).body.request.status).toBe("APPROVED");
  });

  it("TEST-252 / AC-221: current/waiting approvers are protected only while submitted", async () => {
    await getPrisma().purchaseRequest.deleteMany({ where: { requesterId: ids.owner } });
    const submitted = await createDraft(owner); await configure(submitted.id); await submit(owner, submitted.id);
    expect((await admin.patch(`/api/admin/users/${ids.approver1}`).set("Origin", ORIGIN).send({ isActive: false })).status).toBe(409);
    expect((await admin.patch(`/api/admin/users/${ids.approver2}`).set("Origin", ORIGIN).send({ role: "REQUESTER" })).status).toBe(409);
    await admin.patch(`/api/admin/users/${ids.approver2}`).set("Origin", ORIGIN).send({ role: "APPROVER" });
    await approve(approver1, submitted.id, "First"); await approve(approver2, submitted.id, "Final");
    expect((await admin.patch(`/api/admin/users/${ids.approver1}`).set("Origin", ORIGIN).send({ isActive: false })).status).toBe(200);
    await admin.patch(`/api/admin/users/${ids.approver1}`).set("Origin", ORIGIN).send({ isActive: true });
  });
});
