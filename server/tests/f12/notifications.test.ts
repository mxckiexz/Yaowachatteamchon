import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { ORIGIN, cleanupUsers, createUser, loginAgent } from "../helpers/fixtures.js";
import { approve, cancel, createDraft, createSubmitted, loadRequest, reject, submit } from "../helpers/requests.js";

const OWNER = "f12-owner@test.local";
const OTHER = "f12-other@test.local";
const APPROVER = "f12-approver@test.local";
const APPROVER2 = "f12-approver2@test.local";
const INACTIVE = "f12-inactive@test.local";
const ADMIN = "f12-admin@test.local";
const READER = "f12-reader@test.local";
const NEIGHBOUR = "f12-neighbour@test.local";
const USERS = [OWNER, OTHER, APPROVER, APPROVER2, INACTIVE, ADMIN, READER, NEIGHBOUR];

type Agent = ReturnType<typeof request.agent>;
let owner: Agent;
let other: Agent;
let approver: Agent;
let approver2: Agent;
let admin: Agent;
const ids: Record<string, number> = {};

beforeAll(async () => {
  ids.owner = (await createUser(OWNER, { name: "F12 owner" })).id;
  ids.other = (await createUser(OTHER, { name: "F12 other" })).id;
  ids.approver = (await createUser(APPROVER, { role: "APPROVER", name: "F12 approver" })).id;
  ids.approver2 = (await createUser(APPROVER2, { role: "APPROVER", name: "F12 approver two" })).id;
  ids.inactive = (await createUser(INACTIVE, { role: "APPROVER", name: "F12 inactive", isActive: false })).id;
  ids.admin = (await createUser(ADMIN, { role: "ADMIN", name: "F12 admin" })).id;
  ids.reader = (await createUser(READER, { name: "F12 reader" })).id;
  ids.neighbour = (await createUser(NEIGHBOUR, { name: "F12 neighbour" })).id;
  [owner, other, approver, approver2, admin] = await Promise.all(
    [OWNER, OTHER, APPROVER, APPROVER2, ADMIN].map((email) => loginAgent(email))
  );
});

afterAll(async () => {
  await getPrisma().user.updateMany({ where: { id: ids.approver2 }, data: { role: "APPROVER" } });
  await cleanupUsers(USERS);
  await getPrisma().$disconnect();
});

interface Note {
  id: number;
  type: string;
  createdAt: string;
  readAt: string | null;
  actor: { id: number; name: string };
  request: { id: number; requestNumber: string; itemName: string };
}

const rowsOf = (requestId: number) => getPrisma().notification.findMany({ where: { requestId }, orderBy: { id: "asc" } });
const allRows = () => getPrisma().notification.count();

const send = (agent: Agent, path: string, body: object = {}, origin = ORIGIN) => agent.post(path).set("Origin", origin).send(body);
const returnRequest = (agent: Agent, id: number, reason = "Please add the missing details") => send(agent, `/api/requests/${id}/return`, { reason });
const markOne = (agent: Agent, id: number | string, body: object = {}) => send(agent, `/api/notifications/${id}/read`, body);
const markAll = (agent: Agent) => send(agent, "/api/notifications/read-all");

async function list(agent: Agent) {
  const res = await agent.get("/api/notifications");
  expect(res.status).toBe(200);
  expect(Object.keys(res.body).sort()).toEqual(["notifications", "unreadCount"]);
  return res.body as { notifications: Note[]; unreadCount: number };
}

const forRequest = async (agent: Agent, requestId: number) => (await list(agent)).notifications.filter((n) => n.request.id === requestId);

const NOT_FOUND = { error: "Notification not found.", code: "NOT_FOUND" };
const FORBIDDEN = { error: "You do not have permission to perform this action.", code: "FORBIDDEN" };

// Inserts rows directly, for the tests that need more notifications than the workflow would create quickly.
async function insertRows(recipientId: number, requestId: number, count: number, readEvery = 0) {
  const base = Date.UTC(2026, 0, 1);
  await getPrisma().notification.createMany({
    data: Array.from({ length: count }, (_, i) => ({
      recipientId,
      requestId,
      actorId: ids.approver,
      type: "APPROVED" as const,
      // Every pair shares a time, so the order also depends on the id.
      createdAt: new Date(base + Math.floor(i / 2) * 60_000),
      readAt: readEvery > 0 && i % readEvery === 0 ? new Date(base) : null,
    })),
  });
}

