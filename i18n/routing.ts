import { defineRouting } from "next-intl/routing";
import { config } from "@/lib/config";

/**
 * Languages come from site.config.json → i18n.
 * The default language has no prefix (/s/…), others are prefixed (/en/s/…).
 * A single-language mosque never sees a prefix at all.
 */
export const routing = defineRouting({
  locales: config.i18n.locales,
  defaultLocale: config.i18n.default,
  localePrefix: "as-needed",
  // Always open in the mosque's own language; visitors switch manually.
  localeDetection: false,
});
