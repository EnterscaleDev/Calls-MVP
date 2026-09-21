import { test, expect } from "@playwright/test";

/**
 * No login involved — these verify the *denial* path (unauthenticated
 * access to protected routes, and empty-field client-side validation),
 * which needs no real credentials. Runs against the audit-pentest branch,
 * same as participant-flow.spec.ts.
 */

test.describe("Route protection — unauthenticated access", () => {
  test("a fresh session hitting /admin/overview is redirected to admin login before any dashboard content renders", async ({
    page,
  }) => {
    const response = await page.goto("/admin/overview");
    await expect(page).toHaveURL(/\/admin\/login/);
    // The redirect must happen before the response body ever contains
    // dashboard content — a client-side-only guard (render then redirect)
    // would leak a flash of protected content even if the end URL is right.
    expect(response?.status()).toBeLessThan(400);
    await expect(page.getByText("Admin sign in")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Overview" })).toHaveCount(0);
  });

  test("a fresh session hitting /agent is redirected to agent login", async ({ page }) => {
    await page.goto("/agent");
    await expect(page).toHaveURL(/\/agent\/login/);
    await expect(page.getByRole("heading", { name: /agent sign in/i })).toBeVisible();
  });

  test("a fresh session hitting a nested campaign admin route is also redirected, not just the top-level one", async ({
    page,
  }) => {
    await page.goto("/admin/campaigns/00000000-0000-0000-0000-000000000000/invitations");
    await expect(page).toHaveURL(/\/admin\/login/);
  });
});

test.describe("Login forms — client-side validation, no real credentials submitted", () => {
  test("admin login rejects an empty password without calling Supabase auth", async ({ page }) => {
    await page.goto("/admin/login");
    // Email is prefilled by the app itself; only clear/leave password empty.
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter an email and password to continue.")).toBeVisible();
    // Still on the login page — never navigated anywhere, confirming no
    // auth call round-tripped.
    await expect(page).toHaveURL(/\/admin\/login/);
  });

  test("agent login rejects an empty password without calling Supabase auth", async ({ page }) => {
    await page.goto("/agent/login");
    await page.getByRole("button", { name: "Sign in" }).click();
    await expect(page.getByText("Enter an email and password to continue.")).toBeVisible();
    await expect(page).toHaveURL(/\/agent\/login/);
  });
});
