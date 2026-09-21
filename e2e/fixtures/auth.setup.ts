import { test as setup, expect } from "@playwright/test";
import path from "path";

/**
 * Playwright global-setup-style auth: logs in once per role, saves the
 * resulting cookies to a storageState file, and every real spec reuses it
 * via `test.use({ storageState: ADMIN_STATE })` instead of re-logging-in
 * per test. Standard Playwright pattern for this — see
 * https://playwright.dev/docs/auth
 *
 * Deliberately NOT run as part of the default `npm run test:e2e` — these
 * two projects are opt-in (see playwright.config.ts's `testMatch`/grep, or
 * run directly: `npx playwright test --project=admin-setup`) because they
 * need real credentials in E2E_ADMIN_EMAIL/PASSWORD and
 * E2E_AGENT_EMAIL/PASSWORD (.env.e2e), which aren't populated by default.
 * This file has never been executed in this session — no password has
 * ever been typed by anything other than a human running it deliberately.
 */

export const ADMIN_STATE = path.join(__dirname, ".auth-admin.json");
export const AGENT_STATE = path.join(__dirname, ".auth-agent.json");

setup("authenticate as admin", async ({ page }) => {
  const email = process.env.E2E_ADMIN_EMAIL;
  const password = process.env.E2E_ADMIN_PASSWORD;
  if (!email || !password) {
    setup.skip(true, "E2E_ADMIN_EMAIL/E2E_ADMIN_PASSWORD not set in .env.e2e — skipping admin auth setup.");
    return;
  }

  await page.goto("/admin/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/admin\/overview/, { timeout: 15_000 });
  await page.context().storageState({ path: ADMIN_STATE });
});

setup("authenticate as agent", async ({ page }) => {
  const email = process.env.E2E_AGENT_EMAIL;
  const password = process.env.E2E_AGENT_PASSWORD;
  if (!email || !password) {
    setup.skip(true, "E2E_AGENT_EMAIL/E2E_AGENT_PASSWORD not set in .env.e2e — skipping agent auth setup.");
    return;
  }

  await page.goto("/agent/login");
  await page.getByLabel("Email").fill(email);
  await page.getByLabel("Password").fill(password);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/agent(?!\/login)/, { timeout: 15_000 });
  await page.context().storageState({ path: AGENT_STATE });
});
