import { test, expect } from "@playwright/test";

test.describe("PWA basics", () => {
  test("has correct page title", async ({ page }) => {
    await page.goto("/login");
    await expect(page).toHaveTitle("Heritage Motor");
  });

  test("has manifest link pointing to manifest.json", async ({ page }) => {
    await page.goto("/login");
    const manifest = page.locator('link[rel="manifest"]');
    await expect(manifest).toHaveAttribute("href", /manifest/);
  });

  test("has viewport meta for mobile", async ({ page }) => {
    await page.goto("/login");
    const viewport = page.locator('meta[name="viewport"]');
    await expect(viewport).toHaveAttribute("content", /width=device-width/);
  });

  test("has theme-color meta", async ({ page }) => {
    await page.goto("/login");
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toHaveAttribute("content", "#0e0d0b");
  });

  test("has apple-mobile-web-app-capable meta", async ({ page }) => {
    await page.goto("/login");
    const appleMeta = page.locator('meta[name="apple-mobile-web-app-capable"]');
    await expect(appleMeta).toHaveAttribute("content", "yes");
  });

  test("html lang attribute is set to en", async ({ page }) => {
    await page.goto("/login");
    const html = page.locator("html");
    await expect(html).toHaveAttribute("lang", "en");
  });
});
