"use client";

import { Menu, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import dynamic from "next/dynamic";
import { useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";

// The menu panel (and its dialog library) loads on first use, not with the page.
const DrawerSheet = dynamic(() => import("./drawer-sheet").then((m) => m.DrawerSheet), { ssr: false });

export type NavEntry = { href: string; label: string; icon: string; n?: number };
export type NavGroup = { title: string; items: NavEntry[] };

const onHeader = "grid size-10 shrink-0 place-items-center rounded-lg text-header-foreground hover:bg-header-foreground/10";

export function DrawerMenu({ groups }: { groups: NavGroup[] }) {
  const t = useTranslations("nav");
  const [open, setOpen] = useState(false);
  const [loaded, setLoaded] = useState(false);
  return (
    <>
      <button
        className={onHeader}
        aria-label={t("menu")}
        aria-expanded={open}
        onPointerEnter={() => setLoaded(true)}
        onClick={() => {
          setLoaded(true);
          setOpen(true);
        }}
      >
        <Menu className="size-5" />
      </button>
      {loaded ? <DrawerSheet groups={groups} open={open} setOpen={setOpen} /> : null}
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
