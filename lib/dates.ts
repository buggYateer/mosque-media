/**
 * Dates of recordings, shown the way the mosque chose in site.config.json → dates.calendar:
 * hijri, gregorian, both, or none. A recording may have a hijri date (h), a gregorian one (g),
 * or both; the missing one is computed (tabular Islamic calendar, the same as tools/build_data.py).
 */
import { CALENDAR, HIJRI_OFFSET, type Calendar } from "./site-shared";
import { hijriMonth } from "./text";

type Ymd = { y: number; m: number; d: number };

const gToJd = ({ y, m, d }: Ymd) => {
  const a = Math.floor((14 - m) / 12);
  const yy = y + 4800 - a;
  const mm = m + 12 * a - 3;
  return d + Math.floor((153 * mm + 2) / 5) + 365 * yy + Math.floor(yy / 4) - Math.floor(yy / 100) + Math.floor(yy / 400) - 32045;
};
const jdToG = (jd: number): Ymd => {
  const a = jd + 32044;
  const b = Math.floor((4 * a + 3) / 146097);
  const c = a - Math.floor((146097 * b) / 4);
  const d = Math.floor((4 * c + 3) / 1461);
  const e = c - Math.floor((1461 * d) / 4);
  const m = Math.floor((5 * e + 2) / 153);
  return { d: e - Math.floor((153 * m + 2) / 5) + 1, m: m + 3 - 12 * Math.floor(m / 10), y: 100 * b + d - 4800 + Math.floor(m / 10) };
};
const hToJd = ({ y, m, d }: Ymd) => Math.floor((11 * y + 3) / 30) + 354 * y + 30 * m - Math.floor((m - 1) / 2) + d + 1948440 - 385;
const jdToH = (jd: number): Ymd => {
  let L = jd - 1948440 + 10632;
  const n = Math.floor((L - 1) / 10631);
  L = L - 10631 * n + 354;
  const j = Math.floor((10985 - L) / 5316) * Math.floor((50 * L) / 17719) + Math.floor(L / 5670) * Math.floor((43 * L) / 15238);
  L = L - Math.floor((30 - j) / 15) * Math.floor((17719 * j) / 50) - Math.floor(j / 16) * Math.floor((15238 * j) / 43) + 29;
  const m = Math.floor((24 * L) / 709);
  return { d: L - Math.floor((709 * m) / 24), m, y: 30 * n + j - 30 };
};

/** «12-9-1447» → {y: 1447, m: 9, d: 12}; free text → null. */
export function parseHijri(h: string): Ymd | null {
  const r = /^(\d{1,2})-(\d{1,2})-(1[34]\d\d)$/.exec(h || "");
  return r && +r[2] >= 1 && +r[2] <= 12 && +r[1] >= 1 && +r[1] <= 30 ? { d: +r[1], m: +r[2], y: +r[3] } : null;
}
/** «2026-03-02» → {y: 2026, m: 3, d: 2}. */
export function parseGregorian(g: string | undefined): Ymd | null {
  const r = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(g || "");
  return r && +r[2] >= 1 && +r[2] <= 12 ? { y: +r[1], m: +r[2], d: +r[3] } : null;
}
export const hijriToGregorian = (h: Ymd) => jdToG(hToJd(h) - HIJRI_OFFSET);
export const gregorianToHijri = (g: Ymd) => jdToH(gToJd(g) + HIJRI_OFFSET);
export const toHijriText = (x: Ymd) => `${x.d}-${x.m}-${x.y}`;
export const toIso = (x: Ymd) => `${x.y}-${String(x.m).padStart(2, "0")}-${String(x.d).padStart(2, "0")}`;

/** Today's date in both calendars (for new recordings added from the dashboard). */
export function today() {
  const n = new Date();
  const g = { y: n.getFullYear(), m: n.getMonth() + 1, d: n.getDate() };
  return { g: toIso(g), h: toHijriText(gregorianToHijri(g)) };
}

export type DateWords = { months: string[]; hijriSuffix: string; locale: string };

function gregorianText(g: Ymd, locale: string, month: "long" | undefined = "long", withDay = true) {
  // Latin digits everywhere, like the rest of the site
  return new Intl.DateTimeFormat(`${locale}-u-nu-latn`, { ...(withDay ? { day: "numeric" } : {}), month, year: "numeric", timeZone: "UTC" }).format(Date.UTC(g.y, g.m - 1, g.d));
}

/** The date of a recording as text, in the calendar the mosque chose («» when it shows no dates). */
export function dateText(item: { h: string; g?: string }, w: DateWords, calendar: Calendar = CALENDAR): string {
  if (calendar === "none") return "";
  const h = parseHijri(item.h);
  const g = parseGregorian(item.g);
  const hij = h ?? (g ? gregorianToHijri(g) : null);
  const greg = g ?? (h ? hijriToGregorian(h) : null);
  const hText = hij ? `${hij.d} ${w.months[hij.m - 1]} ${hij.y}${w.hijriSuffix}` : "";
  const gText = greg ? gregorianText(greg, w.locale) : "";
  // a free-text date («رمضان 1447») is shown as it was written, month name localized when possible
  const free = () => {
    if (!item.h) return "";
    const m = hijriMonth(item.h);
    return m ? `${w.months[m.month - 1]} ${m.year}${w.hijriSuffix}` : item.h;
  };
  if (calendar === "gregorian") return gText || free();
  if (calendar === "both") return hText && gText ? `${hText} · ${gText}` : hText || gText || free();
  return hText || free();
}

/** The month of a recording for the «month» filter: {key, label} in the chosen calendar. */
export function monthOf(item: { h: string; g?: string }, w: DateWords, calendar: Calendar = CALENDAR): { key: string; label: string } | null {
  if (calendar === "gregorian") {
    const g = parseGregorian(item.g) ?? (parseHijri(item.h) ? hijriToGregorian(parseHijri(item.h)!) : null);
    if (!g) return null;
    return { key: `${g.y}-${String(g.m).padStart(2, "0")}`, label: gregorianText(g, w.locale, "long", false) };
  }
  const h = parseHijri(item.h) ?? (parseGregorian(item.g) ? gregorianToHijri(parseGregorian(item.g)!) : null);
  const m = h ? { year: String(h.y), month: h.m } : hijriMonth(item.h);
  if (!m) return null;
  return { key: `${m.year}-${String(m.month).padStart(2, "0")}`, label: `${w.months[m.month - 1]} ${m.year}` };
}
