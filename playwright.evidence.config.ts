import { defineConfig, devices } from "@playwright/test";

// Not part of the graded suite. Generates the pictures and text files used in the Deliverable 1 PDF:
//   npx playwright test -c playwright.evidence.config.ts
export default defineConfig({
  testDir: "./evidence",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  reporter: [["list"]],
  use: { baseURL: "http://localhost:5173", viewport: { width: 900, height: 480 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 900, height: 480 } } }],
  webServer: [
    { command: "npm run dev", cwd: "server", url: "http://localhost:3000/api/health", reuseExistingServer: true, timeout: 30_000 },
    { command: "npm run dev", cwd: "client", url: "http://localhost:5173", reuseExistingServer: true, timeout: 30_000 },
  ],
});
