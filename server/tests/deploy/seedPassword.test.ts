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
