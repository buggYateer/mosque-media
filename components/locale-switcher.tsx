"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { MiniMenu } from "./mini-menu";

/** Native name of each language, shown in its own script. */
const NAMES: Record<string, string> = { ar: "العربية", en: "English", ur: "اردو", hi: "हिन्दी", ru: "Русский" };
/** Machine-translated until a native speaker reviews them (see docs). */
export const EXPERIMENTAL = new Set(["ur", "hi", "ru"]);

export function LocaleSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const params = useSearchParams();
  const router = useRouter();
  if (routing.locales.length < 2) return null;
  const q = params.toString();
  return (
    <MiniMenu
      label={t("language")}
      align="end"
      triggerClass="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-header-foreground hover:bg-header-foreground/10"
      trigger={
        <>
          <Languages className="size-4.5" />
          <span className="hidden sm:inline">{NAMES[locale]}</span>
        </>
      }
      items={routing.locales.map((l) => ({
        key: l,
        lang: l,
        checked: l === locale,
        label: (
          <span className="flex flex-1 items-center justify-between gap-3">
            {NAMES[l]}
            {EXPERIMENTAL.has(l) ? <small className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">beta</small> : null}
          </span>
        ),
        onSelect: () => router.replace(`${pathname}${q ? `?${q}` : ""}`, { locale: l }),
      }))}
    />
  );
}
