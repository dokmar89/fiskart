import "dotenv/config";
import { defineConfig, devices } from "@playwright/test";
import { e2eDatabaseUrl } from "./e2e/database-url";
import { AI_TEST_KEY, STOCK_MOCK_PORT, STOCK_TEST_KEY } from "./e2e/stock-config";

// A separate port, build directory and database, so tests neither reuse nor disturb a running `pnpm dev`.
const port = 3100;

export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/warm-up.ts",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // The editor tests drive real mouse input against a dev server; more workers mostly add contention.
  workers: 3,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${port}`,
    trace: "retain-on-failure",
    viewport: { width: 1440, height: 900 },
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
  webServer: [
    // Stands in for Pexels and Iconify, so the stock tabs are tested without internet or a real key.
    {
      command: "pnpm exec tsx e2e/stock-mock.ts",
      url: `http://localhost:${STOCK_MOCK_PORT}/iconify/search`,
      reuseExistingServer: !process.env.CI,
    },
    {
      command: `pnpm exec tsx e2e/prepare-db.ts && pnpm exec next dev --turbopack --port ${port}`,
      url: `http://localhost:${port}`,
      reuseExistingServer: !process.env.CI,
      timeout: 180_000,
      env: {
        DATABASE_URL: e2eDatabaseUrl(),
        DATA_DIR: "./data-e2e",
        NEXT_DIST_DIR: ".next-e2e",
        PEXELS_API_KEY: STOCK_TEST_KEY,
        PEXELS_API_URL: `http://localhost:${STOCK_MOCK_PORT}/pexels/v1`,
        ICONIFY_API_URL: `http://localhost:${STOCK_MOCK_PORT}/iconify`,
        ANTHROPIC_API_KEY: AI_TEST_KEY,
        ANTHROPIC_BASE_URL: `http://localhost:${STOCK_MOCK_PORT}/anthropic`,
        OPENAI_API_KEY: AI_TEST_KEY,
        OPENAI_BASE_URL: `http://localhost:${STOCK_MOCK_PORT}/openai/v1`,
      },
    },
  ],
});
