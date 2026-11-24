import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHead, SeriesCard } from "@/components/blocks";
import { getLookup } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.series");
  return { title: t("title"), description: t("sub") };
}

export default async function SeriesPage() {
  const [lk, t] = await Promise.all([getLookup(), getTranslations("pages.series")]);
  const all = lk.site.sheikhs.flatMap((sh) => (sh.series ?? []).map((se) => ({ se, sh })));
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <PageHead title={t("title")} sub={t("sub")} share="/series" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        {all.map(({ se, sh }) => (
          <SeriesCard key={se.key} se={se} sh={sh} />
        ))}
      </div>
    </main>
  );
}
