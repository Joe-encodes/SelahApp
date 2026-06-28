import { test, expect } from "@playwright/test";

test.describe("SelahApp E2E Flow", () => {
  test.beforeEach(async ({ page }) => {
    // Intercept Supabase Auth calls and mock them
    await page.route("**/auth/v1/**", async (route) => {
      const url = route.request().url();
      if (url.includes("/token")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            access_token: "mock-access-token",
            refresh_token: "mock-refresh-token",
            expires_in: 3600,
            token_type: "bearer",
            user: {
              id: "mock-user-id",
              email: "test@example.com",
              user_metadata: {
                full_name: "Choir Director"
              }
            }
          })
        });
      } else if (url.includes("/user")) {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            id: "mock-user-id",
            email: "test@example.com",
            user_metadata: {
              full_name: "Choir Director"
            }
          })
        });
      } else {
        await route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({})
        });
      }
    });

    // Intercept API save calls to be completely offline-friendly
    await page.route("**/api/song/save", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ id: 12345, user_id: "mock-user-id" }),
      });
    });

    // Mock comments fetching
    await page.route("**/api/song/comments**", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify([]),
      });
    });
  });

  test("should render the sign-in page correctly", async ({ page }) => {
    await page.goto("/auth");

    // Expect the title to be correct
    await expect(page).toHaveTitle(/Selah — Sign In/);

    // Verify elements are visible and interactable
    const emailInput = page.locator("#auth-email-input");
    const passwordInput = page.locator("#auth-password-input");
    const submitBtn = page.locator("#auth-submit-btn");

    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    await expect(submitBtn).toBeVisible();
  });

  test("should toggle between Sign In and Create Account modes", async ({ page }) => {
    await page.goto("/auth");

    const createAccountTab = page.locator("#auth-toggle-signup");
    const signInTab = page.locator("#auth-toggle-signin");

    // Click Create Account
    await createAccountTab.click();
    await expect(page.locator("#auth-submit-btn")).toHaveText("Create Account");

    // Click Sign In
    await signInTab.click();
    await expect(page.locator("#auth-submit-btn")).toHaveText("Sign In");
  });

  test("should validate email format on submit click", async ({ page }) => {
    await page.goto("/auth");

    // Fill malformed email
    await page.locator("#auth-email-input").fill("invalidemail");
    await page.locator("#auth-password-input").fill("short");
    await page.locator("#auth-submit-btn").click();

    // Check if HTML5 validation or form state holds
    const emailValidity = await page.locator("#auth-email-input").evaluate((el) => el.validity.valid);
    expect(emailValidity).toBe(false);
  });

  test("should navigate tabs, conditionally render search bar, and validate chord editing on song details page", async ({ page }) => {
    // 1. Sign in
    await page.goto("/auth");
    await page.locator("#auth-email-input").fill("test@example.com");
    await page.locator("#auth-password-input").fill("password123");
    await page.locator("#auth-submit-btn").click();

    // Redirect to home page
    await page.waitForURL("**/app");

    // Discover (home) tab should be active. Verify search bar is visible.
    const searchBar = page.locator("input[placeholder='Search songs, themes, scriptures...']");
    await expect(searchBar).toBeVisible();

    // 2. Navigate to Create Studio tab
    await page.locator("#nav-create").click();
    await expect(searchBar).not.toBeVisible();
    await expect(page.locator("h2:has-text('Create Studio')").first()).toBeVisible();

    // 3. Navigate to Rehearse tab
    await page.locator("#nav-rehearse").click();
    await expect(searchBar).not.toBeVisible();
    await expect(page.locator("h2:has-text('Rehearsal & Practice Room')").first()).toBeVisible();

    // 4. Click a classic song "Amazing Grace" to load it
    await page.locator("text=Amazing Grace").first().click();

    // Wait for the song detail page to load (URL should contain /song/)
    await page.waitForURL(/\/song\/\d+/);

    // Verify Player component title and elements
    await expect(page.locator("h1:has-text('Amazing Grace')")).toBeVisible();

    // Toggle advanced tools on
    await page.locator("button:has-text('Show Advanced Producer Tools')").click();

    // Switch to Workstation mode
    await page.locator("button:has-text('Song Part Workstation')").click();

    // Locate the Global Chords Loop input field
    const chordInput = page.locator("input[placeholder='e.g. C, F, G, Am']");
    await expect(chordInput).toBeVisible();

    // 5. Test chord validation: type invalid characters (errors)
    await chordInput.fill("C, F, G, X");
    await expect(page.locator("text=Invalid chord format: X")).toBeVisible();

    // Test consecutive commas (errors)
    await chordInput.fill("C,,F");
    await expect(page.locator("text=Double/consecutive commas are not allowed.")).toBeVisible();

    // Test unknown chords (warnings)
    await chordInput.fill("C, F, G, C#m");
    await expect(page.locator("text=Unknown chord(s): C#m")).toBeVisible();

    // Test valid chords (no error, no warning)
    await chordInput.fill("C, F, G, Am");
    await expect(page.locator("text=Invalid chord format:")).not.toBeVisible();
    await expect(page.locator("text=Unknown chord(s):")).not.toBeVisible();
  });
});
