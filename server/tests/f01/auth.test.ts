import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, FIXTURE_PASSWORD, loginAgent, ORIGIN } from "../helpers/fixtures.js";

const EMP = "f01-emp@test.local";
const INACTIVE = "f01-inactive@test.local";
const WRONG_MESSAGE = "Invalid email or password.";

beforeAll(async () => {
  await createUser(EMP, { role: "EMPLOYEE", name: "Ploy" });
  await createUser(INACTIVE, { isActive: false });
});
afterAll(async () => {
  await cleanupUsers([EMP, INACTIVE]);
  await getPrisma().$disconnect();
});

describe("F-01 authentication", () => {
  it("TEST-01 / AC-01: correct credentials return the user and an HttpOnly cookie, no hash", async () => {
    const res = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: EMP, password: FIXTURE_PASSWORD });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: EMP, name: "Ploy", role: "EMPLOYEE" });
    expect(typeof res.body.user.id).toBe("number");
    expect(JSON.stringify(res.body)).not.toContain("passwordHash");
    const cookie = String(res.headers["set-cookie"]);
    expect(cookie).toContain("buyflow_session=");
    expect(cookie).toContain("HttpOnly");
  });

  it("TEST-02 / AC-02: a wrong password gives 401 with the standard message", async () => {
    const res = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: EMP, password: "nope-nope-1" });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: WRONG_MESSAGE });
  });

  it("TEST-03 / AC-02: an unknown e-mail gives exactly the same response as a wrong password", async () => {
    const wrong = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: EMP, password: "nope-nope-1" });
    const unknown = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: "nobody@test.local", password: "nope-nope-1" });
    expect(unknown.status).toBe(401);
    expect(unknown.body).toEqual(wrong.body);
  });

  it("TEST-04 / AC-03: me returns the current user for a valid session", async () => {
    const agent = await loginAgent(EMP);
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: EMP, role: "EMPLOYEE" });
  });

  it("TEST-05 / AC-03: me without a session gives 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("TEST-06 / AC-04: logout destroys the session and is idempotent", async () => {
    const login = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: EMP, password: FIXTURE_PASSWORD });
    expect(login.status).toBe(200);
    const cookie = String(login.headers["set-cookie"]).split(";")[0];
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(200);
    expect((await request(app).post("/api/auth/logout").set("Origin", ORIGIN).set("Cookie", cookie)).status).toBe(204);
    // Replay the old cookie: the server must not accept it any more.
    expect((await request(app).get("/api/auth/me").set("Cookie", cookie)).status).toBe(401);
    expect((await request(app).post("/api/auth/logout").set("Origin", ORIGIN).set("Cookie", cookie)).status).toBe(204);
  });

  it("TEST-07 / AC-05: an expired session gives 401", async () => {
    const agent = await loginAgent(EMP);
    const user = await getPrisma().user.findUniqueOrThrow({ where: { email: EMP } });
    await getPrisma().session.updateMany({ where: { userId: user.id }, data: { expiresAt: new Date(Date.now() - 1000) } });
    const res = await agent.get("/api/auth/me");
    expect(res.status).toBe(401);
  });

  it("TEST-10 / AC-07: an inactive user cannot log in", async () => {
    const res = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: INACTIVE, password: FIXTURE_PASSWORD });
    expect(res.status).toBe(401);
    expect(res.body).toEqual({ error: WRONG_MESSAGE });
  });

  it("TEST-12 / AC-09: a state-changing request with a foreign Origin is rejected and the session survives", async () => {
    const agent = await loginAgent(EMP);
    const res = await agent.post("/api/auth/logout").set("Origin", "http://evil.example");
    expect(res.status).toBe(403);
    expect((await agent.get("/api/auth/me")).status).toBe(200);
  });

  it("TEST-41 / AC-33: malformed JSON gives 400 and no stack trace", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .set("Origin", ORIGIN)
      .set("Content-Type", "application/json")
      .send("{ not json");
    expect(res.status).toBe(400);
    expect(typeof res.body.error).toBe("string");
    expect(res.body.stack).toBeUndefined();
    expect(JSON.stringify(res.body)).not.toMatch(/\bat \S+ \(|node_modules|\.ts:\d+/);
  });

  it("TEST-42 / AC-34: health is public", async () => {
    const res = await request(app).get("/api/health");
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});
