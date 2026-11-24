"use client";

import { Languages } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { usePathname, useRouter } from "@/i18n/navigation";
import { routing } from "@/i18n/routing";
import { DropdownMenu, DropdownMenuContent, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

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
  const go = (l: string) => {
    const q = params.toString();
    router.replace(`${pathname}${q ? `?${q}` : ""}`, { locale: l });
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("language")}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 text-sm font-semibold text-header-foreground hover:bg-header-foreground/10"
      >
        <Languages className="size-4.5" />
        <span className="hidden sm:inline">{NAMES[locale]}</span>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuRadioGroup value={locale} onValueChange={(v) => go(String(v))}>
          {routing.locales.map((l) => (
            <DropdownMenuRadioItem key={l} value={l} lang={l} className="justify-between gap-3">
              {NAMES[l]}
              {EXPERIMENTAL.has(l) ? <small className="rounded bg-muted px-1.5 text-[10px] text-muted-foreground">beta</small> : null}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
