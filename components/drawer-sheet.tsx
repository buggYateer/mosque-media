"use client";

/** The side menu itself (loaded the first time the menu button is pressed). */
import { Moon, Smartphone, Sun, X } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { Link, usePathname, useRouter } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import type { NavGroup } from "./header-client";
import { iconFor } from "./icons";
import { useInstall } from "./install";
import { Sheet, SheetContent, SheetTitle } from "./ui/sheet";

export function DrawerSheet({ groups, open, setOpen }: { groups: NavGroup[]; open: boolean; setOpen: (o: boolean) => void }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const { resolvedTheme, setTheme } = useTheme();
  const install = useInstall();
  const dark = resolvedTheme === "dark";
  const rtl = ["ar", "ur"].includes(useLocale());
  const row = "flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-start text-[15.5px] hover:bg-muted";
  return (
    <>
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetContent side={rtl ? "right" : "left"} className="mm-drawer w-[min(300px,84vw)] gap-0 overflow-y-auto p-3" showCloseButton={false}>
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
                <h4 className="mm-drawer-h mx-2 mt-4 mb-1 text-[12.5px] font-bold text-muted-foreground">{g.title}</h4>
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
