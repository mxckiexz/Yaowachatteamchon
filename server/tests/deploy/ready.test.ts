import request from "supertest";
import { afterAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";

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
});
