import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { app } from "../../src/app.js";
import { getPrisma } from "../../src/prisma.js";
import { cleanupUsers, createUser, FIXTURE_PASSWORD, loginAgent, ORIGIN } from "../helpers/fixtures.js";

const ADM = "f05-adm@test.local";
const REQ = "f05-req@test.local";
const APP = "f05-app@test.local";
const TARGET = "f05-target@test.local";
const ALL = [ADM, REQ, APP, TARGET];
let ids: Record<string, number> = {};

beforeAll(async () => {
  ids[ADM] = (await createUser(ADM, { role: "ADMIN", name: "Admin" })).id;
  ids[REQ] = (await createUser(REQ, { role: "REQUESTER", name: "Ploy" })).id;
  ids[APP] = (await createUser(APP, { role: "APPROVER", name: "Somchai" })).id;
  ids[TARGET] = (await createUser(TARGET, { role: "REQUESTER", name: "Target" })).id;
});
afterAll(async () => {
  await cleanupUsers(ALL);
  await getPrisma().$disconnect();
});

const patch = (agent: any, id: number | string, body: unknown) => agent.patch(`/api/admin/users/${id}`).set("Origin", ORIGIN).send(body);
const stored = (email: string) => getPrisma().user.findUniqueOrThrow({ where: { email } });

describe("F-05 administrator, user management", () => {
  it("TEST-61 / AC-39: the administrator lists users without any password hash", async () => {
    const admin = await loginAgent(ADM);
    const res = await admin.get("/api/admin/users");
    expect(res.status).toBe(200);
    const target = res.body.users.find((u: any) => u.email === TARGET);
    expect(target).toMatchObject({ id: ids[TARGET], name: "Target", role: "REQUESTER", isActive: true });
    expect(target.createdAt).toBeTruthy();
    expect(JSON.stringify(res.body)).not.toMatch(/passwordHash|\$2[aby]\$/);
  });

  it("TEST-62 / AC-39: a requester and an approver get 403 and no data, and cannot change a user", async () => {
    for (const email of [REQ, APP]) {
      const agent = await loginAgent(email);
      const list = await agent.get("/api/admin/users");
      expect(list.status, email).toBe(403);
      expect(list.body.users).toBeUndefined();
      expect((await patch(agent, ids[TARGET], { isActive: false })).status, email).toBe(403);
      expect((await patch(agent, ids[TARGET], { role: "ADMIN" })).status, email).toBe(403);
    }
    expect(await stored(TARGET)).toMatchObject({ isActive: true, role: "REQUESTER" });
  });

  it("TEST-63 / AC-40: after the administrator deactivates a user, they cannot log in and their session stops at once", async () => {
    const user = await loginAgent(TARGET);
    expect((await user.get("/api/auth/me")).status).toBe(200);
    const admin = await loginAgent(ADM);
    const res = await patch(admin, ids[TARGET], { isActive: false });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id: ids[TARGET], isActive: false });
    expect((await user.get("/api/auth/me")).status).toBe(401);
    const login = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: TARGET, password: FIXTURE_PASSWORD });
    expect(login.status).toBe(401);
  });

  it("TEST-64 / AC-41: the administrator reactivates a user, who can then log in", async () => {
    const admin = await loginAgent(ADM);
    expect((await patch(admin, ids[TARGET], { isActive: true })).status).toBe(200);
    const login = await request(app).post("/api/auth/login").set("Origin", ORIGIN).send({ email: TARGET, password: FIXTURE_PASSWORD });
    expect(login.status).toBe(200);
  });

  it("TEST-65 / AC-41: the role can be changed to a valid value; invalid values and an empty body give 422", async () => {
    const admin = await loginAgent(ADM);
    const ok = await patch(admin, ids[TARGET], { role: "APPROVER" });
    expect(ok.status).toBe(200);
    expect(ok.body.user.role).toBe("APPROVER");
    for (const body of [{ role: "BOSS" }, { role: "" }, { role: 5 }, {}]) {
      const res = await patch(admin, ids[TARGET], body);
      expect(res.status, JSON.stringify(body)).toBe(422);
    }
    expect((await stored(TARGET)).role).toBe("APPROVER");
    expect((await patch(admin, ids[TARGET], { role: "REQUESTER" })).status).toBe(200);
  });

  it("TEST-66 / AC-42: the administrator cannot change their own account", async () => {
    const admin = await loginAgent(ADM);
    for (const body of [{ isActive: false }, { role: "REQUESTER" }]) {
      const res = await patch(admin, ids[ADM], body);
      expect(res.status, JSON.stringify(body)).toBe(409);
      expect(res.body.code).toBe("SELF_CHANGE");
    }
    expect(await stored(ADM)).toMatchObject({ isActive: true, role: "ADMIN" });
    expect((await admin.get("/api/admin/users")).status).toBe(200);
  });

  it("TEST-67 / AC-43: an unknown id gives 404 and an invalid body gives 422", async () => {
    const admin = await loginAgent(ADM);
    expect((await patch(admin, 999999, { isActive: false })).status).toBe(404);
    expect((await patch(admin, "abc", { isActive: false })).status).toBe(404);
    const bad = await patch(admin, ids[TARGET], { isActive: "yes" });
    expect(bad.status).toBe(422);
    expect(bad.body.code).toBe("VALIDATION_ERROR");
    expect((await stored(TARGET)).isActive).toBe(true);
  });
});
