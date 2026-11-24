import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { PageHead } from "@/components/blocks";
import { LessonList } from "@/components/lesson-list";
import { getLookup } from "@/lib/data";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.latest");
  return { title: t("title"), description: t("sub") };
}

export default async function Latest() {
  const [lk, t] = await Promise.all([getLookup(), getTranslations("pages.latest")]);
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <PageHead title={t("title")} sub={t("sub")} share="/latest" />
      <LessonList items={lk.items(lk.ids.slice(0, 10))} showSheikh showKind />
    </main>
  );
}
