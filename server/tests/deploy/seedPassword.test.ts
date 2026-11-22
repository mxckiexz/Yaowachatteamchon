import { describe, expect, it } from "vitest";
import { assertSeedPasswordAllowed } from "../../src/seedData.js";

describe("seed password guard", () => {
  it("allows the local demo password outside production", () => {
    expect(() => assertSeedPasswordAllowed("ChangeMe123!", "development")).not.toThrow();
    expect(() => assertSeedPasswordAllowed("short", undefined)).not.toThrow();
  });

  it("refuses the published example password in production", () => {
    expect(() => assertSeedPasswordAllowed("ChangeMe123!", "production")).toThrow(/example/i);
  });

  it("refuses a short password in production", () => {
    expect(() => assertSeedPasswordAllowed("Sh0rt-pw", "production")).toThrow(/12/);
  });

  it("accepts a long non-example password in production", () => {
    expect(() => assertSeedPasswordAllowed("a-long-generated-secret-9x", "production")).not.toThrow();
  });

  it("never puts the password in the error message", () => {
    try {
      assertSeedPasswordAllowed("ChangeMe123!", "production");
    } catch (e) {
      expect(String(e)).not.toContain("ChangeMe123!");
    }
  });
});

describe("which environment variables hold the seed passwords (managed environment names)", () => {
  it("uses SEED_DEFAULT_PASSWORD for every account when it is the only one set", async () => {
    const { resolveSeedPasswords } = await import("../../src/seedData.js");
    expect(resolveSeedPasswords({ SEED_DEFAULT_PASSWORD: "one-shared-secret-1" })).toEqual({ demo: "one-shared-secret-1", admin: "one-shared-secret-1" });
  });

  it("uses DEMO_USER_PASSWORD for the demo accounts and ADMIN_PASSWORD for the administrator", async () => {
    const { resolveSeedPasswords } = await import("../../src/seedData.js");
    expect(resolveSeedPasswords({ DEMO_USER_PASSWORD: "demo-secret-value-1", ADMIN_PASSWORD: "admin-secret-value-1" })).toEqual({
      demo: "demo-secret-value-1",
      admin: "admin-secret-value-1",
    });
  });

  it("SEED_DEFAULT_PASSWORD wins over DEMO_USER_PASSWORD for the demo accounts", async () => {
    const { resolveSeedPasswords } = await import("../../src/seedData.js");
    const r = resolveSeedPasswords({ SEED_DEFAULT_PASSWORD: "explicit-secret-1", DEMO_USER_PASSWORD: "demo-secret-value-1" });
    expect(r.demo).toBe("explicit-secret-1");
  });

  it("never gives the administrator password to the demo accounts: with only ADMIN_PASSWORD, no demo accounts are seeded", async () => {
    const { resolveSeedPasswords } = await import("../../src/seedData.js");
    expect(resolveSeedPasswords({ ADMIN_PASSWORD: "admin-secret-value-1" })).toEqual({ demo: undefined, admin: "admin-secret-value-1" });
  });

  it("fails with the variable names, and without any value, when no password is set", async () => {
    const { resolveSeedPasswords } = await import("../../src/seedData.js");
    expect(() => resolveSeedPasswords({})).toThrow(/SEED_DEFAULT_PASSWORD|DEMO_USER_PASSWORD|ADMIN_PASSWORD/);
  });
});
