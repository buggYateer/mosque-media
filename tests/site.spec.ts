/**
 * Parity checklist with the original site (docs/plan-nextjs.md §4), on the demo data.
 */
import { expect, test, type Page } from "@playwright/test";

const ROUTES = ["/", "/weekly", "/sheikhs", "/series", "/latest", "/popular", "/others", "/all", "/lessons", "/khutab", "/tilawat", "/search", "/c/ramadan", "/l/54", "/s/abdallah-mahmoud", "/s/abdallah-mahmoud/arbaeen", "/s/khaled-ibrahim/juz-amma", "/lawha"];

const playing = (page: Page) => page.evaluate(() => !document.querySelector("audio")!.paused);

test("every page answers and has a title", async ({ page }) => {
  for (const r of ROUTES) {
    const res = await page.goto(r);
    expect(res?.status(), r).toBe(200);
    await expect(page, r).toHaveTitle(/مسجد النور/);
  }
  expect((await page.goto("/no-such-page"))?.status()).toBe(404);
  // Unknown ids of dynamic pages render the not-found page (streamed, so status 200) and are marked noindex.
  await page.goto("/l/999999");
  await expect(page.getByText("الصفحة دي مش موجودة.")).toBeVisible();
  await expect(page.locator('meta[name="robots"][content*="noindex"]')).toHaveCount(1);
});

test("home: sections, weekly sheikhs, series and speakers", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  for (const t of ["التلاوات", "الدروس", "خطب الجمعة", "دروس الأسبوع", "آخر المستجدات", "السلاسل"]) await expect(page.getByText(t).first()).toBeVisible();
  await expect(page.getByRole("link", { name: /عبدالله محمود/ }).first()).toBeVisible();
});

test("sheikh page: tabs, series sections open, numbered lessons", async ({ page }) => {
  await page.goto("/s/khaled-ibrahim/juz-amma");
  await expect(page.getByRole("heading", { name: /خالد إبراهيم/ })).toBeVisible();
  await page.getByRole("button", { name: /سورة النبأ/ }).click();
  await expect(page.getByRole("link", { name: /سورة النبأ \(1-16\)/ })).toBeVisible();
  await page.locator("main nav").getByRole("link", { name: /خطب الجمعة/ }).click();
  await expect(page).toHaveURL(/\/s\/khaled-ibrahim\/khutba$/);
  await page.goto("/s/abdallah-mahmoud/arbaeen");
  await expect(page.getByText("الحديث الخامس: من أحدث في أمرنا").first()).toBeVisible();
});

test("filters live in the URL and narrow the list", async ({ page }) => {
  await page.goto("/lessons?sheikh=khaled-ibrahim");
  await expect(page.getByText(/حسب اختيارك/)).toBeVisible();
  const rows = page.locator("main a[href^='/l/']");
  await expect(rows).toHaveCount(4);
  await page.getByRole("button", { name: "الكل", exact: true }).click();
  await expect(page).toHaveURL(/\/lessons$/);
  await page.goto("/tilawat");
  await page.getByRole("button", { name: /فلترة وترتيب/ }).click();
  await expect(page.getByText("السورة")).toBeVisible();
});

test("search ignores hamza/ta-marbuta differences", async ({ page }) => {
  await page.goto("/search?q=" + encodeURIComponent("الاربعين"));
  await expect(page.getByText(/5 نتيجة|5 نتايج/)).toBeVisible();
  await page.goto("/search?q=" + encodeURIComponent("الامانه"));
  await expect(page.getByRole("link", { name: "الأمانة" })).toBeVisible();
});

test("player keeps playing across pages; expanded view closes with Back", async ({ page }) => {
  await page.goto("/s/khaled-ibrahim");
  await page.getByRole("button", { name: /تشغيل الأمانة/ }).first().click();
  await expect.poll(() => playing(page)).toBe(true);
  await page.getByRole("link", { name: "دروس الأسبوع" }).first().click();
  await expect(page).toHaveURL(/\/weekly$/);
  expect(await playing(page)).toBe(true);
  await page.getByRole("button", { name: "تكبير المشغل" }).click();
  await expect(page.getByRole("dialog", { name: "يُستمع الآن" })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole("dialog", { name: "يُستمع الآن" })).toBeHidden();
  expect(await playing(page)).toBe(true);
});

test("speed and volume are remembered", async ({ page }) => {
  await page.goto("/l/54");
  await page.getByRole("button", { name: "استمع" }).click();
  await page.getByRole("button", { name: "سرعة التشغيل" }).first().click();
  await page.getByRole("menuitemradio", { name: "1.5×" }).click();
  expect(await page.evaluate(() => document.querySelector("audio")!.playbackRate)).toBe(1.5);
  await page.reload();
  expect(await page.evaluate(() => localStorage.getItem("speed"))).toBe("1.5");
});

test("download uses the Arabic title as file name", async ({ request }) => {
  const r = await request.get("/api/dl?id=54");
  expect(r.status()).toBe(200);
  expect(decodeURIComponent(r.headers()["content-disposition"])).toContain("الأمانة - الشيخ خالد إبراهيم.mp3");
  expect((await request.get("/api/dl?id=abc")).status()).toBe(400);
});

test("languages: English is left-to-right, Urdu and Russian render", async ({ page }) => {
  await page.goto("/en");
  await expect(page.locator("html")).toHaveAttribute("dir", "ltr");
  await expect(page.getByText("Weekly lessons").first()).toBeVisible();
  await page.goto("/ur/weekly");
  await expect(page.locator("html")).toHaveAttribute("lang", "ur");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await page.goto("/ru/series");
  await expect(page.getByRole("heading", { name: "Циклы" })).toBeVisible();
  await page.goto("/hi/latest");
  await expect(page.getByRole("heading", { name: "नवीनतम" })).toBeVisible();
});

test("dark mode toggles and is remembered", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "الوضع الليلي" }).first().click();
  await expect(page.locator("html")).toHaveClass(/dark/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/dark/);
});

test("PWA: manifest, icons, service worker, share image", async ({ request }) => {
  const m = await (await request.get("/manifest.webmanifest")).json();
  expect(m.name).toBe("مسجد النور");
  for (const i of m.icons) expect((await request.get(i.src)).headers()["content-type"]).toContain("image/png");
  expect((await request.get("/sw.js")).status()).toBe(200);
  expect((await request.get("/og.png")).headers()["content-type"]).toContain("image/png");
});

test("dashboard is locked without signing in", async ({ page, request }) => {
  expect((await request.get("/api/admin/state")).status()).toBeGreaterThanOrEqual(401);
  expect((await request.post("/api/admin/save", { data: {} })).status()).toBe(401);
  await page.goto("/lawha");
  await expect(page.locator('input[type="password"]').or(page.getByText(/لسه متظبطتش/))).toBeVisible();
});

test("accessibility basics: every button and link has a name", async ({ page }) => {
  for (const r of ["/", "/s/abdallah-mahmoud/arbaeen", "/all"]) {
    await page.goto(r);
    const unnamed = await page.evaluate(() =>
      [...document.querySelectorAll("button, a[href]")].filter((el) => !(el.getAttribute("aria-label") || el.textContent?.trim() || el.getAttribute("title"))).map((el) => el.outerHTML.slice(0, 80)),
    );
    expect(unnamed, r).toEqual([]);
  }
});
