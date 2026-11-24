/**
 * View helpers over the site data (after overrides): lookups, the compact "item"
 * shape sent to client components, series/collection membership, popular picks.
 * Everything here is pure and runs on the server (at build time).
 */
import { config } from "./config";
import type { Site } from "./overrides";
import { toneOf } from "./theme";
import type { Kind, Lesson, SheikhData, Series } from "./storage/types";

/** The compact shape client components receive for one recording. */
export type Item = {
  id: number;
  t: string; // title
  k: Kind;
  d: string; // duration
  h: string; // hijri date (raw)
  p: number; // audio parts (0 = Telegram only)
  n?: number; // number inside series
  v?: number; // views
  sh?: { slug: string; name: string; key: string; tone: number };
  se?: { key: string; title: string; sec: string };
};

export type Lookup = ReturnType<typeof buildLookup>;

export function buildLookup(site: Site) {
  const byKey = new Map(site.sheikhs.map((s) => [s.key, s]));
  const bySlug = new Map(site.sheikhs.map((s) => [s.slug, s]));
  const seriesOf = new Map<number, { se: Series; sh: SheikhData; sec: string }>();
  for (const sh of site.sheikhs)
    for (const se of sh.series ?? []) for (const sec of se.sections) for (const id of sec.ids) seriesOf.set(id, { se, sh, sec: sec.t });
  const inCollection = new Set(site.collections.flatMap((c) => c.ids));
  const ids = Object.keys(site.lessons)
    .map(Number)
    .sort((a, b) => b - a); // newest first

  const item = (id: number): Item => {
    const L = site.lessons[String(id)] as Lesson;
    const sh = byKey.get(L.s);
    const s = seriesOf.get(id);
    return {
      id,
      t: L.t,
      k: L.k,
      d: L.d,
      h: L.h,
      p: L.p,
      ...(L.n ? { n: L.n } : {}),
      ...(L.v ? { v: L.v } : {}),
      ...(sh && sh.key !== "غير_محدد" ? { sh: { slug: sh.slug, name: sh.name, key: sh.key, tone: toneOf(config, sh.key) } } : {}),
      ...(s ? { se: { key: s.se.key, title: s.se.title, sec: s.sec } } : {}),
    };
  };
  return { site, byKey, bySlug, seriesOf, inCollection, ids, item, items: (list: number[]) => list.filter((i) => site.lessons[String(i)]).map(item) };
}

export const seriesIds = (se: Series) => se.sections.flatMap((x) => x.ids);
export const newest = (ids: number[]) => [...ids].sort((a, b) => b - a);

export function clipCount(sh: SheikhData) {
  return sh.lesson.length + sh.khutba.length + sh.tilawa.length + sh.other.length + (sh.series ?? []).reduce((a, se) => a + seriesIds(se).length, 0);
}

/** All recordings of a kind that are not part of a collection (e.g. Ramadan), newest first. */
export function kindIds(lk: Lookup, kind: Kind | null) {
  return lk.ids.filter((i) => (kind ? lk.site.lessons[String(i)].k === kind : true) && (kind ? !lk.inCollection.has(i) : true));
}

/** Lessons of a sheikh = loose lessons + every series lesson. */
export const sheikhLessons = (sh: SheikhData) => [...sh.lesson, ...(sh.series ?? []).flatMap(seriesIds)];
export const sheikhAll = (sh: SheikhData) => [...sheikhLessons(sh), ...sh.khutba, ...sh.tilawa, ...sh.other];

const titled = (L: Lesson) => !/\d+-\d+-14\d\d|\.mp3/.test(L.t);

/** Most-listened per main sheikh (each compared to himself), rotating weekly, mixing lessons and recitations. */
export function popularPicks(lk: Lookup, w: number) {
  const top = (sh: SheikhData, k: Kind) =>
    lk.ids
      .filter((i) => {
        const L = lk.site.lessons[String(i)];
        return L.v && L.s === sh.key && L.k === k && titled(L) && !lk.inCollection.has(i);
      })
      .sort((a, b) => (lk.site.lessons[String(b)].v ?? 0) - (lk.site.lessons[String(a)].v ?? 0))
      .slice(0, 8);
  return lk.site.sheikhs
    .filter((s) => s.main)
    .map((sh, n) => {
      for (const k of (w + n) % 2 ? (["tilawa", "lesson"] as const) : (["lesson", "tilawa"] as const)) {
        const t = top(sh, k);
        if (t.length) return t[(w * 3 + n) % t.length];
      }
      return null;
    })
    .filter((x): x is number => x !== null);
}

export function popularPage(lk: Lookup, w: number) {
  const ids: number[] = [];
  const pop = (pred: (L: Lesson, i: number) => boolean) =>
    lk.ids.filter((i) => lk.site.lessons[String(i)].v && pred(lk.site.lessons[String(i)], i)).sort((a, b) => (lk.site.lessons[String(b)].v ?? 0) - (lk.site.lessons[String(a)].v ?? 0));
  lk.site.sheikhs
    .filter((s) => s.main)
    .forEach((sh, n) => {
      for (const k of ["lesson", "tilawa"] as const) {
        const t = pop((L, i) => L.s === sh.key && L.k === k && titled(L) && !lk.inCollection.has(i)).slice(0, 8);
        if (t.length) ids.push(t[(w * 5 + n + (k === "tilawa" ? 3 : 0)) % t.length]);
      }
    });
  const kh = pop((L) => L.k === "khutba").slice(0, 10);
  if (kh.length) for (const x of [kh[w % kh.length], kh[(w + 5) % kh.length]]) if (!ids.includes(x)) ids.push(x);
  return ids;
}

/** Tabs on a sheikh page, grouped like the original site. */
export type SheikhTab = { id: string; label: string; labelKey?: string; n: number; group: "lessons" | "series" | "other" };
export function sheikhTabs(sh: SheikhData): SheikhTab[] {
  const tabs: SheikhTab[] = [];
  const nl = sheikhLessons(sh).length;
  if (nl) tabs.push({ id: "recent", label: "", labelKey: "recent", n: nl, group: "lessons" });
  if (nl && sh.tilawa.length) tabs.push({ id: "tilawa", label: "", labelKey: "kinds.tilawa", n: sh.tilawa.length, group: "lessons" });
  for (const se of sh.series ?? []) tabs.push({ id: se.key, label: se.title, n: seriesIds(se).length, group: "series" });
  if (sh.lesson.length && sh.series) tabs.push({ id: "lesson", label: "", labelKey: "loose", n: sh.lesson.length, group: "series" });
  for (const k of ["khutba", "tilawa", "other"] as const)
    if (sh[k].length && !tabs.some((t) => t.id === k)) tabs.push({ id: k, label: "", labelKey: `kinds.${k}`, n: sh[k].length, group: "other" });
  if (!tabs.length || (!sh.series && sh.lesson.length && !nl)) tabs.unshift({ id: "lesson", label: "", labelKey: "kinds.lesson", n: sh.lesson.length, group: "lessons" });
  return tabs;
}

export function tabIds(sh: SheikhData, tab: string): { ids: number[]; series?: Series } {
  const se = (sh.series ?? []).find((x) => x.key === tab);
  if (se) return { ids: seriesIds(se), series: se };
  if (tab === "recent") return { ids: newest(sheikhLessons(sh)) };
  if (tab === "lesson" || tab === "khutba" || tab === "tilawa" || tab === "other") return { ids: newest(sh[tab]) };
  return { ids: [] };
}
