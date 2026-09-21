import { test, expect } from "@playwright/test";

/**
 * Runs against the audit-pentest Supabase branch (see .env.e2e /
 * playwright.config.ts), never production. The valid-token fixture is
 * seeded directly in that branch's DB — see the E2E fixtures note in the
 * project's audit notes for the exact rows (campaign 22222222-…, participant
 * 44444444-…, token "e2e-test-token-9f3a7c21").
 *
 * No login involved — this is the token-only, no-account participant
 * surface, so it's safe to run end-to-end without any credentials.
 */
const VALID_TOKEN = "e2e-test-token-9f3a7c21";

test.describe("Participant landing — valid token", () => {
  test("renders the invitation and continues to consent", async ({ page }) => {
    await page.goto(`/participate/${VALID_TOKEN}`);

    await expect(page.getByText("E2E CLIENT", { exact: true })).toBeVisible();
    await expect(page.getByText(/minutes to hear about your/i)).toBeVisible();

    const continueLink = page.getByRole("link", { name: "Continue" });
    await expect(continueLink).toBeVisible();
    await continueLink.click();

    await page.waitForURL(new RegExp(`/participate/${VALID_TOKEN}/consent$`), { timeout: 15_000 });
  });
});

test.describe("Participant landing — invalid/garbage token", () => {
  test("shows a not-found state, not a crash or a leaked record", async ({ page }) => {
    await page.goto("/participate/this-token-does-not-exist-at-all");

    await expect(page.getByText("We couldn't find that invitation")).toBeVisible();
    // Must not fall through to rendering any real campaign content.
    await expect(page.getByRole("link", { name: "Continue" })).toHaveCount(0);
  });
});
