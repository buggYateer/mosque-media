import { defineRouting } from "next-intl/routing";
// Read the raw JSON (not lib/config) so the browser bundle doesn't include the validation library;
// lib/config.ts validates the same file on the server at build time.
import raw from "@/site.config.json";

const LOCALES = ["ar", "en", "ur", "hi", "ru"] as const;
type L = (typeof LOCALES)[number];
const i18n = (raw as { i18n?: { default?: string; locales?: string[] } }).i18n ?? {};
const locales = (i18n.locales ?? ["ar"]).filter((l): l is L => (LOCALES as readonly string[]).includes(l));

/**
 * Languages come from site.config.json → i18n.
 * The default language has no prefix (/s/…), others are prefixed (/en/s/…).
 * A single-language mosque never sees a prefix at all.
 */
export const routing = defineRouting({
  locales: locales.length ? locales : ["ar"],
  defaultLocale: (locales.includes(i18n.default as L) ? i18n.default : locales[0] ?? "ar") as L,
  localePrefix: "as-needed",
  // Always open in the mosque's own language; visitors switch manually.
  localeDetection: false,
});
