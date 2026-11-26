/**
 * The customizable parts of site.config.json that browser-side components also need
 * (content types, dates, Telegram, home sections), read with their defaults.
 * Kept free of zod so it stays tiny in the browser; lib/config.ts validates the same fields at build time.
 */
import raw from "@/site.config.json";

/** A text that is the same in every language ("درس") or given per language ({"ar": "درس", "en": "Lesson"}). */
export type Text = string | Partial<Record<string, string>>;

export type SiteType = {
  key: string;
  /** One item, e.g. «درس» (falls back to the built-in translation for lesson/khutba/tilawa/other). */
  name?: Text;
  /** The section title, e.g. «الدروس». */
  plural?: Text;
  icon: string;
  /** Words that mark a Telegram caption as this type (used by tools/build_data.py). */
  words: string[];
  /** Its page on the site. */
  path: string;
  /** Shown as a section on the home page and in the menu. */
  menu: boolean;
  /** Offers a «surah» filter (recitations). */
  surahs: boolean;
};

type RawType = Partial<Omit<SiteType, "path">> & { key: string };
type Raw = {
  types?: RawType[];
  kinds?: Record<string, string[]>;
  dates?: { calendar?: string; hijriOffset?: number };
  telegramChannel?: string;
  home?: string[];
  media?: { video?: string[]; maxUploadMB?: number };
  sheikhs?: { key: string; name: string; slug?: string; main?: boolean }[];
};
const cfg = raw as unknown as Raw;

/** The built-in types and their pages (existing links keep working). */
const BUILTIN: Record<string, Omit<SiteType, "key" | "words">> = {
  tilawa: { icon: "tilawa", path: "/tilawat", menu: true, surahs: true },
  lesson: { icon: "lesson", path: "/lessons", menu: true, surahs: false },
  khutba: { icon: "khutba", path: "/khutab", menu: true, surahs: false },
  other: { icon: "other", path: "/t/other", menu: false, surahs: false },
};
const DEFAULT_ORDER = ["tilawa", "lesson", "khutba", "other"];

export const TYPES: SiteType[] = (cfg.types?.length ? cfg.types : DEFAULT_ORDER.map((key): RawType => ({ key }))).map((t) => {
  const b = BUILTIN[t.key];
  return {
    key: t.key,
    ...(t.name ? { name: t.name } : {}),
    ...(t.plural ? { plural: t.plural } : {}),
    icon: t.icon ?? b?.icon ?? "lesson",
    words: [...(t.words ?? []), ...(cfg.kinds?.[t.key] ?? [])],
    path: b?.path ?? `/t/${t.key}`,
    menu: t.menu ?? b?.menu ?? true,
    surahs: t.surahs ?? b?.surahs ?? false,
  };
});
export const TYPE_KEYS = TYPES.map((t) => t.key);
/** The type of anything that matches no words, and of every lesson inside a series. */
export const DEFAULT_TYPE = (cfg.types?.find((t) => (t as { default?: boolean }).default)?.key ?? (TYPE_KEYS.includes("lesson") ? "lesson" : TYPE_KEYS[0])) as string;
export const typeOf = (key: string) => TYPES.find((t) => t.key === key) ?? TYPES.find((t) => t.key === DEFAULT_TYPE)!;
export const isBuiltinType = (key: string) => key in BUILTIN;

/** Picks the text for a language: that language, then Arabic, then English, then any. */
export function textIn(t: Text | undefined, locale: string): string | undefined {
  if (t === undefined) return undefined;
  if (typeof t === "string") return t;
  return t[locale] ?? t.ar ?? t.en ?? Object.values(t)[0];
}

export type Calendar = "hijri" | "gregorian" | "both" | "none";
export const CALENDAR: Calendar = (["hijri", "gregorian", "both", "none"].includes(cfg.dates?.calendar ?? "") ? cfg.dates!.calendar : "hijri") as Calendar;
/** Days to add to the computed hijri date (moon sighting differs by country), -2…2. */
export const HIJRI_OFFSET = Math.max(-2, Math.min(2, Math.round(cfg.dates?.hijriOffset ?? 0)));

/** Ids from here up are added on the site (not Telegram messages), so they never clash with the channel's numbers. */
export const SITE_ID_START = 1_000_000;

export const TELEGRAM = (cfg.telegramChannel ?? "").replace(/^@|^https:\/\/t\.me\//g, "").replace(/\/$/, "").trim();

export const HOME_SECTIONS = ["categories", "feature", "latestTilawat", "featured", "videos", "weekly", "latest", "popular", "series", "others"] as const;
export type HomeSection = (typeof HOME_SECTIONS)[number];
/** Video sources the dashboard accepts, and the largest video file it uploads (MB). */
export const VIDEO_SOURCES_ON: string[] = cfg.media?.video ?? ["youtube", "facebook", "drive", "link", "file"];
export const MAX_VIDEO_MB = cfg.media?.maxUploadMB ?? 500;

/** The sheikhs in site.config.json (one added from the dashboard may have no clips in the library yet). */
export const CONFIG_SHEIKHS = (cfg.sheikhs ?? []).map((s) => ({ key: s.key, name: s.name, slug: s.slug, main: !!s.main }));

// Arabic name → English link, same as slugify() in tools/build_data.py
const CH: Record<string, string> = { ا: "a", ب: "b", ت: "t", ث: "th", ج: "g", ح: "h", خ: "kh", د: "d", ذ: "z", ر: "r", ز: "z", س: "s", ش: "sh", ص: "s", ض: "d", ط: "t", ظ: "z", ع: "a", غ: "gh", ف: "f", ق: "k", ك: "k", ل: "l", م: "m", ن: "n", ه: "h", و: "w", ي: "y", أ: "a", إ: "e", آ: "a", ة: "a", ى: "a", ئ: "e", ؤ: "o", ء: "" };
const WORDS: Record<string, string> = { محمد: "mohamed", أحمد: "ahmed", محمود: "mahmoud", عبدالله: "abdallah", إبراهيم: "ibrahim", يوسف: "youssef", خالد: "khaled", حسن: "hassan", حسين: "hussein", علي: "ali", عمر: "omar", مصطفى: "mostafa", غير: "unknown", محدد: "" };
export function sheikhSlug(key: string) {
  const parts = key.split("_").map((w) => WORDS[w] ?? [...w].map((c) => CH[c] ?? (/^[a-z0-9]$/i.test(c) ? c : "")).join(""));
  return parts.filter(Boolean).join("-").toLowerCase() || "sheikh";
}

/** Which home sections show, in this order. */
export const HOME: HomeSection[] = (cfg.home?.length ? cfg.home : [...HOME_SECTIONS]).filter((s): s is HomeSection => (HOME_SECTIONS as readonly string[]).includes(s));
