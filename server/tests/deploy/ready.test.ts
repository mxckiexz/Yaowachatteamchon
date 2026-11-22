import request from "supertest";
import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

afterEach(() => {
  vi.restoreAllMocks();
});
afterAll(async () => {
  await getPrisma().$disconnect();
});

describe("deployment readiness route", () => {
  it("GET /api/ready proves the database answers and reveals nothing else", async () => {
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ready", db: "connected" });
  });

  it("GET /api/ready needs no login and no origin header", async () => {
    const res = await request(app).get("/api/ready");
    expect(res.status).not.toBe(401);
    expect(res.status).not.toBe(403);
  });

  it("GET /api/ready returns 503 and { status: not_ready } when the database query fails, without leaking the error", async () => {
    const failure = new Error("connect ECONNREFUSED 10.0.0.5:5432 password authentication failed for user purchaseflow");
    vi.spyOn(getPrisma(), "$queryRaw").mockRejectedValueOnce(failure);
    const res = await request(app).get("/api/ready");
    expect(res.status).toBe(503);
    expect(res.body).toEqual({ status: "not_ready" });
    expect(JSON.stringify(res.body)).not.toMatch(/ECONNREFUSED|password|10\.0\.0\.5/);
  });

  it("GET /api/ready answers 200 again once the database is back", async () => {
    vi.spyOn(getPrisma(), "$queryRaw").mockRejectedValueOnce(new Error("down"));
    expect((await request(app).get("/api/ready")).status).toBe(503);
    vi.restoreAllMocks();
    expect((await request(app).get("/api/ready")).status).toBe(200);
  });
});
