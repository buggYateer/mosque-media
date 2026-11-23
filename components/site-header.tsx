import { Menu, Search, Send } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { config } from "@/lib/config";
import { Button } from "@/components/ui/button";
import { LocaleSwitcher } from "./locale-switcher";
import { Logo } from "./logo";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  ["home", "/"],
  ["weekly", "/weekly"],
  ["series", "/series"],
  ["khutab", "/khutab"],
  ["all", "/all"],
] as const;

export async function SiteHeader() {
  const t = await getTranslations("nav");
  const onHeader = "text-header-foreground hover:bg-header-foreground/10 hover:text-header-foreground";
  return (
    <header className="sticky top-0 z-20 border-b bg-header text-header-foreground">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-0.5 px-2 sm:gap-1 sm:px-4">
        <Button variant="ghost" size="icon-lg" className={onHeader} aria-label={t("menu")}>
          <Menu className="size-5" />
        </Button>
        <Link href="/" className="me-auto flex min-w-0 items-center gap-2 text-lg font-extrabold sm:gap-2.5 sm:text-xl">
          <Logo className="shrink-0" />
          <span className="truncate">{config.name}</span>
        </Link>
        <nav aria-label={t("menu")} className="me-2 hidden items-center gap-0.5 xl:flex">
          {NAV.map(([key, href]) => (
            <Link key={key} href={href} className="rounded-md px-3 py-1.5 text-[15px] font-semibold whitespace-nowrap opacity-80 hover:bg-header-foreground/10 hover:opacity-100">
              {t(key)}
            </Link>
          ))}
        </nav>
        <LocaleSwitcher />
        <ThemeToggle />
        <Button variant="ghost" size="icon-lg" className={onHeader} aria-label={t("search")}>
          <Search className="size-5" />
        </Button>
        <a
          href={`https://t.me/${config.telegramChannel}`}
          target="_blank"
          rel="noopener"
          className="inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold whitespace-nowrap text-primary-foreground"
        >
          <Send className="size-4 rtl:-scale-x-100" />
          <span className="hidden sm:inline">{t("telegram")}</span>
        </a>
      </div>
    </header>
  );
}
