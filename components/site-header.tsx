import { Languages, Send } from "lucide-react";
import { Suspense } from "react";
import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { config } from "@/lib/config";
import { catLabel, getCategories, getLookup } from "@/lib/data";
import { TYPE_KEYS } from "@/lib/site-shared";
import { DrawerMenu, SearchBar, type NavGroup } from "./header-client";
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
  const [t, tAll, cats, lk] = await Promise.all([getTranslations("nav"), getTranslations(), getCategories(), getLookup()]);
  const hasWeekly = lk.site.sheikhs.some((s) => s.main);
  // links in the top bar: sermons only if the site has that type, weekly only if there are weekly sheikhs
  const nav = NAV.filter(([key]) => (key !== "khutab" || TYPE_KEYS.includes("khutba")) && (key !== "weekly" || hasWeekly));
  const groups: NavGroup[] = [
    { title: t("sections"), items: cats.map((c) => ({ href: c.href, label: catLabel(c, (k) => tAll(k as "nav.lessons")), icon: c.icon, n: c.n })) },
    {
      title: t("browse"),
      items: [
        { href: "/", label: t("home"), icon: "home" },
        { href: "/all", label: t("all"), icon: "library", n: lk.ids.length },
        { href: "/latest", label: t("latest"), icon: "latest" },
        { href: "/popular", label: t("popular"), icon: "popular" },
        ...(hasWeekly ? [{ href: "/weekly", label: t("weekly"), icon: "weekly", n: lk.site.sheikhs.filter((s) => s.main).length }] : []),
        { href: "/series", label: t("series"), icon: "lesson", n: lk.site.sheikhs.reduce((a, s) => a + (s.series?.length ?? 0), 0) },
      ],
    },
    { title: t("more"), items: [{ href: "/others", label: t("others"), icon: "others", n: lk.site.sheikhs.filter((s) => !s.main).length }] },
  ];
  return (
    <header className="mm-header sticky top-0 z-20 border-b bg-header text-header-foreground">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-0.5 px-2 sm:gap-1 sm:px-4">
        <DrawerMenu groups={groups} />
        <Link href="/" className="mm-brand me-auto flex min-w-0 items-center gap-2 text-lg font-extrabold sm:gap-2.5 sm:text-xl">
          <Logo className="shrink-0" />
          <span className="mm-brand-name truncate">{config.name}</span>
        </Link>
        <nav aria-label={t("menu")} className="mm-nav me-2 hidden items-center gap-0.5 xl:flex">
          {nav.map(([key, href]) => (
            <Link key={key} href={href} className="rounded-md px-3 py-1.5 text-[15px] font-semibold whitespace-nowrap opacity-80 hover:bg-header-foreground/10 hover:opacity-100">
              {t(key)}
            </Link>
          ))}
        </nav>
        <Suspense fallback={<Languages className="mx-2 size-4.5 opacity-60" />}>
          <LocaleSwitcher />
        </Suspense>
        <ThemeToggle />
        <SearchBar />
        {config.telegramChannel ? (
        <a
          href={`https://t.me/${config.telegramChannel}`}
          target="_blank"
          rel="noopener"
          className="mm-tg-btn inline-flex h-9 shrink-0 items-center gap-2 rounded-lg bg-primary px-3 text-sm font-bold whitespace-nowrap text-primary-foreground"
        >
          <Send className="size-4 rtl:-scale-x-100" />
          <span className="hidden sm:inline">{t("telegram")}</span>
        </a>
        ) : null}
      </div>
    </header>
  );
}
