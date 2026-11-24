"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";

export function ThemeToggle() {
  const t = useTranslations("nav");
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <button
      type="button"
      className="grid size-10 shrink-0 place-items-center rounded-lg text-header-foreground hover:bg-header-foreground/10"
      aria-label={dark ? t("themeLight") : t("themeDark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {/* Both icons are rendered and toggled with CSS, so server and client HTML match. */}
      <Moon className="size-5 dark:hidden" />
      <Sun className="hidden size-5 dark:block" />
    </button>
  );
}
