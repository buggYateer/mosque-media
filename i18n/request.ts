import { hasLocale } from "next-intl";
import { getRequestConfig } from "next-intl/server";
import { locale as rootLocale } from "next/root-params";
import { withCustomTexts } from "@/lib/custom-texts";
import { routing } from "./routing";

export default getRequestConfig(async ({ locale }) => {
  const requested = locale ?? (await rootLocale());
  const resolved = hasLocale(routing.locales, requested) ? requested : routing.defaultLocale;
  return {
    locale: resolved,
    messages: withCustomTexts((await import(`../messages/${resolved}.json`)).default, resolved),
  };
});
