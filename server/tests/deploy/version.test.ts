import request from "supertest";
import { afterAll, afterEach, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

const SHA = "9b45d8d0123456789abcdef0123456789abcdef0";
const original = process.env.APP_COMMIT;

afterEach(() => {
  if (original === undefined) delete process.env.APP_COMMIT;
  else process.env.APP_COMMIT = original;
});
afterAll(async () => {
  await getPrisma().$disconnect();
});

describe("GET /api/version shows which commit is running", () => {
  it("returns the commit set at deploy time, with no login and no origin header", async () => {
    process.env.APP_COMMIT = SHA;
    const res = await request(app).get("/api/version");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ commit: SHA });
  });

  it("returns 'unknown' when no commit was set (local development)", async () => {
    delete process.env.APP_COMMIT;
    const res = await request(app).get("/api/version");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ commit: "unknown" });
  });

  it("never echoes a value that is not a commit SHA", async () => {
    process.env.APP_COMMIT = "<script>alert(1)</script>";
    const res = await request(app).get("/api/version");
    expect(res.body).toEqual({ commit: "unknown" });
  });
});
