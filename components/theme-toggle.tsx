"use client";

import { Moon, Sun } from "lucide-react";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";

export function ThemeToggle() {
  const t = useTranslations("nav");
  const { resolvedTheme, setTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Button
      variant="ghost"
      size="icon-lg"
      className="text-header-foreground hover:bg-header-foreground/10 hover:text-header-foreground"
      aria-label={dark ? t("themeLight") : t("themeDark")}
      onClick={() => setTheme(dark ? "light" : "dark")}
    >
      {/* Both icons are rendered and toggled with CSS, so server and client HTML match. */}
      <Moon className="size-5 dark:hidden" />
      <Sun className="hidden size-5 dark:block" />
    </Button>
  );
}