// A real database failure: every insert of a notification for this request raises, so the transaction must roll back.
async function withFailingNotificationInsert(requestId: number, run: () => Promise<void>) {
  const prisma = getPrisma();
  const id = Number(requestId);
  await prisma.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION f12_fail_insert() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced notification failure'; END $$`
  );
  await prisma.$executeRawUnsafe(
    `CREATE TRIGGER f12_fail_insert BEFORE INSERT ON "Notification" FOR EACH ROW WHEN (NEW."requestId" = ${id}) EXECUTE FUNCTION f12_fail_insert()`
  );
  try {
    await run();
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS f12_fail_insert ON "Notification"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS f12_fail_insert()`);
  }
}

// A failure at commit time, after everything in the transaction was written. A notification written outside
// that transaction would survive it, so this proves BR-27 and not only that an insert error is passed on.
// The response is not checked here: Prisma 5.22 does not report a failed COMMIT of an interactive transaction
// (known limitation of every route, recorded in the Sprint 2 results). Only what is stored matters.
async function withFailingCommit(requestId: number, run: () => Promise<void>) {
  const prisma = getPrisma();
  const id = Number(requestId);
  await prisma.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION f12_fail_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'forced commit failure'; END $$`
  );
  await prisma.$executeRawUnsafe(
    `CREATE CONSTRAINT TRIGGER f12_fail_commit AFTER UPDATE ON "PurchaseRequest" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW."id" = ${id}) EXECUTE FUNCTION f12_fail_commit()`
  );
  try {
    await run();
  } finally {
    await prisma.$executeRawUnsafe(`DROP TRIGGER IF EXISTS f12_fail_commit ON "PurchaseRequest"`);
    await prisma.$executeRawUnsafe(`DROP FUNCTION IF EXISTS f12_fail_commit()`);
  }
}

