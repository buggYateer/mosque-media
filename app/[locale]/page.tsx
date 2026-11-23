import { BookOpen, Headphones, Library, Mic, Play, Users } from "lucide-react";
import { getLocale, getTranslations } from "next-intl/server";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { config, RTL_LOCALES, type Locale } from "@/lib/config";
import { countAll, getSite } from "@/lib/data";
import { dataStore, audioStore } from "@/lib/storage";
import { toneOf } from "@/lib/theme";

/** Literal class names so Tailwind generates them. */
const TONE_BG = ["bg-tone-1", "bg-tone-2", "bg-tone-3", "bg-tone-4", "bg-tone-5", "bg-tone-6"];

/**
 * PHASE 0 — temporary foundation page.
 * Proves config → theme, fonts, languages (RTL/LTR), dark mode and the data layer.
 * Replaced by the real home page in phase 1.
 */
export default async function FoundationPage() {
  const [site, t, locale] = await Promise.all([getSite(), getTranslations(), getLocale()]);
  const n = countAll(site);
  const main = site.sheikhs.filter((s) => s.main);
  const clips = (sh: (typeof site.sheikhs)[number]) =>
    sh.lesson.length + sh.khutba.length + sh.tilawa.length + sh.other.length + (sh.series ?? []).reduce((a, se) => a + se.sections.reduce((b, x) => b + x.ids.length, 0), 0);

  const stats = [
    { icon: Headphones, value: n.lessons, label: t("home.stats.lessons") },
    { icon: Users, value: n.sheikhs, label: t("home.stats.sheikhs") },
    { icon: Library, value: n.series, label: t("home.stats.series") },
    { icon: Mic, value: n.khutab, label: t("home.stats.khutab") },
  ];
  const checks = [
    [t("foundation.font"), config.design.font],
    [t("foundation.corners"), config.design.corners],
    [t("foundation.header"), config.design.header],
    [t("foundation.locale"), locale],
    [t("foundation.direction"), RTL_LOCALES.includes(locale as Locale) ? t("foundation.rtl") : t("foundation.ltr")],
    [t("foundation.data"), dataStore.name],
    [t("foundation.audio"), audioStore.name],
  ];

  return (
    <main className="mx-auto max-w-6xl space-y-8 px-4 py-6">
      <section className="flex flex-col gap-4 rounded-xl bg-primary p-6 text-primary-foreground sm:p-8 dark:border dark:bg-card dark:text-card-foreground">
        <h1 className="text-3xl font-extrabold sm:text-4xl">{config.name}</h1>
        <p className="max-w-2xl text-lg opacity-85">{config.description}</p>
        <div className="flex flex-wrap gap-3">
          <Button size="lg" className="h-11 gap-2 bg-highlight px-5 text-base font-bold text-highlight-foreground hover:bg-highlight/90">
            <Play className="size-5 fill-current rtl:-scale-x-100" />
            {t("home.listenLatest")}
          </Button>
          <Button size="lg" variant="outline" className="h-11 gap-2 border-current/30 bg-transparent px-5 text-base text-current hover:bg-current/10 hover:text-current dark:bg-transparent">
            <BookOpen className="size-5" />
            {t("home.browseSeries")}
          </Button>
        </div>
      </section>

      <section className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(({ icon: Icon, value, label }) => (
          <Card key={label} className="flex-row items-center gap-3 px-4">
            <span className="grid size-11 place-items-center rounded-lg bg-accent text-primary">
              <Icon className="size-6" />
            </span>
            <div className="leading-tight">
              <div className="text-2xl font-extrabold">{value}</div>
              <div className="text-sm text-muted-foreground">{label}</div>
            </div>
          </Card>
        ))}
      </section>

      <section className="space-y-3">
        <h2 className="text-2xl font-extrabold">{t("home.weekly")}</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {main.map((sh) => (
            <Card key={sh.key} className="gap-0 overflow-hidden py-0">
              <div className={`h-2 ${TONE_BG[toneOf(config, sh.key) - 1]}`} />
              <CardHeader className="pt-4">
                <span className="text-sm text-muted-foreground">{t("home.sheikh")}</span>
                <CardTitle className="text-xl font-extrabold">{sh.name}</CardTitle>
              </CardHeader>
              <CardContent className="flex items-center justify-between pb-4">
                <span className="rounded-full bg-accent px-3 py-0.5 text-sm font-bold text-accent-foreground">
                  {config.sheikhs.find((s) => s.key === sh.key)?.day ?? "—"}
                </span>
                <span className="text-sm text-muted-foreground">{t("home.clips", { count: clips(sh) })}</span>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <Card className="border-dashed">
        <CardHeader>
          <CardTitle className="text-lg font-extrabold">{t("foundation.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("foundation.note")}</p>
        </CardHeader>
        <CardContent>
          <dl className="grid grid-cols-1 gap-x-8 gap-y-2 sm:grid-cols-2">
            {checks.map(([k, v]) => (
              <div key={k} className="flex justify-between gap-4 border-b py-1.5">
                <dt className="text-muted-foreground">{k}</dt>
                <dd className="font-semibold" dir="auto">
                  {v}
                </dd>
              </div>
            ))}
          </dl>
        </CardContent>
      </Card>
    </main>
  );
}
