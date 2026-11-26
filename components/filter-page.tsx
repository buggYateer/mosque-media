import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHead } from "@/components/blocks";
import { FilterView, type Facet } from "@/components/filter-view";
import { LessonList } from "@/components/lesson-list";
import { getLookup } from "@/lib/data";
import { kindIds } from "@/lib/library";
import { TYPE_KEYS, typeOf } from "@/lib/site-shared";

const PAGES = {
  all: { kind: null, facets: ["kind", "sheikh", "month"] },
  videos: { kind: null, facets: ["kind", "sheikh", "month"] },
  lessons: { kind: "lesson", facets: ["sheikh", "series", "month"] },
  khutab: { kind: "khutba", facets: ["sheikh", "month"] },
  tilawat: { kind: "tilawa", facets: ["sheikh", "surah", "month"] },
} as const satisfies Record<string, { kind: string | null; facets: Facet[] }>;
export type FilterPageKey = keyof typeof PAGES;

/** A built-in page (/all, /lessons, …) or the page of a type from site.config.json (/t/<key>). */
type Target = { page: FilterPageKey } | { type: string };

async function resolve(target: Target) {
  const t = await getTranslations();
  if ("page" in target) {
    const def = PAGES[target.page];
    // a built-in type the mosque removed from its types has no page
    if (def.kind && !TYPE_KEYS.includes(def.kind)) notFound();
    return {
      kind: def.kind,
      onlyVideo: target.page === "videos",
      facets: [...def.facets] as Facet[],
      title: t(`pages.${target.page}.title`),
      unitKey: `pages.${target.page}.unit`,
      path: `/${target.page}`,
      quick: target.page === "lessons",
    };
  }
  if (!TYPE_KEYS.includes(target.type)) notFound();
  const ty = typeOf(target.type);
  const facets: Facet[] = ["sheikh", "series", ...(ty.surahs ? (["surah"] as Facet[]) : []), "month"];
  return { kind: ty.key, onlyVideo: false, facets, title: t(`kinds.${ty.key}` as "kinds.lesson"), unitKey: "pages.all.unit", path: ty.path, quick: false };
}

export async function filterMetadata(target: FilterPageKey | Target) {
  const r = await resolve(typeof target === "string" ? { page: target } : target);
  return { title: r.title };
}

/** /all, /videos, /lessons, /khutab, /tilawat and /t/<type>: the list with filters kept in the URL. */
export async function FilterPage(target: Target) {
  const [lk, locale, r] = await Promise.all([getLookup(), getLocale(), resolve(target)]);
  const t = await getTranslations();
  const items = lk.items(kindIds(lk, r.kind).filter((i) => !r.onlyVideo || lk.site.lessons[String(i)].vid));
  if (r.onlyVideo && !items.length) notFound();
  // the series filter only when some of these recordings are in a series; the type filter only with several types
  const facets = r.facets.filter((f) => (f !== "series" || items.some((i) => i.se)) && (f !== "kind" || new Set(items.map((i) => i.k)).size > 1));
  const quick = r.quick ? lk.site.sheikhs.filter((s) => s.main).map((s) => ({ slug: s.slug, name: s.name })) : undefined;
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <PageHead title={r.title} sub={t(r.unitKey as "pages.all.unit", { count: items.length })} share={r.path} />
      {/* Filters read the URL, so they render in the browser; the list below is the no-JavaScript fallback. */}
      <Suspense fallback={<LessonList items={items} limit={30} showSheikh showKind={!r.kind} />}>
        <FilterView items={items} facets={facets} unitKey={r.unitKey} quickSheikhs={quick} surahLatin={!["ar", "ur"].includes(locale)} />
      </Suspense>
    </main>
  );
}
