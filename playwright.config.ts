import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end tests against the production build (pnpm build first, or `pnpm test:e2e` does it).
 * Locally they use the installed Microsoft Edge; in CI run `pnpm exec playwright install chromium` once.
 */
const PORT = 3300;
export default defineConfig({
  testDir: "tests",
  timeout: 30_000,
  fullyParallel: true,
  reporter: [["list"]],
  use: {
    baseURL: `http://localhost:${PORT}`,
    channel: process.env.CI ? undefined : "msedge",
    locale: "ar-EG",
  },
  projects: [
    { name: "desktop", use: { ...devices["Desktop Edge"], channel: process.env.CI ? undefined : "msedge" }, testIgnore: /mobile.spec.ts/ },
    { name: "mobile", use: { ...devices["Pixel 7"], channel: process.env.CI ? undefined : "msedge" }, testMatch: /mobile\.spec\.ts/ },
  ],
  webServer: {
    command: `pnpm start -p ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
