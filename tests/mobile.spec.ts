/** Phone-size checks, including the performance budget (docs/plan-nextjs.md §6). */
import { expect, test } from "@playwright/test";

test("no sideways scrolling on any main page", async ({ page }) => {
  for (const r of ["/", "/s/khaled-ibrahim/juz-amma", "/all", "/l/54", "/ur", "/ru/latest"]) {
    await page.goto(r);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    expect(overflow, r).toBeLessThanOrEqual(1);
  }
});

test("menu opens and navigates", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "القائمة" }).click();
  await page.getByRole("link", { name: /جميع التسجيلات/ }).click();
  await expect(page).toHaveURL(/\/all$/);
});

/**
 * First-load JavaScript of the home page (scripts referenced by the HTML, compressed).
 * React + Next.js alone are ~116 KB; the budget leaves ~80 KB for the site itself.
 * Code loaded later on demand (player, side menu, prefetched pages) is not counted.
 */
test("performance budget: home page first-load JavaScript ≤ 200 KB compressed", async ({ page }) => {
  await page.goto("/", { waitUntil: "load" });
  const kb = await page.evaluate(() => {
    const initial = new Set([...document.querySelectorAll<HTMLScriptElement>("script[src]:not([nomodule])")].map((s) => s.src));
    return (performance.getEntriesByType("resource") as PerformanceResourceTiming[]).filter((e) => initial.has(e.name)).reduce((a, e) => a + e.encodedBodySize, 0) / 1024;
  });
  console.log(`home first-load JS: ${kb.toFixed(1)} KB (compressed)`);
  expect(kb).toBeLessThanOrEqual(200);
});
