import { afterAll, beforeAll, describe, expect, it } from "vitest";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { ORIGIN, cleanupUsers, createUser, loginAgent } from "../helpers/fixtures.js";
import { approve, cancel, createDraft, createSubmitted, loadRequest, reject, submit } from "../helpers/requests.js";

const OWNER = "f10-owner@test.local";
const OTHER = "f10-other@test.local";
const APPROVER = "f10-approver@test.local";
const ADMIN = "f10-admin@test.local";
const USERS = [OWNER, OTHER, APPROVER, ADMIN];

type Agent = ReturnType<typeof request.agent>;
let owner: Agent;
let other: Agent;
let approver: Agent;
let admin: Agent;
const ids: Record<string, number> = {};

beforeAll(async () => {
  ids.owner = (await createUser(OWNER, { name: "F10 owner" })).id;
  ids.other = (await createUser(OTHER, { name: "F10 other" })).id;
  ids.approver = (await createUser(APPROVER, { role: "APPROVER", name: "F10 approver" })).id;
  ids.admin = (await createUser(ADMIN, { role: "ADMIN", name: "F10 admin" })).id;
  [owner, other, approver, admin] = await Promise.all(USERS.map((email) => loginAgent(email)));
});

afterAll(async () => {
  await cleanupUsers(USERS);
  await getPrisma().$disconnect();
});

const url = (requestId: number | string, commentId?: number) =>
  `/api/requests/${requestId}/comments${commentId === undefined ? "" : `/${commentId}`}`;

const post = (agent: Agent, requestId: number | string, body: unknown, origin = ORIGIN) =>
  agent.post(url(requestId)).set("Origin", origin).send(body as object);

async function posted(agent: Agent, requestId: number, text = "A comment") {
  const res = await post(agent, requestId, { text });
  expect(res.status).toBe(201);
  return res.body.comment as { id: number; text: string; author: { id: number; name: string }; createdAt: string };
}

async function list(agent: Agent, requestId: number) {
  const res = await agent.get(url(requestId));
  expect(res.status).toBe(200);
  return res.body.comments as { id: number; text: string; author: { id: number; name: string }; createdAt: string }[];
}

const countRows = (requestId: number) => getPrisma().comment.count({ where: { requestId } });

const NOT_FOUND = { error: "Request not found.", code: "NOT_FOUND" };
const FORBIDDEN = { error: "You do not have permission to perform this action.", code: "FORBIDDEN" };
const MESSAGE = "Enter a comment of 1 to 1000 characters.";

// One request of the owner in each of the five statuses.
async function oneInEachStatus() {
  const draft = await createDraft(owner);
  const submitted = await createSubmitted(owner);
  const approved = await createSubmitted(owner);
  const rejected = await createSubmitted(owner);
  const cancelled = await createSubmitted(owner);
  expect((await approve(approver, approved.id, "ok")).status).toBe(200);
  expect((await reject(approver, rejected.id, "not needed now")).status).toBe(200);
  expect((await cancel(owner, cancelled.id)).status).toBe(200);
  return { draft, submitted, approved, rejected, cancelled };
}

