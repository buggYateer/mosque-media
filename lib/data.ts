/**
 * The one place pages get their data from.
 * Cached with "use cache" (Cache Components): pages are prerendered at build time,
 * and the dashboard can refresh them later with revalidateTag("library") (phase 3).
 */
import { cacheLife, cacheTag } from "next/cache";
import { cache as reactCache } from "react";
import { buildLookup } from "./library";
import { applyOverrides, type Site } from "./overrides";
import { dataStore } from "./storage";

export async function getSite(): Promise<Site> {
  "use cache";
  cacheTag("library");
  cacheLife("max");
  const [library, overrides] = await Promise.all([dataStore.getLibrary(), dataStore.getOverrides()]);
  return applyOverrides(library, overrides);
}

export function countAll(site: Site) {
  const lessons = Object.values(site.lessons);
  return {
    lessons: lessons.length,
    sheikhs: site.sheikhs.length,
    series: site.sheikhs.reduce((n, sh) => n + (sh.series?.length ?? 0), 0),
    khutab: lessons.filter((l) => l.k === "khutba").length,
  };
}

/** Lookups over the site data, memoized for one render (they contain functions, so they can't be "use cache"d). */
export const getLookup = reactCache(async () => buildLookup(await getSite()));

/** Home/drawer sections with their counts: recitations, lessons, sermons, then collections (e.g. Ramadan). */
export async function getCategories() {
  const lk = await getLookup();
  const n = (k: string) => lk.ids.filter((i) => lk.site.lessons[String(i)].k === k && !lk.inCollection.has(i)).length;
  return [
    { href: "/tilawat", icon: "tilawa", key: "tilawat", n: n("tilawa") },
    { href: "/lessons", icon: "lesson", key: "lessons", n: n("lesson") },
    { href: "/khutab", icon: "khutba", key: "khutab", n: n("khutba") },
    ...lk.site.collections.filter((c) => c.ids.length).map((c) => ({ href: `/c/${c.key}`, icon: c.icon ?? "bedtime", key: "", label: c.label ?? c.title, n: c.ids.length })),
  ] as { href: string; icon: string; key: string; label?: string; n: number }[];
}

/** Week number used to rotate "most listened" picks. Cached, so pages stay static and refresh about daily. */
export async function currentWeek(): Promise<number> {
  "use cache";
  cacheLife("days");
  return Math.floor(Date.now() / 604800000);
}
