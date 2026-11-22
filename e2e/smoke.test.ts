import { test, expect } from "@playwright/test";

// Requires both servers running (demo mode recommended for speed):
//   DEMO_MODE=true npm run dev -w server   → port 8787
//   npm run dev -w client                  → port 5173
//
// Run with: npx playwright test

const BASE = "http://localhost:5173";

test.describe("start screen", () => {
  test("loads and shows New Game + How to Play buttons", async ({ page }) => {
    await page.goto(BASE);
    await expect(page.locator("#start-screen")).toBeVisible();
    await expect(page.locator("#new-game-btn")).toBeVisible();
    await expect(page.locator("#how-to-btn")).toBeVisible();
    await expect(page.locator("h1")).toContainText("Paws");
  });

  test("How to Play overlay opens and closes", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#how-to-btn");
    await expect(page.locator("#instructions-screen")).toBeVisible();
    await page.click("#instructions-close-btn");
    await expect(page.locator("#instructions-screen")).not.toBeVisible();
  });
});

test.describe("game loop (requires running server)", () => {
  test("New Game → morning task cards appear", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#new-game-btn");
    await expect(page.locator("#hud")).toBeVisible();
    await expect(page.locator("#morning-screen")).toBeVisible({ timeout: 6000 });
    await expect(page.locator(".task-card")).toHaveCount(3);
  });

  test("selecting a task enters work phase", async ({ page }) => {
    await page.goto(BASE);
    await page.click("#new-game-btn");
    await page.locator(".task-card").first().click({ timeout: 6000 });
    await expect(page.locator("#work-hud")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#morning-screen")).not.toBeVisible();
  });

  test("work phase ends → evening screen appears (demo: 22s)", async ({ page }) => {
    // This test relies on DEMO_MODE=true (22s work phase).
    // With full TIMING it would take 90s — skip if demo not active.
    test.setTimeout(40_000);
    await page.goto(BASE);
    await page.click("#new-game-btn");

    // Wait for morning and pick a task
    await page.locator(".task-card").first().click({ timeout: 8000 });
    await expect(page.locator("#work-hud")).toBeVisible({ timeout: 5000 });

    // Work completes after demo timing (22s) + server round-trip
    await expect(page.locator("#evening-screen")).toBeVisible({ timeout: 30_000 });
    await expect(page.locator(".activity-btn")).toHaveCount(4);
  });

  test("evening → sleep summary appears", async ({ page }) => {
    test.setTimeout(50_000);
    await page.goto(BASE);
    await page.click("#new-game-btn");
    await page.locator(".task-card").first().click({ timeout: 8000 });
    await expect(page.locator("#work-hud")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#evening-screen")).toBeVisible({ timeout: 30_000 });

    // Click all activity buttons to advance quickly
    const btns = page.locator(".activity-btn");
    for (let i = 0; i < 3; i++) {
      const btn = btns.nth(i);
      if (await btn.isEnabled()) await btn.click();
    }

    await expect(page.locator("#sleep-screen")).toBeVisible({ timeout: 5000 });
    await expect(page.locator("#sleep-title")).toContainText("Day 1");
  });
});
