import { randomUUID } from "node:crypto";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import request from "supertest";
import type { Category, RequestStatus } from "@prisma/client";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { ORIGIN, cleanupUsers, createUser, loginAgent } from "../helpers/fixtures.js";
import { approve, cancel, createDraft, reject, submit } from "../helpers/requests.js";

const OWNER = "f17-owner@test.local";
const OTHER = "f17-other@test.local";
const APPROVER = "f17-approver@test.local";
const APPROVER2 = "f17-approver2@test.local";
const ADMIN = "f17-admin@test.local";
const FORMULA = "f17-formula@test.local";
const BULK = "f17-bulk@test.local";
const USERS = [OWNER, OTHER, APPROVER, APPROVER2, ADMIN, FORMULA, BULK];

type Agent = ReturnType<typeof request.agent>;
let owner: Agent;
let other: Agent;
let approver: Agent;
let approver2: Agent;
let admin: Agent;
const ids: Record<string, number> = {};

beforeAll(async () => {
  ids.owner = (await createUser(OWNER, { name: "F17 owner" })).id;
  ids.other = (await createUser(OTHER, { name: "F17 other" })).id;
  ids.approver = (await createUser(APPROVER, { role: "APPROVER", name: "F17 approver" })).id;
  ids.approver2 = (await createUser(APPROVER2, { role: "APPROVER", name: "F17 approver two" })).id;
  ids.admin = (await createUser(ADMIN, { role: "ADMIN", name: "F17 admin" })).id;
  ids.formula = (await createUser(FORMULA, { name: "=F17 Formula Name" })).id;
  await getPrisma().user.update({ where: { id: ids.formula }, data: { name: "=F17 Formula Name" } });
  ids.bulk = (await createUser(BULK, { name: "F17 bulk" })).id;
  [owner, other, approver, approver2, admin] = await Promise.all(
    [OWNER, OTHER, APPROVER, APPROVER2, ADMIN].map((email) => loginAgent(email))
  );
});

afterAll(async () => {
  await cleanupUsers(USERS);
  await getPrisma().$disconnect();
});

const STATUSES = ["DRAFT", "SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"] as const;
const CATEGORIES = ["EQUIPMENT", "SOFTWARE", "FURNITURE", "STATIONERY", "OTHER", null] as const;
const HEADER = "Request number,Item name,Category,Status,Quantity,Unit price (THB),Total (THB),Requester,Created at,Submitted at,Decided at";

// A Bangkok local time as an instant.
const bkk = (day: string, time = "12:00:00.000") => new Date(`${day}T${time}+07:00`);
// The tests keep their rows on days nobody else uses, so a date filter isolates them in the shared database.
const onDay = (day: string, extra = "") => `from=${day}&to=${day}${extra}`;

interface Seed {
  requesterId: number;
  createdAt: Date;
  status?: RequestStatus;
  category?: Category | null;
  satang?: number;
  quantity?: number;
  itemName?: string;
  description?: string;
  reason?: string;
  rejectionReason?: string | null;
  submittedAt?: Date | null;
  decidedAt?: Date | null;
}

function rowData(s: Seed) {
  const quantity = s.quantity ?? 1;
  const unit = s.satang ?? 1000;
  return {
    requestNumber: `F17-${randomUUID()}`,
    requesterId: s.requesterId,
    itemName: s.itemName ?? "Report item",
    description: s.description ?? "Seeded for a report test",
    quantity,
    unitPriceSatang: unit,
    totalSatang: BigInt(quantity * unit),
    reason: s.reason ?? "Needed",
    category: s.category === undefined ? ("EQUIPMENT" as const) : s.category,
    status: s.status ?? ("SUBMITTED" as const),
    rejectionReason: s.rejectionReason ?? null,
    createdAt: s.createdAt,
    submittedAt: s.submittedAt ?? null,
    decidedAt: s.decidedAt ?? null,
  };
}
const seed = (s: Seed) => getPrisma().purchaseRequest.create({ data: rowData(s) });

