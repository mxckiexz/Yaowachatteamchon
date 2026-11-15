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
  },
});
