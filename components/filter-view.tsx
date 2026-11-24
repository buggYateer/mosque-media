"use client";

import { SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { usePathname, useRouter } from "@/i18n/navigation";
import type { Item } from "@/lib/library";
import { hijriMonth, SURAHS_AR, SURAHS_LATIN, surahNo, surahsOf } from "@/lib/text";
import { cn } from "@/lib/utils";
import { LessonList } from "./lesson-list";

export type Facet = "kind" | "sheikh" | "month" | "surah" | "series";

type Def = { label: string; all: string; of: (i: Item) => string[]; name: (k: string) => string; sort?: (a: string, b: string) => number };

export function FilterView({
  items,
  facets,
  unitKey,
  quickSheikhs,
  surahLatin,
}: {
  items: Item[];
  facets: Facet[];
  /** Translation key of the plural unit, e.g. "pages.lessons.unit". */
  unitKey: string;
  /** Shortcut chips for the main sheikhs (lessons page). */
  quickSheikhs?: { slug: string; name: string }[];
  /** Show surah names in Latin transliteration (non-Arabic-script languages). */
  surahLatin?: boolean;
}) {
  const t = useTranslations();
  const q = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const months = t.raw("common.months") as string[];

  const defs: Record<Facet, Def> = useMemo(
    () => ({
      kind: { label: t("filters.kind"), all: t("filters.allKinds"), of: (i) => [i.k], name: (k) => t(`kinds.${k}`) },
      sheikh: { label: t("filters.sheikh"), all: t("filters.allSheikhs"), of: (i) => (i.sh ? [i.sh.slug] : []), name: (k) => items.find((i) => i.sh?.slug === k)?.sh?.name ?? k },
      month: {
        label: t("filters.month"),
        all: t("filters.allMonths"),
        of: (i) => {
          const m = hijriMonth(i.h);
          return m ? [m.key] : [];
        },
        name: (k) => `${months[+k.split("-")[1] - 1]} ${k.split("-")[0]}`,
        sort: (a, b) => b.localeCompare(a),
      },
      surah: {
        label: t("filters.surah"),
        all: t("filters.allSurahs"),
        of: (i) => surahsOf(i.t).map((n) => String(surahNo(n) || n)),
        name: (k) => (surahLatin ? SURAHS_LATIN : SURAHS_AR)[+k - 1] ?? k,
        sort: (a, b) => (+a || 999) - (+b || 999),
      },
      series: {
        label: t("filters.series"),
        all: t("filters.allLessons"),
        of: (i) => [i.se ? i.se.key : "_"],
        name: (k) => (k === "_" ? t("filters.loose") : (items.find((i) => i.se?.key === k)?.se?.title ?? k)),
      },
    }),
    [t, items, months, surahLatin],
  );

  const sel = Object.fromEntries(facets.map((f) => [f, q.get(f) ?? ""])) as Record<Facet, string>;
  const order = q.get("order") === "old" ? "old" : "new";
  const pick = (except: Facet | null) => items.filter((i) => facets.every((f) => f === except || !sel[f] || defs[f].of(i).includes(sel[f])));
  let shown = pick(null);
  if (order === "old") shown = [...shown].reverse();
  const nActive = facets.filter((f) => sel[f]).length + (order === "old" ? 1 : 0);

  const update = (key: string, value: string) => {
    const n = new URLSearchParams(q.toString());
    if (value && !(key === "order" && value === "new")) n.set(key, value);
    else n.delete(key);
    if (key === "sheikh") n.delete("series");
    const s = n.toString();
    router.replace(`${pathname}${s ? `?${s}` : ""}`, { scroll: false });
  };

  const selectCls = "h-10 w-full rounded-lg border bg-muted/60 px-2.5 text-foreground";
  return (
    <>
      <div className="-mt-2 mb-3 flex items-center justify-end gap-2">
        <button
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className={cn("relative inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-3.5 text-sm font-semibold hover:bg-muted", open && "border-primary")}
        >
          <SlidersHorizontal className="size-4.5 text-primary" />
          {t("filters.toggle")}
          {nActive ? <b className="absolute -top-1.5 -start-1.5 grid size-5 place-items-center rounded-full bg-highlight text-[11px] text-highlight-foreground">{nActive}</b> : null}
        </button>
      </div>
      {open ? (
        <div className="mb-3 flex flex-wrap items-end gap-3 rounded-xl border bg-card p-3.5">
          {facets.map((f) => {
            const D = defs[f];
            const cnt = new Map<string, number>();
            for (const i of pick(f)) for (const k of D.of(i)) cnt.set(k, (cnt.get(k) ?? 0) + 1);
            const keys = [...cnt.keys()].sort(D.sort ?? ((a, b) => (cnt.get(b) ?? 0) - (cnt.get(a) ?? 0)));
            return (
              <label key={f} className="flex min-w-40 flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
                {D.label}
                <select className={selectCls} value={sel[f]} onChange={(e) => update(f, e.target.value)}>
                  <option value="">{D.all}</option>
                  {keys.map((k) => (
                    <option key={k} value={k}>
                      {D.name(k)} ({cnt.get(k)})
                    </option>
                  ))}
                </select>
              </label>
            );
          })}
          <label className="flex min-w-40 flex-1 flex-col gap-1 text-[13px] text-muted-foreground">
            {t("filters.order")}
            <select className={selectCls} value={order} onChange={(e) => update("order", e.target.value)}>
              <option value="new">{t("filters.newest")}</option>
              <option value="old">{t("filters.oldest")}</option>
            </select>
          </label>
          {nActive ? (
            <button className="h-10 px-2 font-bold text-primary" onClick={() => router.replace(pathname, { scroll: false })}>
              {t("filters.clear")}
            </button>
          ) : null}
        </div>
      ) : null}
      {quickSheikhs?.length ? (
        <div role="group" className="mb-2 flex gap-2 overflow-x-auto pb-2">
          {[{ slug: "", name: t("filters.quickAll") }, ...quickSheikhs].map((s) => (
            <button
              key={s.slug}
              onClick={() => update("sheikh", s.slug)}
              className={cn(
                "shrink-0 rounded-full border bg-card px-3.5 py-1 text-[14.5px] font-semibold",
                sel.sheikh === s.slug && "border-primary bg-primary text-primary-foreground",
              )}
            >
              {s.name}
            </button>
          ))}
        </div>
      ) : null}
      {nActive ? <p className="mb-2 text-muted-foreground">{t("filters.matching", { count: t(unitKey, { count: shown.length }) })}</p> : null}
      <LessonList items={shown} limit={30} showSheikh showKind={facets.includes("kind")} />
    </>
  );
}
