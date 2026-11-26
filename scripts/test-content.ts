/**
 * Tests for what each mosque can customize and for video: pnpm test:content
 *   video links · dates (hijri ↔ gregorian) · dashboard edits (video, series) · settings checks · custom wording
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import raw from "@/site.config.json";
import { configProblems } from "@/lib/config";
import { withCustomTexts, type Tree } from "@/lib/custom-texts";
import { dateText, gregorianToHijri, hijriToGregorian, monthOf, toHijriText, toIso } from "@/lib/dates";
import { buildLookup } from "@/lib/library";
import { parseVideo } from "@/lib/media";
import { applyOverrides } from "@/lib/overrides";
import { sheikhTabs } from "@/lib/library";
import { librarySchema, overridesSchema } from "@/lib/storage/types";

const ok = (name: string) => console.log(`✓ ${name}`);

// ---------- video links ----------
{
  const yt = parseVideo("https://youtu.be/dQw4w9WgXcQ?t=1m30s");
  assert.deepEqual(yt && yt.source === "youtube" && [yt.id, yt.start], ["dQw4w9WgXcQ", 90]);
  assert.equal(parseVideo("https://www.youtube.com/shorts/dQw4w9WgXcQ")?.source, "youtube");
  assert.equal(parseVideo("https://www.facebook.com/x/videos/123/")?.source, "facebook");
  const d = parseVideo("https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing");
  assert.equal(d?.source === "drive" && d.id, "1AbCdEfGhIjKlMnOp");
  assert.equal(parseVideo("https://example.com/a.mp4")?.source, "link");
  assert.equal(parseVideo("file", "https://x/1.mp4")?.url, "https://x/1.mp4");
  for (const bad of ["nonsense", "javascript:alert(1)", "https://youtube.com/watch?v=short", ""]) assert.equal(parseVideo(bad), null, bad);
  ok("video links");
}

// ---------- dates ----------
{
  // same tabular calendar as tools/build_data.py
  assert.equal(toHijriText(gregorianToHijri({ y: 2026, m: 3, d: 2 })), "13-9-1447");
  for (let t = Date.UTC(2010, 0, 1); t < Date.UTC(2040, 0, 1); t += 86400000 * 11) {
    const x = new Date(t);
    const g = { y: x.getUTCFullYear(), m: x.getUTCMonth() + 1, d: x.getUTCDate() };
    assert.equal(toIso(hijriToGregorian(gregorianToHijri(g))), toIso(g));
  }
  const w = { months: ["محرم", "صفر", "ربيع الأول", "ربيع الآخر", "جمادى الأولى", "جمادى الآخرة", "رجب", "شعبان", "رمضان", "شوال", "ذو القعدة", "ذو الحجة"], hijriSuffix: "هـ", locale: "ar" };
  const it = { h: "12-9-1447", g: "2026-03-02" };
  assert.equal(dateText(it, w, "hijri"), "12 رمضان 1447هـ");
  assert.match(dateText(it, w, "gregorian"), /2 مارس 2026/);
  assert.match(dateText(it, w, "both"), /رمضان 1447هـ · .*2026/);
  assert.equal(dateText(it, w, "none"), "");
  assert.equal(dateText({ h: "رمضان 1447" }, w, "hijri"), "رمضان 1447هـ"); // free text stays
  assert.equal(monthOf(it, w, "gregorian")?.key, "2026-03");
  assert.equal(monthOf(it, w, "hijri")?.key, "1447-09");
  ok("dates");
}

// ---------- dashboard edits: video, outside audio, new series, rename and order ----------
{
  const library = librarySchema.parse(JSON.parse(readFileSync(join(process.cwd(), "content", "lessons.json"), "utf8")));
  const sh = library.sheikhs.find((s) => s.series?.length)!;
  const se = sh.series![0];
  const ids = se.sections.flatMap((x) => x.ids);
  const loose = Object.keys(library.lessons).find((k) => !library.sheikhs.some((s) => (s.series ?? []).some((x) => x.sections.some((y) => y.ids.includes(+k)))))!;
  const o = overridesSchema.parse({
    edit: { [ids[0]]: { vid: "https://youtu.be/dQw4w9WgXcQ" }, [loose]: { series: "s-new", sec: "" } },
    add: { "1000000": { t: "Video only", s: sh.key, k: "lesson", d: "", h: "", p: 0, vid: "https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view" }, "1000001": { t: "Outside audio", s: sh.key, k: "no-such-type", d: "", h: "", p: 0, au: "https://x/a.mp3" } },
    series: [{ key: "s-new", title: "New one", sheikh: sh.key }, { key: "s-empty", title: "Nothing in it", sheikh: sh.key }],
    seriesEdit: { [se.key]: { title: "Renamed", order: [...ids].reverse() } },
  });
  const site = applyOverrides(library, o);
  const lk = buildLookup(site);
  assert.equal(lk.item(ids[0]).vid, "https://youtu.be/dQw4w9WgXcQ", "video added to a clip");
  assert.equal(lk.item(1000000).p, 0, "video-only clip has no audio");
  assert.equal(lk.item(1000001).p, 1, "an outside audio link plays");
  assert.equal(site.lessons["1000001"].k, "lesson", "an unknown type falls back to the default type");
  const s2 = site.sheikhs.find((s) => s.key === sh.key)!;
  const renamed = s2.series!.find((x) => x.key === se.key)!;
  assert.equal(renamed.title, "Renamed");
  if (se.sections.length === 1) assert.deepEqual(renamed.sections[0].ids, [...ids].reverse(), "lessons in the chosen order");
  assert.deepEqual(s2.series!.find((x) => x.key === "s-new")?.sections[0].ids, [Number(loose)], "a lesson joins a new series");
  assert.equal(s2.series!.some((x) => x.key === "s-empty"), false, "an empty series doesn't show");
  assert.ok(sheikhTabs(s2).some((t) => t.id === "s-new"), "the new series is a tab on the sheikh page");
  // clearing the video
  const cleared = applyOverrides(library, overridesSchema.parse({ edit: { [ids[0]]: { vid: "" } } }));
  assert.equal(cleared.lessons[String(ids[0])].vid, undefined, "an empty video value removes it");
  ok("dashboard edits");
}

// ---------- settings checks ----------
{
  assert.deepEqual(configProblems(raw), [], "the demo settings are valid");
  const bad = (patch: object) => configProblems({ ...raw, ...patch });
  assert.ok(bad({ dates: { calendar: "moon" } }).some((p) => p.startsWith("dates.calendar")));
  assert.ok(bad({ types: [{ key: "Kids Lessons" }] }).length, "a type key must be simple English");
  assert.ok(bad({ types: [{ key: "kids" }] }).length, "a new type needs its names");
  assert.deepEqual(bad({ types: [{ key: "kids", name: "درس أطفال", plural: "دروس الأطفال" }, { key: "lesson" }] }), []);
  assert.ok(bad({ home: ["nowhere"] }).length);
  assert.ok(bad({ media: { video: ["tiktok"] } }).length);
  assert.ok(bad({ colors: { ...raw.colors, primary: "#1e2a4a" } }).length, "another mosque's identity is refused");
  assert.deepEqual(bad({ telegramChannel: undefined }), [], "Telegram is optional");
  ok("settings checks");
}

// ---------- custom wording ----------
{
  const ar = JSON.parse(readFileSync(join(process.cwd(), "messages", "ar.json"), "utf8")) as Tree;
  const types = [
    { key: "lesson", name: "محاضرة", plural: "المحاضرات", icon: "lesson", words: [], path: "/lessons", menu: true, surahs: false },
    { key: "kids", name: { ar: "درس أطفال", en: "Kids lesson" }, plural: { ar: "دروس الأطفال" }, icon: "child", words: [], path: "/t/kids", menu: true, surahs: false },
  ];
  const m = withCustomTexts(ar, "ar", types, { ar: { "common.sheikh": "الأستاذ" } });
  const get = (path: string) => path.split(".").reduce<unknown>((x, k) => (x as Tree)?.[k], m);
  assert.equal(get("kind.lesson"), "محاضرة");
  assert.equal(get("kinds.lesson"), "المحاضرات");
  assert.equal(get("nav.lessons"), "المحاضرات", "the menu follows a renamed type");
  assert.equal(get("pages.lessons.title"), "المحاضرات");
  assert.equal(get("kinds.kids"), "دروس الأطفال");
  assert.equal(get("common.sheikh"), "الأستاذ");
  assert.equal((ar as { common: { sheikh: string } }).common.sheikh, "الشيخ", "the original messages are untouched");
  const en = withCustomTexts(JSON.parse(readFileSync(join(process.cwd(), "messages", "en.json"), "utf8")) as Tree, "en", types, {});
  assert.equal((en as { kind: Record<string, string> }).kind.kids, "Kids lesson");
  assert.equal((en as { kinds: Record<string, string> }).kinds.kids, "دروس الأطفال", "a missing language falls back to Arabic");
  ok("custom wording");
}

console.log("All content tests passed.");