describe("F-12 in-app notifications API", () => {
  it("TEST-211 / AC-180: a submit notifies exactly the active approvers", async () => {
    const created = await createSubmitted(owner);
    const rows = await rowsOf(created.id);
    const expected = await getPrisma().user.findMany({ where: { role: "APPROVER", isActive: true, id: { not: ids.owner } }, select: { id: true } });
    expect(rows.map((r) => r.recipientId).sort((a, b) => a - b)).toEqual(expected.map((u) => u.id).sort((a, b) => a - b));
    expect(rows.every((r) => r.type === "SUBMITTED" && r.actorId === ids.owner && r.readAt === null)).toBe(true);
    const recipients = rows.map((r) => r.recipientId);
    expect(recipients).toContain(ids.approver);
    expect(recipients).toContain(ids.approver2);
    for (const id of [ids.inactive, ids.other, ids.admin, ids.owner]) expect(recipients).not.toContain(id);
  });

  it("TEST-212 / AC-181: an approver who submits is not notified, the other approvers are", async () => {
    const created = await createSubmitted(approver);
    const recipients = (await rowsOf(created.id)).map((r) => r.recipientId);
    expect(recipients).toContain(ids.approver2);
    expect(recipients).not.toContain(ids.approver);
  });

  it("TEST-213 / AC-182: a decision notifies the requester once", async () => {
    for (const [decide, type] of [
      [(id: number) => approve(approver, id, "Looks good"), "APPROVED"],
      [(id: number) => reject(approver, id, "Not needed now"), "REJECTED"],
    ] as const) {
      const created = await createSubmitted(owner);
      expect((await decide(created.id)).status).toBe(200);
      const mine = (await rowsOf(created.id)).filter((r) => r.type !== "SUBMITTED");
      expect(mine).toHaveLength(1);
      expect(mine[0]).toMatchObject({ recipientId: ids.owner, actorId: ids.approver, type, readAt: null });
    }
  });

  it("TEST-214 / AC-183: a return notifies the requester, and a new submit notifies the approvers again", async () => {
    const created = await createSubmitted(owner);
    const first = (await rowsOf(created.id)).length;
    expect((await returnRequest(approver, created.id)).status).toBe(200);
    const afterReturn = (await rowsOf(created.id)).slice(first);
    expect(afterReturn).toHaveLength(1);
    expect(afterReturn[0]).toMatchObject({ recipientId: ids.owner, actorId: ids.approver, type: "RETURNED" });
    expect((await submit(owner, created.id)).status).toBe(200);
    const again = (await rowsOf(created.id)).slice(first + 1);
    expect(again).toHaveLength(first);
    expect(again.every((r) => r.type === "SUBMITTED" && r.actorId === ids.owner)).toBe(true);
  });

  it("TEST-215 / AC-184: a refused or invalid change creates no notification", async () => {
    const draft = await createDraft(owner, { reason: "", category: "" });
    expect((await submit(owner, draft.id)).status).toBe(422);
    expect(await rowsOf(draft.id)).toHaveLength(0);

    const created = await createSubmitted(owner);
    const own = await createSubmitted(approver);
    const decided = await createSubmitted(owner);
    expect((await approve(approver, decided.id)).status).toBe(200);
    const count = async () => [(await rowsOf(created.id)).length, (await rowsOf(own.id)).length, (await rowsOf(decided.id)).length];
    const before = await count();

    const refused: [string, number, number][] = [
      ["second submit", (await submit(owner, created.id)).status, 409],
      ["self-approval", (await approve(approver, own.id)).status, 403],
      ["decision on a decided request", (await reject(approver2, decided.id, "Too late now")).status, 409],
      ["rejection with a short reason", (await reject(approver, created.id, "no")).status, 422],
      ["return with a short reason", (await returnRequest(approver, created.id, "no")).status, 422],
      ["approve by a requester", (await approve(other, created.id)).status, 403],
      ["return by an administrator", (await returnRequest(admin, created.id)).status, 403],
      ["submit by another user", (await submit(other, created.id)).status, 404],
    ];
    for (const [name, status, expected] of refused) expect([name, status]).toEqual([name, expected]);
    expect(await count()).toEqual(before);
  });

  it("TEST-216 / AC-185: of simultaneous changes only the winner notifies", async () => {
    const outcomeRows = async (requestId: number) => (await rowsOf(requestId)).filter((r) => r.type !== "SUBMITTED");
    for (let round = 0; round < 5; round++) {
      const a = await createSubmitted(owner);
      const [yes, no] = await Promise.all([approve(approver, a.id, "ok"), reject(approver2, a.id, "Not needed now")]);
      expect([yes.status, no.status].filter((s) => s === 200)).toHaveLength(1);
      const first = await outcomeRows(a.id);
      expect(first).toHaveLength(1);
      expect(first[0]).toMatchObject({ recipientId: ids.owner, type: yes.status === 200 ? "APPROVED" : "REJECTED" });

      const b = await createSubmitted(owner);
      const [back, ok] = await Promise.all([returnRequest(approver, b.id), approve(approver2, b.id, "ok")]);
      expect([back.status, ok.status].filter((s) => s === 200)).toHaveLength(1);
      const second = await outcomeRows(b.id);
      expect(second).toHaveLength(1);
      expect(second[0]).toMatchObject({ recipientId: ids.owner, type: back.status === 200 ? "RETURNED" : "APPROVED" });
    }
  });

  it("TEST-217 / AC-186: if the notification or the transaction fails, nothing changes", async () => {
    const draft = await createDraft(owner);
    const toApprove = await createSubmitted(owner);
    const toReturn = await createSubmitted(owner);
    for (const [id, act] of [
      [draft.id, () => submit(owner, draft.id)],
      [toApprove.id, () => approve(approver, toApprove.id, "ok")],
      [toReturn.id, () => returnRequest(approver, toReturn.id)],
    ] as const) {
      for (const failure of ["insert", "commit"] as const) {
        const before = await loadRequest(id);
        const rowsBefore = await rowsOf(id);
        const fail = failure === "insert" ? withFailingNotificationInsert : withFailingCommit;
        await fail(id, async () => {
          const res = await act();
          if (failure === "commit") return;
          expect(res.status).toBe(500);
          expect(res.body).toEqual({ error: "Something went wrong." });
        });
        const after = await loadRequest(id);
        expect(after.status).toBe(before.status);
        expect(after.submittedAt).toEqual(before.submittedAt);
        expect(after.decidedAt).toEqual(before.decidedAt);
        expect(after.history).toEqual(before.history);
        expect(await rowsOf(id)).toEqual(rowsBefore);
      }
    }
  });

  it("TEST-218 / AC-187: other actions create no notification", async () => {
    const before = await allRows();
    const draft = await createDraft(owner);
    expect((await owner.patch(`/api/requests/${draft.id}`).set("Origin", ORIGIN).send({ reason: "A new reason" })).status).toBe(200);
    expect((await send(owner, `/api/requests/${draft.id}/comments`, { text: "A comment" })).status).toBe(201);
    const upload = await owner
      .post(`/api/requests/${draft.id}/attachments`)
      .set("Origin", ORIGIN)
      .set("Content-Type", "application/octet-stream")
      .set("X-File-Name", "proof.pdf")
      .send(Buffer.from("%PDF-1.4 proof"));
    expect(upload.status).toBe(201);
    expect((await owner.delete(`/api/requests/${draft.id}/attachments/${upload.body.attachment.id}`).set("Origin", ORIGIN)).status).toBe(204);
    expect((await cancel(owner, draft.id)).status).toBe(200);
    expect(await allRows()).toBe(before);

    const submitted = await createSubmitted(owner);
    const afterSubmit = await allRows();
    expect((await send(approver, `/api/requests/${submitted.id}/comments`, { text: "Which model?" })).status).toBe(201);
    expect((await cancel(owner, submitted.id)).status).toBe(200);
    expect(await allRows()).toBe(afterSubmit);
  });

  it("TEST-219 / AC-188: the list holds the caller's 50 newest with exact fields and the full unread count", async () => {
    const reader = await loginAgent(READER);
    const neighbour = await loginAgent(NEIGHBOUR);
    const mine = await createDraft(reader, { itemName: "Old name" });
    const theirs = await createDraft(neighbour);
    await insertRows(ids.reader, mine.id, 55, 5);
    await insertRows(ids.neighbour, theirs.id, 3);
    // The item name in a notification is the current one.
    expect((await reader.patch(`/api/requests/${mine.id}`).set("Origin", ORIGIN).send({ itemName: "Current name" })).status).toBe(200);

    const body = await list(reader);
    const expected = await getPrisma().notification.findMany({
      where: { recipientId: ids.reader },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      take: 50,
    });
    expect(body.notifications.map((n) => n.id)).toEqual(expected.map((r) => r.id));
    expect(body.unreadCount).toBe(44);
    for (const n of body.notifications) {
      expect(Object.keys(n).sort()).toEqual(["actor", "createdAt", "id", "readAt", "request", "type"]);
      expect(n.actor).toEqual({ id: ids.approver, name: "F12 approver" });
      expect(n.request).toEqual({ id: mine.id, requestNumber: mine.requestNumber, itemName: "Current name" });
      expect(new Date(n.createdAt).toISOString()).toBe(n.createdAt);
    }
    expect((await list(neighbour)).notifications).toHaveLength(3);
  });

  it("TEST-220 / AC-189: visibility follows the request and the role, and rows are never edited", async () => {
    const a = approver;
    const b = approver2;
    const created = await createSubmitted(owner);
    const [aNote] = await forRequest(a, created.id);
    const [bNote] = await forRequest(b, created.id);
    expect(aNote?.type).toBe("SUBMITTED");
    expect((await markOne(b, bNote.id)).status).toBe(200);
    const bReadAt = (await forRequest(b, created.id))[0].readAt;
    expect(bReadAt).not.toBeNull();
    let snapshot = await rowsOf(created.id);

    // Existing rows must stay exactly as they were; later steps may only add rows.
    const unchanged = async () => {
      const now = await rowsOf(created.id);
      expect(now.slice(0, snapshot.length)).toEqual(snapshot);
      snapshot = now;
    };
    const hiddenForBoth = async () => {
      for (const [agent, note] of [[a, aNote], [b, bNote]] as const) {
        expect(await forRequest(agent, created.id)).toHaveLength(0);
        const body = await list(agent);
        const visibleUnread = await getPrisma().notification.count({
          where: { recipientId: agent === a ? ids.approver : ids.approver2, readAt: null, request: { status: { not: "DRAFT" } } },
        });
        expect(body.unreadCount).toBe(visibleUnread);
        const res = await markOne(agent, note.id);
        expect(res.status).toBe(404);
        expect(res.body).toEqual(NOT_FOUND);
      }
      await unchanged();
    };

    expect((await returnRequest(a, created.id)).status).toBe(200);
    await hiddenForBoth();
    expect((await markAll(a)).status).toBe(200);
    await unchanged();

    expect((await submit(owner, created.id)).status).toBe(200);
    expect(await forRequest(a, created.id)).toHaveLength(2);
    expect((await forRequest(b, created.id)).map((n) => n.id)).toContain(bNote.id);
    await unchanged();

    await getPrisma().user.update({ where: { id: ids.approver2 }, data: { role: "REQUESTER" } });
    expect(await forRequest(b, created.id)).toHaveLength(0);
    expect((await markOne(b, bNote.id)).status).toBe(404);
    await getPrisma().user.update({ where: { id: ids.approver2 }, data: { role: "APPROVER" } });
    expect(await forRequest(b, created.id)).toHaveLength(2);
    await unchanged();

    expect((await returnRequest(a, created.id)).status).toBe(200);
    await hiddenForBoth();
    const total = (await rowsOf(created.id)).length;
    expect((await cancel(owner, created.id)).status).toBe(200);
    expect(await rowsOf(created.id)).toHaveLength(total);
    expect(await forRequest(a, created.id)).toHaveLength(2);
    expect((await forRequest(b, created.id)).find((n) => n.id === bNote.id)?.readAt).toBe(bReadAt);
    await unchanged();
  });

  it("TEST-221 / AC-190: marking sets readAt once and lowers the count", async () => {
    const created = await createSubmitted(owner);
    expect((await approve(approver, created.id, "ok")).status).toBe(200);
    const [note] = await forRequest(owner, created.id);
    const before = (await list(owner)).unreadCount;
    const first = await markOne(owner, note.id);
    expect(first.status).toBe(200);
    expect(Object.keys(first.body)).toEqual(["notification"]);
    expect(first.body.notification).toMatchObject({ id: note.id, type: "APPROVED" });
    expect(first.body.notification.readAt).not.toBeNull();
    expect((await list(owner)).unreadCount).toBe(before - 1);
    const second = await markOne(owner, note.id);
    expect(second.status).toBe(200);
    expect(second.body.notification.readAt).toBe(first.body.notification.readAt);
    expect((await list(owner)).unreadCount).toBe(before - 1);
  });

  it("TEST-222 / AC-191: another user's, a hidden, a missing and a non-numeric id give 404", async () => {
    const created = await createSubmitted(owner);
    const [approverNote] = await forRequest(approver, created.id);
    const hidden = await createSubmitted(owner);
    const [hiddenNote] = await forRequest(approver, hidden.id);
    expect((await returnRequest(approver, hidden.id)).status).toBe(200);
    const snapshot = [await rowsOf(created.id), await rowsOf(hidden.id)];
    for (const [agent, id] of [
      [owner, approverNote.id],
      [approver2, approverNote.id],
      [approver, hiddenNote.id],
      [approver, 999_999_999],
      [approver, "abc"],
      [approver, "99999999999999999999"],
    ] as const) {
      const res = await markOne(agent, id);
      expect(res.status).toBe(404);
      expect(res.body).toEqual(NOT_FOUND);
    }
    expect([await rowsOf(created.id), await rowsOf(hidden.id)]).toEqual(snapshot);
  });

  it("TEST-223 / AC-192: mark all reads every visible one, also beyond 50, and nothing else", async () => {
    await getPrisma().notification.deleteMany({ where: { recipientId: { in: [ids.reader, ids.neighbour] } } });
    const reader = await loginAgent(READER);
    const neighbour = await loginAgent(NEIGHBOUR);
    const mine = await createDraft(reader);
    const theirs = await createDraft(neighbour);
    await insertRows(ids.reader, mine.id, 55);
    // Hidden from the reader: a notification about another user's request, while the reader is a requester.
    await insertRows(ids.reader, theirs.id, 1);
    await insertRows(ids.neighbour, theirs.id, 2);
    expect((await list(reader)).unreadCount).toBe(55);

    const res = await markAll(reader);
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ unreadCount: 0 });
    expect((await list(reader)).unreadCount).toBe(0);
    const unread = (where: object) => getPrisma().notification.count({ where: { ...where, readAt: null } });
    expect(await unread({ recipientId: ids.reader, requestId: mine.id })).toBe(0);
    expect(await unread({ recipientId: ids.reader, requestId: theirs.id })).toBe(1);
    expect(await unread({ recipientId: ids.neighbour })).toBe(2);
  });

  it("TEST-224 / AC-193: session, role and origin checks, in that order", async () => {
    const created = await createSubmitted(owner);
    const [note] = await forRequest(approver, created.id);
    const snapshot = await rowsOf(created.id);
    const calls = [
      (agent: Agent, origin: string) => agent.get("/api/notifications").set("Origin", origin),
      (agent: Agent, origin: string) => send(agent, `/api/notifications/${note.id}/read`, {}, origin),
      (agent: Agent, origin: string) => send(agent, "/api/notifications/read-all", {}, origin),
    ];
    for (const call of calls) {
      const anonymous = await call(request.agent(app), ORIGIN);
      expect(anonymous.status).toBe(401);
      expect(anonymous.body).toEqual({ error: "Authentication required." });
      const forbidden = await call(admin, ORIGIN);
      expect(forbidden.status).toBe(403);
      expect(forbidden.body).toEqual(FORBIDDEN);
    }
    // The role check comes before the id check.
    expect((await markOne(admin, 999_999_999)).body).toEqual(FORBIDDEN);
    // The origin check comes before the session check.
    for (const agent of [approver, request.agent(app)]) {
      for (const call of calls.slice(1)) {
        const foreign = await call(agent, "https://evil.example");
        expect(foreign.status).toBe(403);
        expect(foreign.body).toEqual({ error: "Request origin not allowed." });
      }
    }
    expect(await rowsOf(created.id)).toEqual(snapshot);
  });

  it("TEST-225 / AC-194: no route creates or deletes, and body values change nothing", async () => {
    const created = await createSubmitted(owner);
    const [note] = await forRequest(approver, created.id);
    const before = await allRows();
    const create = await send(approver, "/api/notifications", { recipientId: ids.owner, requestId: created.id, type: "APPROVED" });
    expect(create.status).toBe(404);
    expect((await approver.delete(`/api/notifications/${note.id}`).set("Origin", ORIGIN)).status).toBe(404);
    expect(await allRows()).toBe(before);

    const started = Date.now();
    const res = await markOne(approver, note.id, { recipientId: ids.owner, readAt: "2000-01-01T00:00:00.000Z", type: "APPROVED" });
    expect(res.status).toBe(200);
    expect(res.body.notification.type).toBe("SUBMITTED");
    expect(new Date(res.body.notification.readAt).getTime()).toBeGreaterThanOrEqual(started - 1000);
    const row = await getPrisma().notification.findUniqueOrThrow({ where: { id: note.id } });
    expect(row).toMatchObject({ recipientId: ids.approver, type: "SUBMITTED" });
  });

  it("TEST-226 / AC-195: notifications and their read state survive a new session", async () => {
    const created = await createSubmitted(owner);
    expect((await reject(approver, created.id, "Not needed now")).status).toBe(200);
    const [note] = await forRequest(owner, created.id);
    expect((await markOne(owner, note.id)).status).toBe(200);
    const before = await list(owner);
    const fresh = await loginAgent(OWNER);
    expect(await list(fresh)).toEqual(before);
  });
});
