import { defineConfig, devices } from "@playwright/test";

// End-to-end tests run against the real API, database and client.
//   npx playwright test
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", trace: "retain-on-failure", screenshot: "only-on-failure" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    { command: "npm run dev", cwd: "server", url: "http://localhost:3000/api/health", reuseExistingServer: true, timeout: 30_000 },
    { command: "npm run dev", cwd: "client", url: "http://localhost:5173", reuseExistingServer: true, timeout: 30_000 },
  ],
});
