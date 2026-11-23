"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { Button } from "@/components/ui/button";

/** Native name of each language, shown in its own script. */
const NAMES: Record<string, string> = { ar: "العربية", en: "English", ur: "اردو", hi: "हिन्दी", ru: "Русский" };

export function LocaleSwitcher() {
  const t = useTranslations("nav");
  const locale = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  if (routing.locales.length < 2) return null;
  // Two languages → one tap switches; more than two → cycle (a menu comes in phase 1).
  const next = routing.locales[(routing.locales.indexOf(locale as never) + 1) % routing.locales.length];
  return (
    <Button
      variant="ghost"
      size="lg"
      className="gap-1.5 px-2 text-header-foreground hover:bg-header-foreground/10 hover:text-header-foreground"
      aria-label={`${t("language")}: ${NAMES[next]}`}
      onClick={() => router.replace(pathname, { locale: next })}
    >
      <Languages className="size-4.5" />
      <span lang={next} className="hidden sm:inline">{NAMES[next]}</span>
    </Button>
  );
}
