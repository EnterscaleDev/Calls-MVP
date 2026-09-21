import { test, expect } from "@playwright/test";

/**
 * Agent journey — requires the "agent" Playwright project (real login via
 * agent-setup). Same rule as admin-campaigns.auth.spec.ts: not run by
 * default, not executed by Claude in this session. A human (or CI) runs:
 *   npx playwright test --project=agent-setup --project=agent
 * once E2E_AGENT_EMAIL/PASSWORD are set in .env.e2e.
 */

test.describe("Agent — call queue", () => {
  test("loads without error", async ({ page }) => {
    await page.goto("/agent");
    await expect(page.getByRole("link", { name: "Queue" })).toBeVisible();
    await expect(page.getByRole("link", { name: "History" })).toBeVisible();
  });

  test("history tab loads without error", async ({ page }) => {
    await page.goto("/agent/history");
    await expect(page).toHaveURL(/\/agent\/history/);
  });
});
