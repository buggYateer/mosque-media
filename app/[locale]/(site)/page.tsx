import { getLocale, getTranslations } from "next-intl/server";
import { Fragment, type ReactNode } from "react";
import { OthersGrid, Rail, SectionHead, SeriesCard, SheikhCards } from "@/components/blocks";
import { iconFor } from "@/components/icons";
import { InstallBar } from "@/components/install";
import { FeaturePlay, HomeCards } from "@/components/home-client";
import { LessonList } from "@/components/lesson-list";
import { Link } from "@/i18n/navigation";
import { catLabel, currentWeek, getCategories, getLookup } from "@/lib/data";
import { popularPicks } from "@/lib/library";
import { dateText } from "@/lib/dates";
import { DEFAULT_TYPE, HOME, type HomeSection } from "@/lib/site-shared";

/** The home page. Its sections and their order come from site.config.json → home. */
export default async function Home() {
  const [lk, cats, t, locale] = await Promise.all([getLookup(), getCategories(), getTranslations(), getLocale()]);
  const { site } = lk;
  const latest = lk.ids.find((i) => site.lessons[String(i)].p && site.lessons[String(i)].k === DEFAULT_TYPE) ?? lk.ids[0];
  const feature = latest !== undefined ? lk.item(latest) : null;
  const tilawat = lk.items(lk.ids.filter((i) => site.lessons[String(i)].k === "tilawa" && !lk.inCollection.has(i)).slice(0, 3));
  const main = site.sheikhs.filter((s) => s.main);
  const rest = site.sheikhs.filter((s) => !s.main);
  const latestCards = lk.items(lk.ids.slice(0, 4));
  const popular = lk.items(popularPicks(lk, await currentWeek()));
  const featured = lk.items(site.featured.slice(0, 8));
  const allSeries = site.sheikhs.flatMap((sh) => (sh.series ?? []).map((se) => ({ se, sh })));
  const date = feature ? dateText(feature, { months: t.raw("common.months") as string[], hijriSuffix: t("common.hijriSuffix"), locale }) : "";

  const blocks: Record<HomeSection, ReactNode> = {
    categories: cats.length ? (
      <nav aria-label={t("nav.sections")} className="mm-cats grid grid-cols-2 gap-2.5 md:grid-cols-4">
        {cats.map((c) => {
          const Icon = iconFor(c.icon);
          return (
            <Link key={c.href} href={c.href} className="mm-cat flex items-center gap-3 rounded-xl border bg-card px-3.5 py-3 transition-colors hover:border-primary">
              <span className="mm-cat-icon grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                <Icon className="size-6" />
              </span>
              <b className="mm-cat-name flex-1 text-[16px] leading-tight">{catLabel(c, (k) => t(k as "nav.lessons"))}</b>
              <small className="mm-cat-n font-bold text-muted-foreground tabular-nums">{c.n}</small>
            </Link>
          );
        })}
      </nav>
    ) : null,
    feature: feature ? (
      <article className="mm-feature flex h-full flex-col gap-1.5 rounded-xl bg-primary p-6 text-primary-foreground md:order-last dark:border dark:bg-card dark:text-card-foreground">
        <small className="mm-feature-tag font-bold opacity-80">{t("home.latestLesson")}</small>
        <h2 className="text-2xl font-extrabold">{feature.t}</h2>
        <p className="mb-3 opacity-85">
          {feature.sh ? (
            <>
              {t("common.sheikh")} <bdi>{feature.sh.name}</bdi>
            </>
          ) : (
            ""
          )}
          {date ? `${feature.sh ? " — " : ""}${date}` : ""}
        </p>
        <FeaturePlay item={feature} label={t("home.listenLesson")} />
      </article>
    ) : null,
    latestTilawat: tilawat.length ? (
      <section>
        <SectionHead title={t("home.latestTilawat")} href="/tilawat" />
        <LessonList items={tilawat} showSheikh />
      </section>
    ) : null,
    featured: featured.length ? (
      <>
        <SectionHead title={t("home.featured")} />
        <Rail>
          <HomeCards items={featured} />
        </Rail>
      </>
    ) : null,
    weekly: main.length ? (
      <>
        <SectionHead title={t("home.weekly")} id="sheikhs" />
        <SheikhCards list={main} />
      </>
    ) : null,
    latest: latestCards.length ? (
      <section>
        <SectionHead title={t("home.latest")} href="/latest" />
        <div className="grid grid-cols-2 gap-3">
          <HomeCards items={latestCards} />
        </div>
      </section>
    ) : null,
    popular: popular.length ? (
      <section>
        <SectionHead title={t("home.popular")} href="/popular" />
        <div className="grid grid-cols-2 gap-3">
          <HomeCards items={popular} />
        </div>
      </section>
    ) : null,
    series: allSeries.length ? (
      <>
        <SectionHead title={t("home.series")} href="/series" />
        <Rail>
          {allSeries.map(({ se, sh }) => (
            <SeriesCard key={se.key} se={se} sh={sh} />
          ))}
        </Rail>
      </>
    ) : null,
    others: rest.length ? (
      <>
        <SectionHead title={t("home.others")} href="/others" />
        <OthersGrid list={rest.slice(0, 8)} />
      </>
    ) : null,
  };

  // Sections that sit side by side on wide screens when they come one after the other.
  const PAIRS: [HomeSection, HomeSection, string][] = [
    ["feature", "latestTilawat", "mt-5 grid items-start gap-5 md:grid-cols-2"],
    ["latest", "popular", "grid gap-x-5 md:grid-cols-2"],
  ];
  const shown = HOME.filter((s) => blocks[s]);
  const out: ReactNode[] = [];
  for (let i = 0; i < shown.length; i++) {
    const s = shown[i];
    const pair = PAIRS.find(([a, b]) => (s === a && shown[i + 1] === b) || (s === b && shown[i + 1] === a));
    if (pair) {
      out.push(
        <div key={s} className={pair[2]}>
          {blocks[s]}
          {blocks[shown[i + 1]]}
        </div>,
      );
      i++;
    } else {
      // alone: keep the same half-width layout it has next to its partner
      const half = PAIRS.find(([a, b]) => s === a || s === b);
      out.push(
        half ? (
          <div key={s} className={half[2]}>
            {blocks[s]}
          </div>
        ) : (
          <Fragment key={s}>{blocks[s]}</Fragment>
        ),
      );
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <InstallBar />
      {out}
    </main>
  );
}
