/**
 * The one place pages get their data from.
 * Cached with "use cache" (Cache Components): pages are prerendered at build time,
 * and the dashboard can refresh them later with revalidateTag("library") (phase 3).
 */
import { cacheLife, cacheTag } from "next/cache";
import { cache as reactCache } from "react";
import { buildLookup } from "./library";
import { TYPES } from "./site-shared";
import { applyOverrides, type Site } from "./overrides";
import { getDataStore } from "./storage";

export async function getSite(): Promise<Site> {
  "use cache";
  cacheTag("library");
  cacheLife("max");
  const store = await getDataStore();
  const [library, overrides] = await Promise.all([store.getLibrary(), store.getOverrides()]);
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

/** Home/drawer sections with their counts: the content types (in site.config.json order), then collections (e.g. Ramadan). */
export async function getCategories() {
  const lk = await getLookup();
  const n = (k: string) => lk.ids.filter((i) => lk.site.lessons[String(i)].k === k && !lk.inCollection.has(i)).length;
  return [
    // `type` = the type key; its title is the «kinds.<key>» message
    ...TYPES.filter((t) => t.menu).map((t) => ({ href: t.path, icon: t.icon, key: "", type: t.key, n: n(t.key) })),
    // videos, once the site has any
    ...(() => {
      const v = lk.ids.filter((i) => lk.site.lessons[String(i)].vid).length;
      return v ? [{ href: "/videos", icon: "video", key: "videos", n: v }] : [];
    })(),
    ...lk.site.collections.filter((c) => c.ids.length).map((c) => ({ href: `/c/${c.key}`, icon: c.icon ?? "bedtime", key: "", label: c.label ?? c.title, n: c.ids.length })),
  ] as { href: string; icon: string; key: string; type?: string; label?: string; n: number }[];
}

/** The title of a home/menu section: a collection's own label, a type's section title, or a menu word. */
const NAV_OF: Record<string, string> = { lesson: "nav.lessons", khutba: "nav.khutab", tilawa: "nav.tilawat" };
export function catLabel(c: { key: string; type?: string; label?: string }, t: (key: string) => string) {
  return c.label ?? (c.type ? t(NAV_OF[c.type] ?? `kinds.${c.type}`) : t(`nav.${c.key}`));
}

/** Week number used to rotate "most listened" picks. Cached, so pages stay static and refresh about daily. */
export async function currentWeek(): Promise<number> {
  "use cache";
  cacheLife("days");
  return Math.floor(Date.now() / 604800000);
}
