import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { verifyPassword } from "../../src/auth.js";
import { getPrisma } from "../../src/prisma.js";
import { seedDemoData } from "../../src/seedData.js";
import { cleanupUsers } from "../helpers/fixtures.js";

const ACCOUNTS = [
  { name: "Seed Req", email: "seedsafety-req@test.local", role: "REQUESTER" as const },
  { name: "Seed Admin", email: "seedsafety-admin@test.local", role: "ADMIN" as const },
];
const EMAILS = ACCOUNTS.map((a) => a.email);

beforeAll(async () => {
  await cleanupUsers(EMAILS);
});
afterAll(async () => {
  await cleanupUsers(EMAILS);
  await getPrisma().$disconnect();
});

describe("seed does not destroy data on a later run (production rule)", () => {
  it("creates the accounts when they are missing", async () => {
    await seedDemoData("first-secret-value-1", { accounts: ACCOUNTS, overwrite: false });
    const users = await getPrisma().user.findMany({ where: { email: { in: EMAILS } } });
    expect(users).toHaveLength(2);
    expect(await verifyPassword("first-secret-value-1", users[0].passwordHash)).toBe(true);
  });

  it("with overwrite off, a second run keeps a changed role, a deactivation and a changed password", async () => {
    const prisma = getPrisma();
    await prisma.user.update({ where: { email: ACCOUNTS[0].email }, data: { isActive: false, role: "APPROVER" } });
    const before = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS[0].email } });
    await seedDemoData("second-secret-value-2", { accounts: ACCOUNTS, overwrite: false });
    const after = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS[0].email } });
    expect(after.isActive).toBe(false);
    expect(after.role).toBe("APPROVER");
    expect(after.passwordHash).toBe(before.passwordHash);
  });

  it("with overwrite on (local development), a rerun resets role, status and password", async () => {
    const prisma = getPrisma();
    await seedDemoData("local-reset-value-3", { accounts: ACCOUNTS, overwrite: true });
    const user = await prisma.user.findUniqueOrThrow({ where: { email: ACCOUNTS[0].email } });
    expect(user.isActive).toBe(true);
    expect(user.role).toBe("REQUESTER");
    expect(await verifyPassword("local-reset-value-3", user.passwordHash)).toBe(true);
  });

  it("overwrite follows NODE_ENV by default: off in production, on elsewhere", async () => {
    const { defaultSeedOverwrite } = await import("../../src/seedData.js");
    expect(defaultSeedOverwrite("production")).toBe(false);
    expect(defaultSeedOverwrite("development")).toBe(true);
    expect(defaultSeedOverwrite(undefined)).toBe(true);
  });
});
