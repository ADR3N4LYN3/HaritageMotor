import { test, expect } from "@playwright/test";

test.describe("Login page", () => {
  test("shows login form with Heritage Motor branding", async ({ page }) => {
    await page.goto("/login");

    // Heading: "Heritage Motor" in gold
    await expect(page.getByRole("heading", { name: "Heritage Motor" })).toBeVisible();

    // Subtitle
    await expect(page.getByText("Vehicle Custody Platform")).toBeVisible();

    // Email and password inputs (placeholders, no <label>)
    await expect(page.getByPlaceholder("Email")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();

    // Submit button
    await expect(page.getByRole("button", { name: "Sign In" })).toBeVisible();
  });

  test("does not submit with empty fields (HTML5 validation)", async ({ page }) => {
    await page.goto("/login");
    await page.getByRole("button", { name: "Sign In" }).click();

    // HTML5 required prevents submission — we stay on /login
    await expect(page).toHaveURL(/\/login/);
  });

  test("does not submit with only email filled", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill("test@example.com");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Password is required — stays on /login
    await expect(page).toHaveURL(/\/login/);
  });

  test("shows error on invalid credentials", async ({ page }) => {
    await page.goto("/login");
    await page.getByPlaceholder("Email").fill("wrong@example.com");
    await page.getByPlaceholder("Password").fill("wrongpassword123!");
    await page.getByRole("button", { name: "Sign In" }).click();

    // Either shows an error message or stays on /login (no backend = connection error)
    await expect(page).toHaveURL(/\/login/);

    // Should display "Connection failed" since there's no backend
    await expect(page.getByText("Connection failed")).toBeVisible({ timeout: 10000 });
  });

  test("password visibility toggle works", async ({ page }) => {
    await page.goto("/login");
    const passwordInput = page.getByPlaceholder("Password");

    // Initially type="password"
    await expect(passwordInput).toHaveAttribute("type", "password");

    // Click the eye toggle button (tabindex=-1 button inside the password field container)
    await page.locator("input[placeholder='Password'] + button").click();
    await expect(passwordInput).toHaveAttribute("type", "text");

    // Click again to hide
    await page.locator("input[placeholder='Password'] + button").click();
    await expect(passwordInput).toHaveAttribute("type", "password");
  });

  test("email input has correct type and autocomplete", async ({ page }) => {
    await page.goto("/login");
    const emailInput = page.getByPlaceholder("Email");

    await expect(emailInput).toHaveAttribute("type", "email");
    await expect(emailInput).toHaveAttribute("autocomplete", "email");
  });

  test("password input has minlength 8", async ({ page }) => {
    await page.goto("/login");
    const passwordInput = page.getByPlaceholder("Password");

    await expect(passwordInput).toHaveAttribute("minlength", "8");
  });
});
