import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHead } from "@/components/blocks";
import { HomeCards } from "@/components/home-client";
import { currentWeek, getLookup } from "@/lib/data";
import { popularPage } from "@/lib/library";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.popular");
  return { title: t("title"), description: t("sub") };
}

export default async function Popular() {
  const [lk, t] = await Promise.all([getLookup(), getTranslations("pages.popular")]);
  const items = lk.items(popularPage(lk, await currentWeek()));
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <PageHead title={t("title")} sub={t("sub")} share="/popular" />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3">
        <HomeCards items={items} />
      </div>
    </main>
  );
}
