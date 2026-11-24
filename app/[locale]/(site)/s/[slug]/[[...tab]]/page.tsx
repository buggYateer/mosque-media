import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { cleanTitle, Crumbs } from "@/components/blocks";
import { Cover } from "@/components/cover";
import { LessonList } from "@/components/lesson-list";
import { LatestCard, SeriesSections } from "@/components/sheikh-client";
import { ShareButton } from "@/components/share-button";
import { Link } from "@/i18n/navigation";
import { config } from "@/lib/config";
import { getLookup, getSite } from "@/lib/data";
import { clipCount, newest, sheikhAll, sheikhTabs, tabIds } from "@/lib/library";
import { toneOf } from "@/lib/theme";
import { cn } from "@/lib/utils";

export async function generateStaticParams() {
  const site = await getSite();
  return site.sheikhs.flatMap((sh) => [{ slug: sh.slug, tab: [] as string[] }, ...sheikhTabs(sh).map((t) => ({ slug: sh.slug, tab: [t.id] }))]);
}

async function resolve(params: Promise<{ slug: string; tab?: string[] }>) {
  const { slug, tab } = await params;
  const lk = await getLookup();
  const sh = lk.bySlug.get(decodeURIComponent(slug)) ?? lk.byKey.get(decodeURIComponent(slug));
  if (!sh) notFound();
  const tabs = sheikhTabs(sh);
  const active = tabs.find((x) => x.id === decodeURIComponent(tab?.[0] ?? "")) ?? tabs[0];
  if (tab?.[0] && active?.id !== decodeURIComponent(tab[0])) notFound();
  return { lk, sh, tabs, active };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/s/[slug]/[[...tab]]">): Promise<Metadata> {
  const { sh, active } = await resolve(params);
  const t = await getTranslations("common");
  const se = (sh.series ?? []).find((x) => x.key === active?.id);
  return { title: se ? `${se.title} — ${t("sheikh")} ${sh.name}` : `${t("sheikh")} ${sh.name}` };
}

export default async function SheikhPage({ params }: PageProps<"/[locale]/s/[slug]/[[...tab]]">) {
  const { lk, sh, tabs, active } = await resolve(params);
  const t = await getTranslations();
  const day = config.sheikhs.find((x) => x.key === sh.key)?.day;
  const lastId = newest(sheikhAll(sh)).find((i) => lk.site.lessons[String(i)]?.p) ?? newest(sheikhAll(sh))[0];
  const label = (x: (typeof tabs)[number]) => x.label || t(x.labelKey === "recent" ? "sheikh.recent" : x.labelKey === "loose" ? "sheikh.loose" : (x.labelKey as "kinds.lesson"));
  const groupTitle = (g: string) =>
    g === "series" ? t("sheikh.groupSeries") : g === "other" ? t("sheikh.groupOther") : tabs.some((x) => x.id === "tilawa" && x.group === "lessons") ? t("sheikh.groupLessonsTilawat") : t("sheikh.groupLessons");

  const { ids, series } = active ? tabIds(sh, active.id) : { ids: [] };
  const groups = [...new Set(tabs.map((x) => x.group))];

  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <Crumbs items={[{ label: sh.name }]} />
      <header className="mb-4 flex flex-wrap items-center justify-between gap-3 border-b-2 pt-2 pb-4">
        <div>
          <h1 className="text-3xl font-extrabold">
            {sh.main ? `${t("common.sheikh")} ` : ""}
            {sh.name}
          </h1>
          <p className="mt-0.5 text-muted-foreground">
            {day ? `${day} · ` : ""}
            {t("common.clips", { count: clipCount(sh) })}
          </p>
        </div>
        <ShareButton path={`/s/${sh.slug}`} title={`${t("common.sheikh")} ${sh.name}`} />
      </header>

      {lastId !== undefined ? <LatestCard item={lk.item(lastId)} label={t("sheikh.latestClip")} /> : null}

      <div className="grid items-start gap-5 md:grid-cols-[250px_1fr]">
        <nav aria-label={t("nav.sections")} className="sticky top-16 z-[5] -mx-4 flex gap-1.5 overflow-x-auto border-y bg-background px-4 py-2 md:top-20 md:mx-0 md:flex-col md:rounded-xl md:border md:bg-card md:p-2">
          {groups.map((g) => (
            <div key={g} className="contents md:block">
              <h4 className="mx-2 mt-2 mb-1 hidden text-[12.5px] font-bold text-muted-foreground md:block">{groupTitle(g)}</h4>
              {tabs
                .filter((x) => x.group === g)
                .map((x) => (
                  <Link
                    key={x.id}
                    href={`/s/${sh.slug}/${x.id}`}
                    replace
                    scroll={false}
                    aria-current={x.id === active?.id ? "page" : undefined}
                    className={cn(
                      "flex shrink-0 items-center justify-between gap-2 rounded-full border px-3 py-1.5 text-[15px] md:w-full md:rounded-lg md:border-0 md:px-2.5",
                      x.id === active?.id ? "border-primary bg-primary font-bold text-primary-foreground" : "hover:bg-muted",
                    )}
                  >
                    <span>{label(x)}</span>
                    <b className="text-[13px] font-semibold opacity-70 tabular-nums">{x.n}</b>
                  </Link>
                ))}
            </div>
          ))}
        </nav>

        <section>
          {series ? (
            <Cover
              tone={toneOf(config, sh.key)}
              kind="series"
              tag={/^سلسلة/.test(series.title) ? t("sheikh.seriesLabel") : t("sheikh.lessonsLabel")}
              title={cleanTitle(series.title)}
              byline={`${t("common.sheikh")} ${sh.name}`}
              className="mb-3 aspect-auto min-h-40 rounded-xl"
            />
          ) : null}
          <div className="mb-2.5 flex items-center justify-between gap-3">
            <div>
              {!series && active ? <h2 className="text-[21px] font-extrabold">{label(active)}</h2> : null}
              <p className="text-sm text-muted-foreground">{t("sheikh.panelCount", { count: ids.length })}</p>
            </div>
            {active ? <ShareButton path={`/s/${sh.slug}/${active.id}`} title={`${label(active)} — ${t("common.sheikh")} ${sh.name}`} /> : null}
          </div>
          {series && series.sections.length > 1 ? (
            <SeriesSections
              sections={series.sections
                .map((x) => ({ t: x.t, items: lk.items(newest(x.ids)) }))
                .sort((a, b) => (b.items[0]?.id ?? 0) - (a.items[0]?.id ?? 0))}
              queue={lk.items(ids)}
            />
          ) : (
            <LessonList items={lk.items(series ? newest(ids) : ids)} queue={series ? lk.items(ids) : undefined} limit={series ? undefined : 15} />
          )}
        </section>
      </div>
    </main>
  );
}
