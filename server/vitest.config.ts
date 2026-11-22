import { defineConfig } from "vitest/config";

// Tests need DATABASE_URL: load server/.env when it exists, so `npm test` works without exporting variables first.
try {
  process.loadEnvFile(".env");
} catch {
  // .env is optional when the variables are already in the environment
}

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    // The API tests share one real PostgreSQL database, so test files run one at a time.
    fileParallelism: false,
    // bcrypt cost 12 makes the login tests slow (TEST-80 does eight logins, about 5 s on a busy machine). 30 s avoids random timeouts.
    testTimeout: 30_000,
    hookTimeout: 30_000,
  },
});
