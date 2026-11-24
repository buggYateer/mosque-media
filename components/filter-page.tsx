import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHead } from "@/components/blocks";
import { FilterView, type Facet } from "@/components/filter-view";
import { LessonList } from "@/components/lesson-list";
import { getLookup } from "@/lib/data";
import { kindIds } from "@/lib/library";
import type { Kind } from "@/lib/storage/types";

const PAGES = {
  all: { kind: null, facets: ["kind", "sheikh", "month"] },
  lessons: { kind: "lesson", facets: ["sheikh", "series", "month"] },
  khutab: { kind: "khutba", facets: ["sheikh", "month"] },
  tilawat: { kind: "tilawa", facets: ["sheikh", "surah", "month"] },
} as const satisfies Record<string, { kind: Kind | null; facets: Facet[] }>;
export type FilterPageKey = keyof typeof PAGES;

export async function filterMetadata(page: FilterPageKey) {
  const t = await getTranslations(`pages.${page}`);
  return { title: t("title") };
}

/** /all, /lessons, /khutab, /tilawat: the list with filters kept in the URL. */
export async function FilterPage({ page }: { page: FilterPageKey }) {
  const [lk, t, locale] = await Promise.all([getLookup(), getTranslations(), getLocale()]);
  const def = PAGES[page];
  const items = lk.items(kindIds(lk, def.kind));
  const quick = page === "lessons" ? lk.site.sheikhs.filter((s) => s.main).map((s) => ({ slug: s.slug, name: s.name })) : undefined;
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <PageHead title={t(`pages.${page}.title`)} sub={t(`pages.${page}.unit`, { count: items.length })} share={`/${page}`} />
      {/* Filters read the URL, so they render in the browser; the list below is the no-JavaScript fallback. */}
      <Suspense fallback={<LessonList items={items} limit={30} showSheikh showKind={!def.kind} />}>
        <FilterView items={items} facets={[...def.facets]} unitKey={`pages.${page}.unit`} quickSheikhs={quick} surahLatin={!["ar", "ur"].includes(locale)} />
      </Suspense>
    </main>
  );
}
