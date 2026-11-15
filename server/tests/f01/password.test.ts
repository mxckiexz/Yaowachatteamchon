import { afterAll, describe, expect, it } from "vitest";
import { getPrisma } from "../../src/prisma.js";
import { hashPassword, verifyPassword } from "../../src/auth.js";
import { seedDemoData, DEMO_ACCOUNTS } from "../../src/seedData.js";

afterAll(async () => {
  await getPrisma().$disconnect();
});

describe("F-01 password handling", () => {
  it("TEST-08 / AC-06: hashPassword produces a bcrypt hash (cost >= 10) that verifies only the right password", async () => {
    const hash = await hashPassword("Correct-Horse-1");
    expect(hash.startsWith("$2")).toBe(true);
    expect(Number(hash.split("$")[2])).toBeGreaterThanOrEqual(10);
    expect(hash).not.toContain("Correct-Horse-1");
    expect(await verifyPassword("Correct-Horse-1", hash)).toBe(true);
    expect(await verifyPassword("wrong", hash)).toBe(false);
  });

  it("TEST-09 / AC-06: seeded users hold bcrypt hashes, never the plaintext password", async () => {
    await seedDemoData("Seed-Test-Pass1");
    const users = await getPrisma().user.findMany({ where: { email: { in: DEMO_ACCOUNTS.map((a) => a.email) } } });
    expect(users).toHaveLength(DEMO_ACCOUNTS.length);
    for (const user of users) {
      expect(user.passwordHash.startsWith("$2")).toBe(true);
      expect(user.passwordHash).not.toContain("Seed-Test-Pass1");
    }
  });
});
