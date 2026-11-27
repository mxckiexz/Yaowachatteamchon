import { afterAll, beforeAll, describe, expect, it } from "vitest";
import http from "node:http";
import type { AddressInfo } from "node:net";
import request from "supertest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { FIXTURE_PASSWORD, ORIGIN, cleanupUsers, createUser, loginAgent } from "../helpers/fixtures.js";
import { approve, cancel, createDraft, createSubmitted, reject, submit } from "../helpers/requests.js";

const OWNER = "f09-owner@test.local";
const OTHER = "f09-other@test.local";
const APPROVER = "f09-approver@test.local";
const ADMIN = "f09-admin@test.local";
const USERS = [OWNER, OTHER, APPROVER, ADMIN];

type Agent = ReturnType<typeof request.agent>;
let owner: Agent;
let other: Agent;
let approver: Agent;
let admin: Agent;
let ownerId: number;

beforeAll(async () => {
  const user = await createUser(OWNER, { name: "F09 owner" });
  ownerId = user.id;
  await createUser(OTHER, { name: "F09 other" });
  await createUser(APPROVER, { role: "APPROVER", name: "F09 approver" });
  await createUser(ADMIN, { role: "ADMIN", name: "F09 admin" });
  [owner, other, approver, admin] = await Promise.all(USERS.map((email) => loginAgent(email)));
});

afterAll(async () => {
  await cleanupUsers(USERS);
  await getPrisma().$disconnect();
});

// Synthetic files: only the first bytes matter to the type check.
const MB5 = 5 * 1024 * 1024;
const filled = (head: number[], size: number) => {
  const buffer = Buffer.alloc(size, 0x61);
  Buffer.from(head).copy(buffer);
  return buffer;
};
const PDF_HEAD = [0x25, 0x50, 0x44, 0x46, 0x2d];
const pdf = (size = 64) => filled(PDF_HEAD, size);
const png = () => filled([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 64);
const jpg = () => filled([0xff, 0xd8, 0xff], 64);

const url = (requestId: number | string, attachmentId?: number | string) =>
  `/api/requests/${requestId}/attachments${attachmentId === undefined ? "" : `/${attachmentId}`}`;

interface UploadOptions {
  name?: string;
  rawName?: string | null;
  content?: Buffer;
  type?: string;
  origin?: string;
}

function upload(agent: Agent, requestId: number | string, options: UploadOptions = {}) {
  const call = agent
    .post(url(requestId))
    .set("Origin", options.origin ?? ORIGIN)
    .set("Content-Type", options.type ?? "application/octet-stream");
  const header = options.rawName !== undefined ? options.rawName : encodeURIComponent(options.name ?? "quote.pdf");
  if (header !== null) call.set("X-File-Name", header);
  return call.send(options.content ?? pdf());
}

const remove = (agent: Agent, requestId: number, attachmentId: number, origin = ORIGIN) =>
  agent.delete(url(requestId, attachmentId)).set("Origin", origin);

const download = (agent: Agent, requestId: number, attachmentId: number) =>
  agent
    .get(url(requestId, attachmentId))
    .buffer(true)
    .parse((res, done) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk: Buffer) => chunks.push(chunk));
      res.on("end", () => done(null, Buffer.concat(chunks)));
    });

async function sessionCookie(email: string) {
  const res = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email, password: FIXTURE_PASSWORD }).expect(200);
  return String(res.headers["set-cookie"][0]).split(";")[0];
}

// Sends only the headers of a too-large upload and waits for the answer. An answer proves that the server
// decided without reading the file; a server that waited for the body would run into the time limit.
async function answerBeforeBody(requestId: number, cookie?: string) {
  const server = app.listen(0);
  try {
    return await new Promise<number>((resolve, reject) => {
      const call = http.request({
        port: (server.address() as AddressInfo).port,
        method: "POST",
        path: url(requestId),
        headers: {
          Origin: ORIGIN,
          "Content-Type": "application/octet-stream",
          "Content-Length": MB5 + 1,
          "X-File-Name": "big.pdf",
          ...(cookie ? { Cookie: cookie } : {}),
        },
      });
      call.setTimeout(5_000, () => call.destroy(new Error("no answer before the body")));
      call.on("response", (res) => {
        resolve(res.statusCode!);
        call.destroy();
      });
      call.on("error", reject);
      call.flushHeaders();
    });
  } finally {
    server.closeAllConnections();
    server.close();
  }
}

const countRows = (requestId: number) => getPrisma().attachment.count({ where: { requestId } });

