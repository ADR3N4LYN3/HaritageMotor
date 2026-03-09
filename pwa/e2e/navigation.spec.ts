import { test, expect } from "@playwright/test";

test.describe("Navigation & Auth redirects", () => {
  test("unauthenticated user on /dashboard is redirected to /login", async ({ page }) => {
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user on /scan is redirected to /login", async ({ page }) => {
    await page.goto("/scan");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user on /vehicle/123 is redirected to /login", async ({ page }) => {
    await page.goto("/vehicle/123");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user on /admin is redirected to /login", async ({ page }) => {
    await page.goto("/admin");
    await expect(page).toHaveURL(/\/login/);
  });

  test("unauthenticated user on /change-password is redirected to /login", async ({ page }) => {
    await page.goto("/change-password");
    await expect(page).toHaveURL(/\/login/);
  });

  test("/login is accessible without authentication", async ({ page }) => {
    await page.goto("/login");
    // Should NOT redirect — stays on /login
    await expect(page).toHaveURL(/\/login/);
    // Login form is rendered
    await expect(page.getByRole("heading", { name: "Heritage Motor" })).toBeVisible();
  });
});
