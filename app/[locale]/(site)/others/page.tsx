import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHead } from "@/components/blocks";
import { OthersSorted } from "@/components/others-sorted";
import { getLookup } from "@/lib/data";
import { clipCount } from "@/lib/library";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.others");
  return { title: t("title") };
}

export default async function Others() {
  const [lk, t] = await Promise.all([getLookup(), getTranslations("pages.others")]);
  const rest = lk.site.sheikhs.filter((s) => !s.main).map((s) => ({ slug: s.slug, name: s.name, n: clipCount(s) }));
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <PageHead title={t("title")} sub={t("sub", { count: rest.length })} share="/others" />
      <OthersSorted list={rest} />
    </main>
  );
}
