import { test, expect } from "@playwright/test";

/**
 * Admin journey — requires the "admin" Playwright project (real login via
 * admin-setup). NOT run by default `npm run test:e2e`, and NOT executed
 * by Claude in this session — running it means typing and submitting a
 * real password, which is off-limits regardless of how it's invoked.
 * A human (or CI, independently) runs this with:
 *   npx playwright test --project=admin-setup --project=admin
 * once E2E_ADMIN_EMAIL/PASSWORD are set in .env.e2e.
 */

test.describe("Admin — campaigns list", () => {
  test("loads without error and shows the campaigns table", async ({ page }) => {
    await page.goto("/admin/campaigns");
    await expect(page.getByRole("heading", { name: "Campaigns" })).toBeVisible();
    // Either real rows or the empty state — both are a correctly-loaded
    // page; what must NOT happen is an error screen or an infinite spinner.
    await expect(page.getByText(/couldn't load campaigns/i)).toHaveCount(0);
  });

  test("can open a campaign from the list into its detail view", async ({ page }) => {
    await page.goto("/admin/campaigns");
    const firstCampaignLink = page.locator("table tbody tr a").first();
    if ((await firstCampaignLink.count()) === 0) {
      test.skip(true, "No campaigns exist to click through — seed at least one first.");
      return;
    }
    await firstCampaignLink.click();
    await expect(page).toHaveURL(/\/admin\/campaigns\/[0-9a-f-]+$/);
    await expect(page.getByRole("link", { name: "Invitations" })).toBeVisible();
  });
});