describe("F-10 comments API", () => {
  it("TEST-172 / AC-141: the owner adds a comment and is stored as its author", async () => {
    const draft = await createDraft(owner);
    const res = await post(owner, draft.id, { text: "Which model do you need?" });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body)).toEqual(["comment"]);
    expect(Object.keys(res.body.comment).sort()).toEqual(["author", "createdAt", "id", "text"]);
    expect(res.body.comment).toMatchObject({ text: "Which model do you need?", author: { id: ids.owner, name: "F10 owner" } });
    expect(Object.keys(res.body.comment.author).sort()).toEqual(["id", "name"]);
    const rows = await getPrisma().comment.findMany({ where: { requestId: draft.id } });
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ id: res.body.comment.id, authorId: ids.owner, text: "Which model do you need?" });
  });

  it("TEST-173 / AC-142: an approver comments on another user's submitted request and on their own draft", async () => {
    const submitted = await createSubmitted(owner);
    const ownDraft = await createDraft(approver);
    expect((await posted(approver, submitted.id)).author.id).toBe(ids.approver);
    expect((await posted(approver, ownDraft.id)).author.id).toBe(ids.approver);
  });

  it("TEST-174 / AC-143: comments are accepted in every status", async () => {
    const all = await oneInEachStatus();
    const calls: [Agent, number, number][] = [
      ...Object.values(all).map((r): [Agent, number, number] => [owner, ids.owner, r.id]),
      ...[all.submitted, all.approved, all.rejected, all.cancelled].map((r): [Agent, number, number] => [approver, ids.approver, r.id]),
    ];
    expect(calls).toHaveLength(9);
    for (const [agent, authorId, requestId] of calls) {
      const res = await post(agent, requestId, { text: "status check" });
      expect(res.status, `request ${requestId} author ${authorId}`).toBe(201);
      const row = await getPrisma().comment.findUniqueOrThrow({ where: { id: res.body.comment.id } });
      expect(row).toMatchObject({ requestId, authorId });
    }
  });

  it("TEST-175 / AC-144: the text must be 1 to 1000 characters", async () => {
    const draft = await createDraft(owner);
    const bad: [string, unknown][] = [
      ["no text", {}],
      ["null", { text: null }],
      ["number", { text: 5 }],
      ["array", { text: ["a"] }],
      ["blank", { text: "  \n\t  " }],
      ["1001", { text: "a".repeat(1001) }],
      ["U+0000", { text: "a\u0000b" }],
      ["501 emoji", { text: "😀".repeat(501) }],
    ];
    for (const [label, body] of bad) {
      const res = await post(owner, draft.id, body);
      expect(res.status, label).toBe(422);
      expect(res.body.code, label).toBe("VALIDATION_ERROR");
      expect(res.body.fields, label).toEqual({ text: MESSAGE });
    }
    expect(await countRows(draft.id)).toBe(0);
    for (const text of ["a", "a".repeat(1000), `  ${"ก".repeat(1000)}  `, "😀".repeat(500)]) {
      expect((await post(owner, draft.id, { text })).status).toBe(201);
    }
    expect(await countRows(draft.id)).toBe(4);
  });

  it("TEST-176 / AC-145: only the outer white space is removed", async () => {
    const draft = await createDraft(owner);
    const kept = "ขอ  ใบเสนอราคา\n\nบรรทัดที่สอง   end";
    expect((await posted(owner, draft.id, ` \n\t ${kept} \n `)).text).toBe(kept);
    const row = await getPrisma().comment.findFirstOrThrow({ where: { requestId: draft.id } });
    expect(row.text).toBe(kept);
    expect((await list(owner, draft.id))[0].text).toBe(kept);
  });

  it("TEST-177 / AC-146: the administrator cannot comment", async () => {
    const submitted = await createSubmitted(owner);
    for (const id of [submitted.id, 999_999_999]) {
      for (const text of ["from admin", ""]) {
        const res = await post(admin, id, { text });
        expect(res.status).toBe(403);
        expect(res.body).toEqual(FORBIDDEN);
      }
    }
    expect(await countRows(submitted.id)).toBe(0);
  });

  it("TEST-178 / AC-147: a hidden or missing request answers not found", async () => {
    const submitted = await createSubmitted(owner);
    const draft = await createDraft(owner);
    await posted(owner, submitted.id, "private note one");
    await posted(owner, draft.id, "private note two");
    const total = await getPrisma().comment.count();
    const cases: [Agent, number | string][] = [
      [other, submitted.id],
      [other, draft.id],
      [approver, draft.id],
      [owner, 999_999_999],
      [approver, 999_999_999],
      [owner, "abc"],
    ];
    for (const [agent, id] of cases) {
      for (const res of [await agent.get(url(id)), await post(agent, id, { text: "hello" }), await post(agent, id, { text: "" })]) {
        expect(res.status, String(id)).toBe(404);
        expect(res.body).toEqual(NOT_FOUND);
      }
    }
    expect((await admin.get(url(999_999_999))).body).toEqual(NOT_FOUND);
    expect(await getPrisma().comment.count()).toBe(total);
  });

  it("TEST-179 / AC-148: no session and a foreign origin are refused", async () => {
    const submitted = await createSubmitted(owner);
    await posted(owner, submitted.id, "existing");
    const read = await request(app).get(url(submitted.id));
    const write = await request(app).post(url(submitted.id)).set("Origin", ORIGIN).send({ text: "anonymous" });
    for (const res of [read, write]) {
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Authentication required." });
    }
    const foreign = await post(owner, submitted.id, { text: "foreign" }, "http://evil.example");
    expect(foreign.status).toBe(403);
    expect(foreign.body).toEqual({ error: "Request origin not allowed." });
    expect(await countRows(submitted.id)).toBe(1);
  });

  it("TEST-180 / AC-149: the list is oldest first with only the comment fields", async () => {
    const submitted = await createSubmitted(owner);
    for (const reader of [owner, approver, admin]) expect(await list(reader, submitted.id)).toEqual([]);
    const first = await posted(owner, submitted.id, "first");
    const second = await posted(approver, submitted.id, "second");
    const third = await posted(owner, submitted.id, "third");
    // Inserted last (highest id) with the oldest time, so the order cannot come from the id or the insert order.
    const oldest = await getPrisma().comment.create({
      data: { requestId: submitted.id, authorId: ids.approver, text: "oldest", createdAt: new Date("2020-01-01T00:00:00Z") },
    });
    for (const reader of [owner, approver, admin]) {
      const comments = await list(reader, submitted.id);
      expect(comments.map((c) => c.id)).toEqual([oldest.id, first.id, second.id, third.id]);
      for (const comment of comments) {
        expect(Object.keys(comment).sort()).toEqual(["author", "createdAt", "id", "text"]);
        expect(Object.keys(comment.author).sort()).toEqual(["id", "name"]);
      }
      expect(comments[2].author).toEqual({ id: ids.approver, name: "F10 approver" });
    }
  });

  it("TEST-181 / AC-150: each list holds only the comments of its request", async () => {
    const a = await createDraft(owner);
    const b = await createDraft(owner);
    await posted(owner, a.id, "for a");
    await posted(owner, b.id, "for b");
    expect((await list(owner, a.id)).map((c) => c.text)).toEqual(["for a"]);
    expect((await list(owner, b.id)).map((c) => c.text)).toEqual(["for b"]);
  });

  it("TEST-182 / AC-151: the server sets the author, time, id and request, and text stays text", async () => {
    const mine = await createDraft(owner);
    const another = await createDraft(owner);
    const text = "<img src=x onerror=alert(1)>';--";
    const before = Date.now();
    const res = await post(owner, mine.id, {
      text,
      id: 999_999_999,
      authorId: ids.other,
      author: { id: ids.other, name: "Somebody" },
      createdAt: "2000-01-01T00:00:00.000Z",
      requestId: another.id,
    });
    expect(res.status).toBe(201);
    expect(res.body.comment.text).toBe(text);
    expect(res.body.comment.id).not.toBe(999_999_999);
    expect(res.body.comment.author).toEqual({ id: ids.owner, name: "F10 owner" });
    expect(Date.parse(res.body.comment.createdAt)).toBeGreaterThanOrEqual(before - 5_000);
    const row = await getPrisma().comment.findUniqueOrThrow({ where: { id: res.body.comment.id } });
    expect(row).toMatchObject({ requestId: mine.id, authorId: ids.owner, text });
    expect(await countRows(another.id)).toBe(0);
  });

  it("TEST-183 / AC-152: there is no route to change or remove a comment", async () => {
    const draft = await createDraft(owner);
    const comment = await posted(owner, draft.id, "cannot change");
    const before = await getPrisma().comment.findUniqueOrThrow({ where: { id: comment.id } });
    for (const method of ["patch", "put", "delete"] as const) {
      const res = await owner[method](url(draft.id, comment.id)).set("Origin", ORIGIN).send({ text: "changed" });
      expect(res.status, method).toBe(404);
    }
    expect(await getPrisma().comment.findUnique({ where: { id: comment.id } })).toEqual(before);
  });

  it("TEST-184 / AC-153: a comment changes no request field and no history", async () => {
    const submitted = await createSubmitted(owner);
    const before = await loadRequest(submitted.id);
    await posted(approver, submitted.id, "a question");
    expect(await loadRequest(submitted.id)).toEqual(before);
  });

  it("TEST-185 / AC-154: comments stay after status changes and a new session", async () => {
    const toApprove = await createDraft(owner);
    const toReject = await createDraft(owner);
    const toCancel = await createDraft(owner);
    const written = new Map<number, number>();
    for (const r of [toApprove, toReject, toCancel]) {
      written.set(r.id, (await posted(owner, r.id, "written as a draft")).id);
      expect((await submit(owner, r.id)).status).toBe(200);
    }
    expect((await approve(approver, toApprove.id, "ok")).status).toBe(200);
    expect((await reject(approver, toReject.id, "not needed now")).status).toBe(200);
    expect((await cancel(owner, toCancel.id)).status).toBe(200);
    const again = await loginAgent(OWNER);
    for (const [requestId, commentId] of written) {
      const comments = await list(again, requestId);
      expect(comments.map((c) => [c.id, c.text])).toEqual([[commentId, "written as a draft"]]);
    }
  });
});