interface Summary {
  count: number;
  total: number;
  byStatus: { status: string; count: number; total: number }[];
  byCategory: { category: string | null; count: number; total: number }[];
}

async function summary(agent: Agent, query = ""): Promise<Summary> {
  const res = await agent.get(`/api/reports/summary?${query}`);
  expect(res.status).toBe(200);
  return res.body.summary;
}

const satang = (baht: number) => Math.round(baht * 100);
const statusRow = (s: Summary, status: string) => s.byStatus.find((r) => r.status === status)!;

// Reads the body of any response as bytes.
const binary = (res: any, done: (err: Error | null, body: Buffer) => void) => {
  const chunks: Buffer[] = [];
  res.on("data", (chunk: Buffer) => chunks.push(chunk));
  res.on("end", () => done(null, Buffer.concat(chunks)));
};
const download = (agent: Agent, query = "") => agent.get(`/api/reports/export.csv?${query}`).buffer(true).parse(binary);

// A small strict RFC 4180 reader, written here so the test does not trust the writer under test.
function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"' && text[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"' && field === "") quoted = true;
    else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\r" && text[i + 1] === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
    } else {
      if (c === "\r" || c === "\n" || c === '"') throw new Error(`unquoted special character at ${i}`);
      field += c;
    }
  }
  if (quoted || field !== "" || row.length > 0) throw new Error("the file does not end with CR LF");
  return rows;
}

async function exported(agent: Agent, query = "") {
  const res = await download(agent, query);
  expect(res.status).toBe(200);
  const bytes = res.body as Buffer;
  expect([...bytes.subarray(0, 3)]).toEqual([0xef, 0xbb, 0xbf]);
  const text = bytes.subarray(3).toString("utf8");
  const [header, ...rows] = parseCsv(text);
  expect(header.join(",")).toBe(HEADER);
  return { res, text, rows };
}

