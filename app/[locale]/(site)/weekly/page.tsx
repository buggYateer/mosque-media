import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHead, SheikhCards } from "@/components/blocks";
import { getLookup } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.weekly");
  return { title: t("title"), description: t("sub") };
}

export default async function Weekly() {
  const [lk, t] = await Promise.all([getLookup(), getTranslations("pages.weekly")]);
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <PageHead title={t("title")} sub={t("sub")} share="/weekly" />
      <SheikhCards list={lk.site.sheikhs.filter((s) => s.main)} />
    </main>
  );
}
