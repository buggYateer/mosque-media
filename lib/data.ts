/**
 * The one place pages get their data from.
 * Cached with "use cache" (Cache Components): pages are prerendered at build time,
 * and the dashboard can refresh them later with revalidateTag("library") (phase 3).
 */
import { cacheLife, cacheTag } from "next/cache";
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
