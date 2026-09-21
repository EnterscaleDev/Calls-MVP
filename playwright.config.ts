import { defineConfig, devices } from "@playwright/test";
import { readFileSync, existsSync } from "fs";
import path from "path";

/**
 * Loads .env.e2e into a plain object rather than relying on Next.js's own
 * dotenv conventions (.env.test etc.) — this config needs the same values
 * both to pass into the spawned `next dev` process (webServer.env) and,
 * potentially, to itself. Deliberately minimal parser: no need for a new
 * dependency just to read KEY=VALUE lines.
 */
function loadEnvFile(filePath: string): Record<string, string> {
  if (!existsSync(filePath)) return {};
  const out: Record<string, string> = {};
  for (const line of readFileSync(filePath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq === -1) continue;
    out[trimmed.slice(0, eq)] = trimmed.slice(eq + 1);
  }
  return out;
}

const e2eEnv = loadEnvFile(path.join(__dirname, ".env.e2e"));
const PORT = 3100;
const baseURL = `http://localhost:${PORT}`;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false, // shared branch DB — avoid cross-test data races
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: [["list"]],
  use: {
    baseURL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [
    {
      // Default project — no-auth specs only. `npm run test:e2e` runs just
      // this, so it never needs real credentials.
      name: "chromium",
      testIgnore: /fixtures\/|\.auth\.spec\.ts$/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Opt-in only (`npx playwright test --project=admin-setup`) — logs in
      // for real, so it needs E2E_ADMIN_EMAIL/PASSWORD populated first.
      name: "admin-setup",
      testMatch: /fixtures\/auth\.setup\.ts/,
      grep: /authenticate as admin/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      name: "agent-setup",
      testMatch: /fixtures\/auth\.setup\.ts/,
      grep: /authenticate as agent/,
      use: { ...devices["Desktop Chrome"] },
    },
    {
      // Opt-in only (`npx playwright test --project=admin`) — depends on
      // admin-setup, so it runs the real login first.
      name: "admin",
      testMatch: /\.auth\.spec\.ts$/,
      testIgnore: /agent\./,
      dependencies: ["admin-setup"],
      use: { ...devices["Desktop Chrome"], storageState: path.join(__dirname, "e2e/fixtures/.auth-admin.json") },
    },
    {
      name: "agent",
      testMatch: /agent\..*\.auth\.spec\.ts$/,
      dependencies: ["agent-setup"],
      use: { ...devices["Desktop Chrome"], storageState: path.join(__dirname, "e2e/fixtures/.auth-agent.json") },
    },
  ],
  webServer: {
    command: `npm run dev -- -p ${PORT}`,
    url: baseURL,
    reuseExistingServer: !process.env.CI,
    env: e2eEnv,
    timeout: 60_000,
  },
});