async function uploaded(agent: Agent, requestId: number, options: UploadOptions = {}) {
  const res = await upload(agent, requestId, options);
  expect(res.status).toBe(201);
  return res.body.attachment as { id: number; fileName: string; fileType: string; sizeBytes: number };
}

// One request of the owner in each state that is not a draft, each with one file added while it was a draft.
async function nonDraftRequests() {
  const make = async () => {
    const draft = await createDraft(owner);
    const file = await uploaded(owner, draft.id);
    return { id: draft.id, file };
  };
  const submitted = await make();
  const approved = await make();
  const rejected = await make();
  const cancelled = await make();
  for (const r of [submitted, approved, rejected]) expect((await submit(owner, r.id)).status).toBe(200);
  expect((await approve(approver, approved.id, "ok")).status).toBe(200);
  expect((await reject(approver, rejected.id, "not needed now")).status).toBe(200);
  expect((await cancel(owner, cancelled.id)).status).toBe(200);
  return { submitted, approved, rejected, cancelled };
}

// Holds the request row in its own transaction while the status changes, then lets the waiting call continue.
async function raceAgainstSubmit(requestId: number, call: () => PromiseLike<{ status: number; body: any }>) {
  const prisma = getPrisma();
  let pending!: Promise<{ status: number; body: any }>;
  await prisma.$transaction(
    async (tx) => {
      await tx.purchaseRequest.update({ where: { id: requestId }, data: { status: "SUBMITTED", submittedAt: new Date() } });
      pending = Promise.resolve(call().then((res) => res));
      let waiting = 0;
      for (let attempt = 0; attempt < 100 && waiting === 0; attempt++) {
        await new Promise((r) => setTimeout(r, 50));
        const [{ n }] = await prisma.$queryRaw<{ n: bigint }[]>`
          SELECT count(*) AS n FROM pg_stat_activity WHERE datname = current_database() AND wait_event_type = 'Lock'`;
        waiting = Number(n);
      }
      expect(waiting, "the call must be waiting for the row lock").toBeGreaterThan(0);
    },
    { timeout: 20_000 }
  );
  return pending;
}

