"use client";

import { Menu, Moon, Search, Smartphone, Sun, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { iconFor } from "./icons";
import { useInstall } from "./install";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";

export type NavEntry = { href: string; label: string; icon: string; n?: number };
export type NavGroup = { title: string; items: NavEntry[] };

const onHeader = "grid size-10 shrink-0 place-items-center rounded-lg text-header-foreground hover:bg-header-foreground/10";

export function DrawerMenu({ groups }: { groups: NavGroup[] }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const install = useInstall();
  const dark = resolvedTheme === "dark";
  const rtl = ["ar", "ur"].includes(useLocale());
  const row = "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-[15.5px] hover:bg-muted";
  return (
    <>
      <button className={onHeader} aria-label={t("menu")} aria-expanded={open} onClick={() => setOpen(true)}>
        <Menu className="size-5" />
      </button>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={rtl ? "right" : "left"} className="w-[min(300px,84vw)] gap-0 overflow-y-auto p-3" showCloseButton={false}>
          <SheetTitle className="sr-only">{t("menu")}</SheetTitle>
          <div className="mb-2 flex items-center gap-2">
            <form
              className="flex-1"
              onSubmit={(e) => {
                e.preventDefault();
                const v = new FormData(e.currentTarget).get("q")?.toString().trim();
                if (v) {
                  setOpen(false);
                  router.push(`/search?q=${encodeURIComponent(v)}`);
                }
              }}
            >
              <input name="q" type="search" placeholder={t("search")} aria-label={t("search")} className="h-10 w-full rounded-lg border bg-muted/60 px-3" />
            </form>
            <button className="grid size-10 place-items-center rounded-lg hover:bg-muted" aria-label={t("close")} onClick={() => setOpen(false)}>
              <X className="size-5" />
            </button>
          </div>
          <nav>
            {groups.map((g) => (
              <div key={g.title}>
                <h4 className="mx-2 mt-4 mb-1 text-[12.5px] font-bold text-muted-foreground">{g.title}</h4>
                {g.items.map((it) => {
                  const Icon = iconFor(it.icon);
                  const here = pathname === it.href;
                  return (
                    <Link key={it.href} href={it.href} onClick={() => setOpen(false)} aria-current={here ? "page" : undefined} className={cn(row, here && "bg-accent font-bold text-primary")}>
                      <Icon className="size-5 text-primary" />
                      <span className="flex-1">{it.label}</span>
                      {it.n !== undefined ? <small className="text-[13px] text-muted-foreground tabular-nums">{it.n}</small> : null}
                    </Link>
                  );
                })}
              </div>
            ))}
            {install.can ? (
              <button className={row} onClick={install.run}>
                <Smartphone className="size-5 text-primary" />
                <span>{t("install")}</span>
              </button>
            ) : null}
            <button className={row} onClick={() => setTheme(dark ? "light" : "dark")}>
              {dark ? <Sun className="size-5 text-primary" /> : <Moon className="size-5 text-primary" />}
              <span>{dark ? t("themeLight") : t("themeDark")}</span>
            </button>
          </nav>
        </SheetContent>
      </Sheet>
    </>
  );
}

function SearchBarInner() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const params = useSearchParams();
  const onSearch = pathname === "/search";
  const [open, setOpen] = useState(onSearch);
  const [value, setValue] = useState(params.get("q") ?? "");
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Leaving the search page closes the bar; arriving on it opens it.
  const [wasSearch, setWasSearch] = useState(onSearch);
  if (wasSearch !== onSearch) {
    setWasSearch(onSearch);
    setOpen(onSearch);
    if (!onSearch) setValue("");
  }
  useEffect(() => {
    if (open && !onSearch) input.current?.focus();
  }, [open, onSearch]);

  const go = (v: string) => {
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const url = `/search${v.trim() ? `?q=${encodeURIComponent(v.trim())}` : ""}`;
      if (onSearch) router.replace(url, { scroll: false });
      else router.push(url);
    }, 250);
  };

  return (
    <>
      <button
        className={onHeader}
        aria-label={t("search")}
        aria-expanded={open}
        onClick={() => {
          if (open && onSearch) router.push("/");
          setOpen(!open);
        }}
      >
        <Search className="size-5" />
      </button>
      {open ? (
        <div className="absolute inset-x-0 top-full border-t bg-header py-2.5">
          <div className="mx-auto max-w-6xl px-4">
            <div className="flex items-center gap-2 rounded-lg border bg-background px-3 text-foreground">
              <Search className="size-5 text-muted-foreground" />
              <input
                ref={input}
                type="search"
                value={value}
                placeholder={t("searchPlaceholder")}
                aria-label={t("search")}
                autoComplete="off"
                enterKeyHint="search"
                className="h-11 flex-1 bg-transparent text-base outline-none"
                onChange={(e) => {
                  setValue(e.target.value);
                  go(e.target.value);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Escape") {
                    setOpen(false);
                    setValue("");
                    if (onSearch) router.push("/");
                  }
                }}
              />
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function SearchBar() {
  const t = useTranslations("nav");
  return (
    <Suspense
      fallback={
        <button className={onHeader} aria-label={t("search")}>
          <Search className="size-5" />
        </button>
      }
    >
      <SearchBarInner />
    </Suspense>
  );
}
