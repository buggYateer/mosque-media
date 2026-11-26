/**
 * View helpers over the site data (after overrides): lookups, the compact "item"
 * shape sent to client components, series/collection membership, popular picks.
 * Everything here is pure and runs on the server (at build time).
 */
import { config } from "./config";
import type { Site } from "./overrides";
import { toneOf } from "./theme";
import { DEFAULT_TYPE, TYPE_KEYS } from "./site-shared";
import type { Kind, Lesson, SheikhData, Series } from "./storage/types";

/** The compact shape client components receive for one recording. */
export type Item = {
  id: number;
  t: string; // title
  k: Kind;
  d: string; // duration
  h: string; // hijri date (raw)
  g?: string; // gregorian date "yyyy-mm-dd"
  p: number; // audio parts (0 = no audio: Telegram only, or video only)
  vid?: string; // video source (see lib/media.ts)
  au?: string; // audio kept elsewhere (direct link)
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
      ...(L.g ? { g: L.g } : {}),
      // an outside audio link plays like an uploaded file
      p: L.p || (L.au ? 1 : 0),
      ...(L.vid ? { vid: L.vid } : {}),
      ...(L.au ? { au: L.au } : {}),
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
  return Object.values(sh.byType).reduce((a, x) => a + x.length, 0) + (sh.series ?? []).reduce((a, se) => a + seriesIds(se).length, 0);
}

/** All recordings of a kind that are not part of a collection (e.g. Ramadan), newest first. */
export function kindIds(lk: Lookup, kind: Kind | null) {
  return lk.ids.filter((i) => (kind ? lk.site.lessons[String(i)].k === kind : true) && (kind ? !lk.inCollection.has(i) : true));
}

/** Lessons of a sheikh = loose lessons + every series lesson. */
const of = (sh: SheikhData, k: string) => sh.byType[k] ?? [];
export const sheikhLessons = (sh: SheikhData) => [...of(sh, DEFAULT_TYPE), ...(sh.series ?? []).flatMap(seriesIds)];
export const sheikhAll = (sh: SheikhData) => [...sheikhLessons(sh), ...TYPE_KEYS.filter((k) => k !== DEFAULT_TYPE).flatMap((k) => of(sh, k))];

/** Types used for «most listened» (lessons first, then the others; not sermons or misc). */
const PICK = [DEFAULT_TYPE, ...TYPE_KEYS.filter((k) => k !== DEFAULT_TYPE && k !== "khutba" && k !== "other")];
const rotate = <T>(a: T[], r: number) => [...a.slice(r % a.length), ...a.slice(0, r % a.length)];

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
      for (const k of rotate(PICK, w + n)) {
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
      PICK.forEach((k, j) => {
        const t = pop((L, i) => L.s === sh.key && L.k === k && titled(L) && !lk.inCollection.has(i)).slice(0, 8);
        if (t.length) ids.push(t[(w * 5 + n + j * 3) % t.length]);
      });
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
  const D = DEFAULT_TYPE;
  if (nl && D !== "tilawa" && of(sh, "tilawa").length) tabs.push({ id: "tilawa", label: "", labelKey: "kinds.tilawa", n: of(sh, "tilawa").length, group: "lessons" });
  for (const se of sh.series ?? []) tabs.push({ id: se.key, label: se.title, n: seriesIds(se).length, group: "series" });
  if (of(sh, D).length && sh.series) tabs.push({ id: D, label: "", labelKey: "loose", n: of(sh, D).length, group: "series" });
  // sermons and recitations first, then the site's own types, «misc» last
  const rank = (k: string) => ({ khutba: 0, tilawa: 1, other: 9 })[k] ?? 5;
  for (const k of TYPE_KEYS.filter((k) => k !== D).sort((a, b) => rank(a) - rank(b)))
    if (of(sh, k).length && !tabs.some((t) => t.id === k)) tabs.push({ id: k, label: "", labelKey: `kinds.${k}`, n: of(sh, k).length, group: "other" });
  if (!tabs.length || (!sh.series && of(sh, D).length && !nl)) tabs.unshift({ id: D, label: "", labelKey: `kinds.${D}`, n: of(sh, D).length, group: "lessons" });
  return tabs;
}

export function tabIds(sh: SheikhData, tab: string): { ids: number[]; series?: Series } {
  const se = (sh.series ?? []).find((x) => x.key === tab);
  if (se) return { ids: seriesIds(se), series: se };
  if (tab === "recent") return { ids: newest(sheikhLessons(sh)) };
  if (TYPE_KEYS.includes(tab)) return { ids: newest(of(sh, tab)) };
  return { ids: [] };
}
