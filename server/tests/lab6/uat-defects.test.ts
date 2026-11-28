// Regression tests for the defects found by the partner team's independent Sprint 1 UAT (Lab 6).
//   DEF-02 (#68): invisible zero-width characters passed the "required" and "at least 5 characters" rules.
//   DEF-03 (#69): a user promoted to ADMIN could still edit and submit a draft created before the promotion.
// DEF-01 (#67) is a layout defect: see client/tests/requests/uat-defects.test.tsx and e2e/quality/long-item-name.spec.ts.
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, loginAgent, ORIGIN } from "../helpers/fixtures.js";
import { createBody, createDraft, createSubmitted, loadRequest, reject, submit } from "../helpers/requests.js";

const REQ = "lab6-req@test.local";
const APP = "lab6-app@test.local";
const PROMOTED = "lab6-promoted@test.local";
const ALL = [REQ, APP, PROMOTED];
const ids: Record<string, number> = {};

// The invisible format characters the partner reported, plus WORD JOINER.
const INVISIBLE = ["​", "‌", "‍", "﻿", "⁠"];

beforeAll(async () => {
  ids[REQ] = (await createUser(REQ, { role: "REQUESTER" })).id;
  ids[APP] = (await createUser(APP, { role: "APPROVER" })).id;
  ids[PROMOTED] = (await createUser(PROMOTED, { role: "REQUESTER" })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

const snapshot = async (id: number) => JSON.stringify(await loadRequest(id), (_k, v) => (typeof v === "bigint" ? v.toString() : v));
const count = (userId: number) => getPrisma().purchaseRequest.count({ where: { requesterId: userId } });
const post = (agent: any, body: unknown) => agent.post("/api/requests").set("Origin", ORIGIN).send(body);
const patch = (agent: any, id: number, body: unknown) => agent.patch(`/api/requests/${id}`).set("Origin", ORIGIN).send(body);

describe("DEF-02 (#68): zero-width characters do not count as text", () => {
  it("TEST-L6-01 / BR-01, BR-02: an item name or description made only of invisible characters is refused, and nothing is stored", async () => {
    const agent = await loginAgent(REQ);
    const before = await count(ids[REQ]);
    for (const ch of INVISIBLE) {
      const blank = ch.repeat(3);
      const name = await post(agent, createBody({ itemName: blank }));
      expect(name.status, `itemName U+${ch.charCodeAt(0).toString(16)}`).toBe(422);
      expect(name.body.fields.itemName).toBeTruthy();
      const description = await post(agent, createBody({ description: ` ${blank} ` }));
      expect(description.status, `description U+${ch.charCodeAt(0).toString(16)}`).toBe(422);
      expect(description.body.fields.description).toBeTruthy();
    }
    expect(await count(ids[REQ])).toBe(before);
  });

  it("TEST-L6-02 / BR-01: invisible characters around real text are removed before storing; visible text is kept unchanged", async () => {
    const agent = await loginAgent(REQ);
    const created = await post(agent, createBody({ itemName: "​﻿ Laser printer ​", description: "Floor 2 ห้องประชุม 👍" }));
    expect(created.status).toBe(201);
    expect(created.body.request.itemName).toBe("Laser printer");
    expect(created.body.request.description).toBe("Floor 2 ห้องประชุม 👍");
  });

  it("TEST-L6-03 / BR-06: a reason made only of invisible characters is missing, so the draft cannot be submitted", async () => {
    const agent = await loginAgent(REQ);
    const draft = await createDraft(agent, { reason: "​".repeat(3) });
    const res = await submit(agent, draft.id);
    expect(res.status).toBe(422);
    expect(res.body.code).toBe("INCOMPLETE");
    expect(res.body.fields.reason).toBeTruthy();
    expect((await loadRequest(draft.id)).status).toBe("DRAFT");
  });

  it("TEST-L6-04 / BR-06: a stored reason of invisible characters (saved before this fix) also blocks the submit", async () => {
    const agent = await loginAgent(REQ);
    const draft = await createDraft(agent);
    await getPrisma().purchaseRequest.update({ where: { id: draft.id }, data: { reason: "​‌‍" } });
    const res = await submit(agent, draft.id);
    expect(res.status).toBe(422);
    expect(res.body.fields.reason).toBeTruthy();
  });

  it("TEST-L6-05 / BR-09: a rejection reason needs five visible characters; invisible ones are not counted", async () => {
    const requester = await loginAgent(REQ);
    const approver = await loginAgent(APP);
    const request = await createSubmitted(requester);
    for (const reason of ["​".repeat(5), "​".repeat(10), "ab​​cd"]) {
      const res = await reject(approver, request.id, reason);
      expect(res.status, JSON.stringify(reason)).toBe(422);
      expect(res.body.code).toBe("REASON_REQUIRED");
    }
    expect((await loadRequest(request.id)).status).toBe("SUBMITTED");
    const ok = await reject(approver, request.id, "​Over budget​");
    expect(ok.status).toBe(200);
    expect(ok.body.request.rejectionReason).toBe("Over budget");
  });
});

describe("DEF-03 (#69): an administrator cannot edit or submit, even a draft created before the promotion", () => {
  it("TEST-L6-06 / AC-17, BR-18: after promotion to ADMIN, PATCH and submit of the user's own draft return 404 and change nothing", async () => {
    const asRequester = await loginAgent(PROMOTED);
    const draft = await createDraft(asRequester);
    await getPrisma().user.update({ where: { id: ids[PROMOTED] }, data: { role: "ADMIN" } });
    try {
      const asAdmin = await loginAgent(PROMOTED);
      const before = await snapshot(draft.id);

      const edit = await patch(asAdmin, draft.id, { itemName: "Edited by an administrator" });
      expect(edit.status).toBe(404);
      const sent = await submit(asAdmin, draft.id);
      expect(sent.status).toBe(404);
      // The session from before the promotion is refused as well: the role is read from the database.
      expect((await patch(asRequester, draft.id, { itemName: "Old session" })).status).toBe(404);
      expect((await submit(asRequester, draft.id)).status).toBe(404);

      expect(await snapshot(draft.id)).toBe(before);
      // Reading is still allowed: the administrator has read-only access to all requests.
      expect((await asAdmin.get(`/api/requests/${draft.id}`)).status).toBe(200);
    } finally {
      await getPrisma().user.update({ where: { id: ids[PROMOTED] }, data: { role: "REQUESTER" } });
    }
  });

  it("TEST-L6-07 / BR-18: demoted back to REQUESTER, the owner can edit and submit the same draft again", async () => {
    const agent = await loginAgent(PROMOTED);
    const draft = await createDraft(agent);
    expect((await patch(agent, draft.id, { itemName: "Edited by the owner" })).status).toBe(200);
    expect((await submit(agent, draft.id)).status).toBe(200);
  });
});