describe("F-17 reports and export", () => {
  it("TEST-331 / AC-300: a requester sees only their own requests, with exactly the listed fields", async () => {
    const day = "2001-01-10";
    for (const status of STATUSES) await seed({ requesterId: ids.owner, createdAt: bkk(day), status, satang: 100 });
    await seed({ requesterId: ids.other, createdAt: bkk(day), status: "SUBMITTED", satang: 999_900 });
    const res = await owner.get(`/api/reports/summary?${onDay(day)}`);
    expect(res.status).toBe(200);
    expect(Object.keys(res.body)).toEqual(["summary"]);
    const s: Summary = res.body.summary;
    expect(Object.keys(s).sort()).toEqual(["byCategory", "byStatus", "count", "total"]);
    for (const row of s.byStatus) expect(Object.keys(row).sort()).toEqual(["count", "status", "total"]);
    for (const row of s.byCategory) expect(Object.keys(row).sort()).toEqual(["category", "count", "total"]);
    expect([s.count, s.total]).toEqual([5, 5]);
    expect(s.byStatus.map((r) => r.count)).toEqual([1, 1, 1, 1, 1]);
  });

  it("TEST-332 / AC-301: an approver sees own requests and others' that are not drafts", async () => {
    const day = "2001-02-10";
    await seed({ requesterId: ids.approver, createdAt: bkk(day), status: "DRAFT", satang: 100 });
    await seed({ requesterId: ids.other, createdAt: bkk(day), status: "DRAFT", satang: 777_700 });
    for (const status of ["SUBMITTED", "APPROVED", "REJECTED", "CANCELLED"] as const) {
      await seed({ requesterId: ids.other, createdAt: bkk(day), status, satang: 200 });
    }
    const s = await summary(approver, onDay(day));
    expect([s.count, s.total]).toEqual([5, 9]);
    expect(statusRow(s, "DRAFT")).toEqual({ status: "DRAFT", count: 1, total: 1 });
  });

  it("TEST-333 / AC-302: the administrator's summary covers every request", async () => {
    await seed({ requesterId: ids.other, createdAt: bkk("2001-03-10"), status: "DRAFT", satang: 123 });
    const s = await summary(admin);
    const all = await getPrisma().purchaseRequest.aggregate({ _count: { _all: true }, _sum: { totalSatang: true } });
    expect(s.count).toBe(all._count._all);
    expect(satang(s.total)).toBe(Number(all._sum.totalSatang));
  });

  it("TEST-334 / AC-303: all statuses add up exactly, with rejected and cancelled in the total", async () => {
    const day = "2001-04-10";
    const rows: [RequestStatus, Category | null, number][] = [
      ["DRAFT", "EQUIPMENT", 10],
      ["SUBMITTED", "EQUIPMENT", 20],
      ["APPROVED", "SOFTWARE", 100],
      ["REJECTED", "SOFTWARE", 725],
      ["CANCELLED", null, 310],
    ];
    for (const [status, category, price] of rows) await seed({ requesterId: ids.owner, createdAt: bkk(day), status, category, satang: price });
    const s = await summary(owner, onDay(day));
    expect(s.count).toBe(5);
    expect(s.total).toBe(11.65);
    expect(statusRow(s, "REJECTED")).toEqual({ status: "REJECTED", count: 1, total: 7.25 });
    expect(statusRow(s, "CANCELLED")).toEqual({ status: "CANCELLED", count: 1, total: 3.1 });
    expect(s.byStatus.map((r) => r.status)).toEqual([...STATUSES]);
    expect(s.byCategory.map((r) => r.category)).toEqual([...CATEGORIES]);
    expect(s.byCategory.find((r) => r.category === "EQUIPMENT")).toEqual({ category: "EQUIPMENT", count: 2, total: 0.3 });
    expect(s.byCategory.find((r) => r.category === null)).toEqual({ category: null, count: 1, total: 3.1 });
    for (const list of [s.byStatus, s.byCategory]) {
      expect(list.reduce((n, r) => n + r.count, 0)).toBe(s.count);
      expect(list.reduce((n, r) => n + satang(r.total), 0)).toBe(satang(s.total));
    }
    const drafts = await summary(owner, onDay(day, "&status=DRAFT"));
    expect([drafts.count, drafts.total]).toEqual([1, 0.1]);
    expect(drafts.byStatus.map((r) => [r.count, r.total])).toEqual([[1, 0.1], [0, 0], [0, 0], [0, 0], [0, 0]]);
    expect(drafts.byCategory.filter((r) => r.count === 0)).toHaveLength(5);
  });

  it("TEST-335 / AC-304: status and category narrow and combine; no category never matches", async () => {
    const day = "2001-05-10";
    await seed({ requesterId: ids.owner, createdAt: bkk(day), status: "DRAFT", category: "SOFTWARE", satang: 100 });
    await seed({ requesterId: ids.owner, createdAt: bkk(day), status: "APPROVED", category: "SOFTWARE", satang: 200 });
    await seed({ requesterId: ids.owner, createdAt: bkk(day), status: "APPROVED", category: "FURNITURE", satang: 400 });
    await seed({ requesterId: ids.owner, createdAt: bkk(day), status: "APPROVED", category: null, satang: 800 });
    const pick = async (extra: string) => {
      const s = await summary(owner, onDay(day, extra));
      return [s.count, s.total];
    };
    expect(await pick("&status=APPROVED")).toEqual([3, 14]);
    expect(await pick("&category=SOFTWARE")).toEqual([2, 3]);
    expect(await pick("&status=APPROVED&category=SOFTWARE")).toEqual([1, 2]);
    expect(await pick("&category=OTHER")).toEqual([0, 0]);
    const file = await exported(owner, onDay(day, "&status=APPROVED&category=SOFTWARE"));
    expect(file.rows.map((r) => r[6])).toEqual(["2.00"]);
  });

  it("TEST-336 / AC-305: the dates are whole Bangkok days, whatever the server time zone", async () => {
    await seed({ requesterId: ids.owner, createdAt: bkk("2001-06-09", "23:59:59.999"), satang: 100 });
    await seed({ requesterId: ids.owner, createdAt: bkk("2001-06-10", "00:00:00.000"), satang: 200 });
    await seed({ requesterId: ids.owner, createdAt: bkk("2001-06-10", "23:59:59.999"), satang: 400 });
    await seed({ requesterId: ids.owner, createdAt: bkk("2001-06-11", "00:00:00.000"), satang: 800 });
    const zone = process.env.TZ;
    try {
      for (const tz of ["UTC", "America/Los_Angeles", "Asia/Tokyo"]) {
        process.env.TZ = tz;
        const total = async (query: string) => (await summary(owner, query)).total;
        expect([tz, await total("from=2001-06-10&to=2001-06-10")]).toEqual([tz, 6]);
        expect([tz, await total("from=2001-06-09&to=2001-06-09")]).toEqual([tz, 1]);
        expect([tz, await total("from=2001-06-11&to=2001-06-11")]).toEqual([tz, 8]);
        expect([tz, await total("from=2001-06-10&to=2001-06-11")]).toEqual([tz, 14]);
        const file = await exported(owner, "from=2001-06-10&to=2001-06-10");
        expect(file.rows.map((r) => r[8])).toEqual(["2001-06-10 23:59", "2001-06-10 00:00"]);
      }
    } finally {
      if (zone === undefined) delete process.env.TZ;
      else process.env.TZ = zone;
    }
  });

  it("TEST-337 / AC-306: wrong and repeated parameters give 422 on both routes; empty ones are ignored", async () => {
    const cases: [string, string[]][] = [
      ["from=2026-02-30", ["from"]],
      ["to=1-1-2026", ["to"]],
      ["from=0001-01-01", ["from"]],
      ["to=3000-01-01", ["to"]],
      ["from=2026-03-02&to=2026-03-01", ["to"]],
      ["status=DONE", ["status"]],
      ["status=approved", ["status"]],
      ["category=FOOD", ["category"]],
      ["category=software", ["category"]],
      ["from=bad&status=bad&category=bad", ["category", "from", "status"]],
      ["status=DRAFT&status=APPROVED", ["status"]],
      ["from=2026-01-01&from=2026-01-02&to=2026-01-03&to=2026-01-03", ["from", "to"]],
      ["from[a]=2026-01-01", ["from"]],
      // A repeated parameter is reported first and alone, although the other values are wrong too.
      ["status=DRAFT&status=APPROVED&category=FOOD&from=bad", ["status"]],
    ];
    for (const path of ["summary", "export.csv"]) {
      for (const [query, fields] of cases) {
        const res = await owner.get(`/api/reports/${path}?${query}`);
        expect([path, query, res.status]).toEqual([path, query, 422]);
        expect(Object.keys(res.body).sort()).toEqual(["code", "error", "fields"]);
        expect(res.body.code).toBe("VALIDATION_ERROR");
        expect([query, Object.keys(res.body.fields).sort()]).toEqual([query, fields]);
        expect(res.headers["content-disposition"]).toBeUndefined();
      }
      const empty = await owner.get(`/api/reports/${path}?from=&to=&status=&category=&other=1`);
      expect([path, empty.status]).toEqual([path, 200]);
    }
  });

  it("TEST-338 / AC-307: no session gives 401, and extra parameters widen nothing", async () => {
    for (const path of ["summary", "export.csv"]) {
      const res = await request(app).get(`/api/reports/${path}`);
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Authentication required." });
      expect(res.headers["content-disposition"]).toBeUndefined();
    }
    const day = "2001-07-10";
    await seed({ requesterId: ids.owner, createdAt: bkk(day), satang: 100 });
    await seed({ requesterId: ids.other, createdAt: bkk(day), satang: 200 });
    const widen = `&scope=all&requesterId=${ids.other}&userId=${ids.other}&role=ADMIN`;
    expect(await summary(owner, onDay(day, widen))).toEqual(await summary(owner, onDay(day)));
    expect((await exported(owner, onDay(day, widen))).rows.map((r) => r[6])).toEqual(["1.00"]);
  });

  it("TEST-339 / AC-308: headers, exact file name with the Bangkok date, line ends, order and the same set as the summary", async () => {
    const day = "2001-08-10";
    const first = await seed({ requesterId: ids.owner, createdAt: bkk(day, "09:00:00.000"), satang: 100 });
    const tieA = await seed({ requesterId: ids.owner, createdAt: bkk(day, "10:00:00.000"), satang: 200 });
    const tieB = await seed({ requesterId: ids.owner, createdAt: bkk(day, "10:00:00.000"), satang: 300 });
    await seed({ requesterId: ids.other, createdAt: bkk(day, "11:00:00.000"), status: "DRAFT", satang: 400 });
    // 18:00 UTC on 31 December is already 1 January in Bangkok.
    vi.useFakeTimers({ toFake: ["Date"] });
    try {
      vi.setSystemTime(new Date("2026-12-31T18:00:00.000Z"));
      const agents = await Promise.all([OWNER, APPROVER, ADMIN].map((email) => loginAgent(email)));
      // Newest first; two rows share a time, so the higher id comes first.
      const submittedOfOwner = [tieB, tieA, first].map((r) => r.requestNumber);
      for (const agent of agents) {
        for (const query of [onDay(day), onDay(day, "&status=SUBMITTED"), onDay("2001-08-11")]) {
          const { res, text, rows } = await exported(agent, query);
          expect(res.headers["content-type"]).toBe("text/csv; charset=utf-8");
          expect(res.headers["content-disposition"]).toBe('attachment; filename="purchase-requests-2027-01-01.csv"');
          expect(res.headers["cache-control"]).toBe("no-store");
          expect(text.endsWith("\r\n")).toBe(true);
          expect(text.replace(/\r\n/g, "")).not.toMatch(/[\r\n]/);
          const s = await summary(agent, query);
          expect(rows).toHaveLength(s.count);
          expect(rows.reduce((n, r) => n + satang(Number(r[6])), 0)).toBe(satang(s.total));
        }
        const numbers = (await exported(agent, onDay(day, "&status=SUBMITTED"))).rows.map((r) => r[0]);
        expect(numbers).toEqual(submittedOfOwner);
      }
      expect((await exported(agents[0], onDay("2001-08-11"))).rows).toEqual([]);
    } finally {
      vi.useRealTimers();
    }
  });

  it("TEST-340 / AC-309: labels, money, Bangkok times, empty fields and quoting", async () => {
    const day = "2001-09-10";
    const tricky = 'เครื่องพิมพ์, รุ่น "A4"\nชั้น 2';
    const draft = await seed({ requesterId: ids.owner, createdAt: bkk(day, "08:05:59.000"), status: "DRAFT", category: null, satang: 123_450, itemName: tricky });
    const decided = await seed({
      requesterId: ids.owner,
      createdAt: bkk(day, "07:00:00.000"),
      status: "APPROVED",
      category: "STATIONERY",
      quantity: 1000,
      satang: 100_000_000,
      itemName: "Paper",
      submittedAt: bkk(day, "23:30:00.000"),
      decidedAt: bkk("2001-09-11", "00:15:00.000"),
    });
    const { text, rows } = await exported(owner, onDay(day));
    expect(rows).toEqual([
      [draft.requestNumber, tricky, "", "Draft", "1", "1234.50", "1234.50", "F17 owner", `${day} 08:05`, "", ""],
      [decided.requestNumber, "Paper", "Stationery", "Approved", "1000", "1000000.00", "1000000000.00", "F17 owner", `${day} 07:00`, `${day} 23:30`, "2001-09-11 00:15"],
    ]);
    expect(text).toContain('"เครื่องพิมพ์, รุ่น ""A4""\nชั้น 2"');
  });

  it("TEST-341 / AC-310: text that a spreadsheet could run gets an apostrophe", async () => {
    const day = "2001-10-10";
    const dangerous = ["=1+1", "+SUM(A1:A2)", "-2+3", "@cmd", "\tTab first", "\rCR first", "\nLF first"];
    const ordinary = ["Chair = good", "a-b", "mail me @ noon", "1+1", "'quoted already", "เก้าอี้"];
    const all = [...dangerous, ...ordinary];
    // Stored directly: the form would trim a leading tab, CR or LF.
    for (const [i, itemName] of all.entries()) await seed({ requesterId: ids.owner, createdAt: bkk(day, `10:${String(59 - i).padStart(2, "0")}:00.000`), itemName });
    await seed({ requesterId: ids.formula, createdAt: bkk(day, "09:00:00.000"), itemName: "Normal item" });
    const { rows } = await exported(admin, onDay(day));
    expect(rows.slice(0, all.length).map((r) => r[1])).toEqual([...dangerous.map((n) => `'${n}`), ...ordinary]);
    expect(rows.at(-1)).toMatchObject({ 1: "Normal item", 7: "'=F17 Formula Name" });
    expect(rows[0][7]).toBe("F17 owner");
    expect(rows[0][5]).toBe("10.00");
  });

  it("TEST-342 / AC-311: no free text, attachment data or e-mail address is exported", async () => {
    const day = "2001-11-10";
    const row = await seed({
      requesterId: ids.owner,
      createdAt: bkk(day),
      status: "REJECTED",
      description: "MARK-DESCRIPTION",
      reason: "MARK-REASON",
      rejectionReason: "MARK-REJECTION",
    });
    const prisma = getPrisma();
    await prisma.requestHistory.create({ data: { requestId: row.id, actorId: ids.approver, action: "REJECTED", fromStatus: "SUBMITTED", toStatus: "REJECTED", comment: "MARK-HISTORY" } });
    await prisma.comment.create({ data: { requestId: row.id, authorId: ids.approver, text: "MARK-COMMENT" } });
    await prisma.attachment.create({ data: { requestId: row.id, uploadedById: ids.owner, fileName: "MARK-FILE.pdf", fileType: "application/pdf", sizeBytes: 9, content: Buffer.from("MARK-BODY") } });
    const { text, rows } = await exported(admin, onDay(day));
    expect(rows).toHaveLength(1);
    expect(text).not.toMatch(/MARK-/);
    expect(text).not.toContain("@test.local");
    expect(text).not.toMatch(/password|\$2[aby]\$/i);
  });

  it("TEST-343 / AC-312: 5,000 rows export, 5,001 are refused, and hidden rows do not count", async () => {
    const day = "2001-12-10";
    const bulk = await loginAgent(BULK);
    const many = Array.from({ length: 5000 }, () => rowData({ requesterId: ids.bulk, createdAt: bkk(day) }));
    await getPrisma().purchaseRequest.createMany({ data: many });
    for (let i = 0; i < 3; i++) await seed({ requesterId: ids.other, createdAt: bkk(day) });
    expect((await exported(bulk, onDay(day))).rows).toHaveLength(5000);
    await seed({ requesterId: ids.bulk, createdAt: bkk(day) });
    const res = await bulk.get(`/api/reports/export.csv?${onDay(day)}`);
    expect(res.status).toBe(422);
    expect(res.body).toEqual({ error: "Too many requests to export. Narrow the filters.", code: "EXPORT_TOO_LARGE" });
    expect(res.headers["content-type"]).toMatch(/^application\/json/);
    expect(res.headers["content-disposition"]).toBeUndefined();
    // The summary has no limit.
    expect((await summary(bulk, onDay(day))).count).toBe(5001);
    await getPrisma().purchaseRequest.deleteMany({ where: { requesterId: ids.bulk } });
  });

  it("TEST-344 / AC-313: reading and exporting change no row", async () => {
    await seed({ requesterId: ids.owner, createdAt: bkk("2002-01-10") });
    const prisma = getPrisma();
    const snapshot = async () => ({
      requests: await prisma.purchaseRequest.findMany({ where: { requesterId: ids.owner }, orderBy: { id: "asc" } }),
      history: await prisma.requestHistory.count(),
      notifications: await prisma.notification.count(),
      comments: await prisma.comment.count(),
      attachments: await prisma.attachment.count(),
      users: await prisma.user.count(),
    });
    const before = await snapshot();
    await summary(owner);
    await summary(admin);
    await exported(owner);
    expect(await snapshot()).toEqual(before);
  });

  it("TEST-345 / AC-314: a failed read gives the safe 500 and no part of a file", async () => {
    // The summary reads with a group query and the export with a list query; each is made to fail once.
    // The method is swapped by hand: restoring a spy on a Prisma model leaves the method undefined.
    const model = getPrisma().purchaseRequest as unknown as Record<string, unknown>;
    for (const [path, method] of [["summary", "groupBy"], ["export.csv", "findMany"]] as const) {
      const original = model[method];
      let calls = 0;
      model[method] = () => {
        calls += 1;
        return Promise.reject(new Error("forced read failure"));
      };
      const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
      try {
        const res = await owner.get(`/api/reports/${path}`).buffer(true).parse(binary);
        expect([path, calls]).toEqual([path, 1]);
        expect([path, res.status]).toEqual([path, 500]);
        expect(res.headers["content-type"]).toMatch(/^application\/json/);
        expect(res.headers["content-disposition"]).toBeUndefined();
        const body = (res.body as Buffer).toString("utf8");
        expect(JSON.parse(body)).toEqual({ error: "Something went wrong." });
        expect(body).not.toContain("\ufeff");
        expect(body).not.toContain("Request number");
      } finally {
        model[method] = original;
        quiet.mockRestore();
      }
    }
    // Reading works again afterwards.
    expect((await owner.get("/api/reports/summary")).status).toBe(200);
    expect((await download(owner, onDay("2002-01-10"))).status).toBe(200);
  });

  it("TEST-351 / AC-320: the report follows submit, return, approve, reject and cancel", async () => {
    const day = "2002-02-10";
    const create = async (unitPrice: number) => {
      const draft = await createDraft(owner, { quantity: 1, unitPrice });
      await getPrisma().purchaseRequest.update({ where: { id: draft.id }, data: { createdAt: bkk(day) } });
      return draft.id;
    };
    const first = await create(1);
    const second = await create(2);
    const third = await create(4);
    // approver2 never acts, so it is "another approver" throughout.
    const look = async () => {
      const read = async (agent: Agent) => {
        const s = await summary(agent, onDay(day));
        return { count: s.count, total: s.total, by: Object.fromEntries(s.byStatus.filter((r) => r.count > 0).map((r) => [r.status, r.count])) };
      };
      return { owner: await read(owner), approver: await read(approver2) };
    };
    expect(await look()).toEqual({ owner: { count: 3, total: 7, by: { DRAFT: 3 } }, approver: { count: 0, total: 0, by: {} } });
    expect((await submit(owner, first)).status).toBe(200);
    expect(await look()).toEqual({ owner: { count: 3, total: 7, by: { DRAFT: 2, SUBMITTED: 1 } }, approver: { count: 1, total: 1, by: { SUBMITTED: 1 } } });
    const back = await approver.post(`/api/requests/${first}/return`).set("Origin", ORIGIN).send({ reason: "Please add the details" });
    expect(back.status).toBe(200);
    expect(await look()).toEqual({ owner: { count: 3, total: 7, by: { DRAFT: 3 } }, approver: { count: 0, total: 0, by: {} } });
    await submit(owner, first);
    expect((await approve(approver, first)).status).toBe(200);
    expect((await look()).approver).toEqual({ count: 1, total: 1, by: { APPROVED: 1 } });
    await submit(owner, second);
    expect((await reject(approver, second, "Not needed now")).status).toBe(200);
    expect((await look()).owner.by).toEqual({ APPROVED: 1, REJECTED: 1, DRAFT: 1 });
    await submit(owner, third);
    expect((await cancel(owner, third)).status).toBe(200);
    expect(await look()).toEqual({
      owner: { count: 3, total: 7, by: { APPROVED: 1, REJECTED: 1, CANCELLED: 1 } },
      approver: { count: 3, total: 7, by: { APPROVED: 1, REJECTED: 1, CANCELLED: 1 } },
    });
  });
});
