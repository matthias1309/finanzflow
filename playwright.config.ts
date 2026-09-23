import { defineConfig, devices } from "@playwright/test";

export default defineConfig({
  testDir: "tests/e2e",
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: "list",
  use: {
    baseURL: "http://localhost:3001",
    trace: "on-first-retry",
  },
  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
  webServer: {
    // Separate port and DB so E2E tests don't touch the dev database.
    command: "DB_PATH=/tmp/finanzflow_e2e.db PORT=3001 npm run dev",
    url: "http://localhost:3001",
    // Reuse an already-running server locally; always start fresh in CI.
    reuseExistingServer: !process.env.CI,
    stdout: "ignore",
    stderr: "ignore",
    timeout: 30_000,
  },
  globalSetup: "tests/e2e/globalSetup.ts",
});
