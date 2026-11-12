import { defineConfig, devices } from "@playwright/test";

/**
 * Smoke test of a running production install (the Docker app), not part of `pnpm e2e`:
 *   SMOKE_URL=http://127.0.0.1:3000 pnpm exec playwright test -c e2e-docker/playwright.config.ts
 * It creates a design called "Smoke" there.
 */
export default defineConfig({
  testDir: ".",
  reporter: "list",
  use: { baseURL: process.env.SMOKE_URL ?? "http://127.0.0.1:3000", viewport: { width: 1440, height: 900 } },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"], viewport: { width: 1440, height: 900 } } }],
});