describe("F-09 attachments API", () => {
  it("TEST-148 / AC-117: the owner uploads a PDF to a draft", async () => {
    const draft = await createDraft(owner);
    const content = pdf(1000);
    const res = await upload(owner, draft.id, { name: "quotation.pdf", content });
    expect(res.status).toBe(201);
    expect(Object.keys(res.body.attachment).sort()).toEqual(["createdAt", "fileName", "fileType", "id", "sizeBytes", "uploadedBy"]);
    expect(res.body.attachment).toMatchObject({
      fileName: "quotation.pdf",
      fileType: "application/pdf",
      sizeBytes: 1000,
      uploadedBy: { id: ownerId, name: "F09 owner" },
    });
    const rows = await getPrisma().attachment.findMany({ where: { requestId: draft.id } });
    expect(rows).toHaveLength(1);
    expect(Buffer.from(rows[0].content).equals(content)).toBe(true);
  });

  it("TEST-149 / AC-118: PNG, JPEG and upper-case extensions are accepted", async () => {
    const draft = await createDraft(owner);
    const cases: [string, Buffer, string][] = [
      ["a.png", png(), "image/png"],
      ["b.jpg", jpg(), "image/jpeg"],
      ["c.jpeg", jpg(), "image/jpeg"],
      ["D.PDF", pdf(), "application/pdf"],
    ];
    for (const [name, content, type] of cases) {
      expect((await uploaded(owner, draft.id, { name, content })).fileType).toBe(type);
    }
  });

  it("TEST-150 / AC-119: other types and mismatched content are refused", async () => {
    const draft = await createDraft(owner);
    const cases: [string, Buffer][] = [
      ["notes.txt", Buffer.from("hello")],
      ["image.svg", Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'/>")],
      ["program.pdf", filled([0x4d, 0x5a, 0x90, 0x00], 64)],
      ["picture.pdf", png()],
    ];
    for (const [name, content] of cases) {
      const res = await upload(owner, draft.id, { name, content });
      expect(res.status, name).toBe(422);
      expect(res.body.code).toBe("VALIDATION_ERROR");
      expect(res.body.fields.file).toBeTruthy();
    }
    expect(await countRows(draft.id)).toBe(0);
  });

  it("TEST-151 / AC-120: the size limit is 5,242,880 bytes", async () => {
    const draft = await createDraft(owner);
    const atLimit = await upload(owner, draft.id, { content: pdf(MB5) });
    expect(atLimit.status).toBe(201);
    expect(atLimit.body.attachment.sizeBytes).toBe(MB5);
    const over = await upload(owner, draft.id, { content: pdf(MB5 + 1) });
    expect(over.status).toBe(413);
    expect(over.body).toEqual({ error: "The file is larger than 5 MB.", code: "FILE_TOO_LARGE" });
    const empty = await upload(owner, draft.id, { content: Buffer.alloc(0) });
    expect(empty.status).toBe(422);
    expect(empty.body.fields.file).toBe("The file is empty.");
    expect(await countRows(draft.id)).toBe(1);
  });

  it("TEST-152 / AC-121: file name rules", async () => {
    const draft = await createDraft(owner);
    const bad: (string | null)[] = [
      null,
      "%E0%A4%A",
      encodeURIComponent("   "),
      encodeURIComponent(`${"a".repeat(97)}.pdf`),
      encodeURIComponent("a/b.pdf"),
      encodeURIComponent("a\\b.pdf"),
      "a%0Ab.pdf",
    ];
    for (const rawName of bad) {
      const res = await upload(owner, draft.id, { rawName });
      expect(res.status, String(rawName)).toBe(422);
      expect(res.body.fields.fileName).toBeTruthy();
    }
    expect(await countRows(draft.id)).toBe(0);
    for (const name of [`${"a".repeat(96)}.pdf`, "ใบเสนอราคา ร้านที่ 1.pdf"]) {
      expect((await uploaded(owner, draft.id, { name })).fileName).toBe(name);
    }
  });

  it("TEST-153 / AC-122: only application/octet-stream is accepted", async () => {
    const draft = await createDraft(owner);
    for (const type of ["application/pdf", "text/plain"]) {
      const res = await upload(owner, draft.id, { type });
      expect(res.status, type).toBe(415);
      expect(res.body.code).toBe("UNSUPPORTED_MEDIA_TYPE");
    }
    expect(await countRows(draft.id)).toBe(0);
  });

  it("TEST-154 / AC-123: at most 5 files, also with simultaneous uploads", async () => {
    const full = await createDraft(owner);
    for (let i = 0; i < 5; i++) await uploaded(owner, full.id, { name: `f${i}.pdf` });
    const sixth = await upload(owner, full.id);
    expect(sixth.status).toBe(409);
    expect(sixth.body).toEqual({ error: "A request can have at most 5 attachments.", code: "ATTACHMENT_LIMIT" });

    for (let round = 0; round < 3; round++) {
      const draft = await createDraft(owner);
      for (let i = 0; i < 4; i++) await uploaded(owner, draft.id, { name: `g${i}.pdf` });
      const results = await Promise.all([upload(owner, draft.id), upload(owner, draft.id)]);
      expect(results.map((r) => r.status).sort()).toEqual([201, 409]);
      expect(await countRows(draft.id)).toBe(5);
    }
  });

  it("TEST-155 / AC-124: nothing changes on a request that is not a draft", async () => {
    const states = await nonDraftRequests();
    const ownerCookie = await sessionCookie(OWNER);
    for (const [state, r] of Object.entries(states)) {
      const add = await upload(owner, r.id);
      expect(add.status, state).toBe(409);
      expect(add.body).toEqual({ error: "Attachments can be changed only on a draft.", code: "NOT_EDITABLE" });
      // The state is checked before the body is read.
      expect(await answerBeforeBody(r.id, ownerCookie)).toBe(409);
      const del = await remove(owner, r.id, r.file.id);
      expect(del.status, state).toBe(409);
      expect(del.body.code).toBe("NOT_EDITABLE");
      expect(await countRows(r.id)).toBe(1);
    }
  });

  it("TEST-156 / AC-125: a change that waits behind a submit is refused", async () => {
    const draft = await createDraft(owner);
    const file = await uploaded(owner, draft.id);

    const add = await raceAgainstSubmit(draft.id, () => upload(owner, draft.id, { name: "late.pdf" }));
    expect(add.status).toBe(409);
    expect(add.body.code).toBe("NOT_EDITABLE");
    expect(await countRows(draft.id)).toBe(1);

    await getPrisma().purchaseRequest.update({ where: { id: draft.id }, data: { status: "DRAFT", submittedAt: null } });
    const del = await raceAgainstSubmit(draft.id, () => remove(owner, draft.id, file.id));
    expect(del.status).toBe(409);
    expect(del.body.code).toBe("NOT_EDITABLE");
    expect(await countRows(draft.id)).toBe(1);
  });

  it("TEST-157 / AC-126: only the owner can add or remove", async () => {
    const draft = await createDraft(owner);
    const submitted = await createDraft(owner);
    const draftFile = await uploaded(owner, draft.id);
    const submittedFile = await uploaded(owner, submitted.id);
    await submit(owner, submitted.id).expect(200);
    for (const email of [OTHER, APPROVER, ADMIN]) {
      expect(await answerBeforeBody(draft.id, await sessionCookie(email))).toBe(404);
    }
    for (const agent of [other, approver, admin]) {
      for (const [r, file] of [[draft, draftFile], [submitted, submittedFile]] as const) {
        const add = await upload(agent, r.id);
        expect(add.status).toBe(404);
        expect(add.body.code).toBe("NOT_FOUND");
        const del = await remove(agent, r.id, file.id);
        expect(del.status).toBe(404);
        expect(del.body.code).toBe("NOT_FOUND");
        expect(await countRows(r.id)).toBe(1);
      }
    }
  });

  it("TEST-158 / AC-127: anonymous calls and foreign origins are refused", async () => {
    const draft = await createDraft(owner);
    const file = await uploaded(owner, draft.id, { name: "private.pdf" });
    const anonymous = request.agent(app);
    const calls = [
      await anonymous.get(url(draft.id)),
      await upload(anonymous, draft.id),
      await anonymous.get(url(draft.id, file.id)),
      await remove(anonymous, draft.id, file.id),
    ];
    for (const res of calls) {
      expect(res.status).toBe(401);
      expect(JSON.stringify(res.body)).not.toContain("private.pdf");
    }
    expect(await answerBeforeBody(draft.id)).toBe(401);
    const foreign = "http://evil.example";
    expect((await upload(owner, draft.id, { origin: foreign })).status).toBe(403);
    expect((await remove(owner, draft.id, file.id, foreign)).status).toBe(403);
    expect(await countRows(draft.id)).toBe(1);
  });

  it("TEST-159 / AC-128: the list has only the attachment fields, oldest first", async () => {
    const draft = await createDraft(owner);
    expect((await owner.get(url(draft.id))).body).toEqual({ attachments: [] });
    for (const name of ["1.pdf", "2.pdf", "3.pdf"]) await uploaded(owner, draft.id, { name });
    const res = await owner.get(url(draft.id));
    expect(res.status).toBe(200);
    expect(res.body.attachments.map((a: any) => a.fileName)).toEqual(["1.pdf", "2.pdf", "3.pdf"]);
    for (const a of res.body.attachments) {
      expect(Object.keys(a).sort()).toEqual(["createdAt", "fileName", "fileType", "id", "sizeBytes", "uploadedBy"]);
      expect(Object.keys(a.uploadedBy).sort()).toEqual(["id", "name"]);
    }
  });

  it("TEST-160 / AC-129: reading follows request visibility", async () => {
    const draft = await createDraft(owner);
    const submitted = await createDraft(owner);
    const draftFile = await uploaded(owner, draft.id, { name: "secret-draft.pdf" });
    const submittedFile = await uploaded(owner, submitted.id, { name: "sent.pdf" });
    await submit(owner, submitted.id).expect(200);
    const matrix: [Agent, number, number, number][] = [
      [owner, draft.id, draftFile.id, 200],
      [admin, draft.id, draftFile.id, 200],
      [other, draft.id, draftFile.id, 404],
      [approver, draft.id, draftFile.id, 404],
      [owner, submitted.id, submittedFile.id, 200],
      [admin, submitted.id, submittedFile.id, 200],
      [approver, submitted.id, submittedFile.id, 200],
      [other, submitted.id, submittedFile.id, 404],
    ];
    for (const [agent, requestId, fileId, status] of matrix) {
      const list = await agent.get(url(requestId));
      const file = await agent.get(url(requestId, fileId));
      expect(list.status).toBe(status);
      expect(file.status).toBe(status);
      if (status === 404) {
        expect(list.body.code).toBe("NOT_FOUND");
        expect(file.body.code).toBe("NOT_FOUND");
        expect(JSON.stringify([list.body, file.body])).not.toContain(".pdf");
      }
    }
    expect((await owner.get(url(999999999))).status).toBe(404);
    expect((await owner.get(url("abc"))).status).toBe(404);
  });

  it("TEST-161 / AC-130: a download returns the same bytes with safe headers", async () => {
    const draft = await createDraft(owner);
    const name = `ใบเสนอราคา 'ร้าน' "A" (1)*.pdf`;
    const content = Buffer.concat([Buffer.from(PDF_HEAD), Buffer.from(Array.from({ length: 512 }, (_, i) => i % 256))]);
    const file = await uploaded(owner, draft.id, { name, content });
    const res = await download(owner, draft.id, file.id);
    expect(res.status).toBe(200);
    expect((res.body as Buffer).equals(content)).toBe(true);
    expect(res.headers["content-type"]).toBe("application/pdf");
    expect(res.headers["content-length"]).toBe(String(content.length));
    expect(res.headers["cache-control"]).toBe("private, no-store");
    expect(res.headers["x-content-type-options"]).toBe("nosniff");
    const disposition = res.headers["content-disposition"] as string;
    expect(disposition.startsWith('attachment; filename="attachment.pdf"; ')).toBe(true);
    const encoded = disposition.split("filename*=UTF-8''")[1];
    expect(encoded).toMatch(/^[A-Za-z0-9._~!%-]+$/);
    expect(decodeURIComponent(encoded)).toBe(name);
  });

  it("TEST-162 / AC-131: an attachment id works only under its own request", async () => {
    const first = await createDraft(owner);
    const second = await createDraft(owner);
    const file = await uploaded(owner, first.id);
    expect((await owner.get(url(second.id, file.id))).status).toBe(404);
    expect((await remove(owner, second.id, file.id)).status).toBe(404);
    expect((await owner.get(url(first.id, "abc"))).status).toBe(404);
    expect(await countRows(first.id)).toBe(1);
  });

  it("TEST-163 / AC-132: the owner deletes a file of a draft", async () => {
    const draft = await createDraft(owner);
    const file = await uploaded(owner, draft.id);
    const res = await remove(owner, draft.id, file.id);
    expect(res.status).toBe(204);
    expect(res.text).toBe("");
    expect((await owner.get(url(draft.id))).body).toEqual({ attachments: [] });
    expect((await owner.get(url(draft.id, file.id))).status).toBe(404);
    expect((await remove(owner, draft.id, file.id)).status).toBe(404);
  });

  it("TEST-164 / AC-133: server-owned fields cannot be set and names stay text", async () => {
    const draft = await createDraft(owner);
    const name = "<img src=x onerror=alert(1)>';--.pdf";
    const content = pdf(200);
    const res = await owner
      .post(`${url(draft.id)}?fileType=image/png&sizeBytes=1&uploadedById=1`)
      .set("Origin", ORIGIN)
      .set("Content-Type", "application/octet-stream")
      .set("X-File-Name", encodeURIComponent(name))
      .set("X-File-Type", "image/png")
      .set("X-Uploaded-By", "1")
      .send(content);
    expect(res.status).toBe(201);
    expect(res.body.attachment).toMatchObject({ fileName: name, fileType: "application/pdf", sizeBytes: 200 });
    expect(res.body.attachment.uploadedBy.id).toBe(ownerId);
    expect((await owner.get(url(draft.id))).body.attachments[0].fileName).toBe(name);
  });

  it("TEST-165 / AC-134: files stay through the request lifecycle and a new session", async () => {
    const states = await nonDraftRequests();
    expect((await approve(approver, states.submitted.id, "ok")).status).toBe(200);
    const again = await loginAgent(OWNER);
    for (const [state, r] of Object.entries(states)) {
      const list = await again.get(url(r.id));
      expect(list.status, state).toBe(200);
      expect(list.body.attachments.map((a: any) => a.id)).toEqual([r.file.id]);
      const file = await download(again, r.id, r.file.id);
      expect((file.body as Buffer).equals(pdf())).toBe(true);
      // A cancelled draft is no longer a draft, so an approver may read it (BR-12).
      expect((await approver.get(url(r.id))).status).toBe(200);
    }
  });

  it("TEST-166 / AC-135: files change no status or history and do not affect submit", async () => {
    const withFile = await createDraft(owner);
    const without = await createDraft(owner);
    const snapshot = () =>
      getPrisma().purchaseRequest.findUniqueOrThrow({ where: { id: withFile.id }, include: { history: true } });
    const before = await snapshot();
    const file = await uploaded(owner, withFile.id);
    const afterUpload = await snapshot();
    expect((await remove(owner, withFile.id, file.id)).status).toBe(204);
    const afterDelete = await snapshot();
    for (const after of [afterUpload, afterDelete]) {
      expect(after.status).toBe(before.status);
      expect(after.history).toEqual(before.history);
    }
    await uploaded(owner, withFile.id);
    expect((await submit(owner, withFile.id)).status).toBe(200);
    expect((await submit(owner, without.id)).status).toBe(200);
    const created = await createSubmitted(owner);
    expect((await owner.get(url(created.id))).body).toEqual({ attachments: [] });
  });
});
