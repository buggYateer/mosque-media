import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { Suspense } from "react";
import { PageHead } from "@/components/blocks";
import { CollectionView } from "@/components/collection-view";
import { LessonList } from "@/components/lesson-list";
import { getLookup, getSite } from "@/lib/data";

export async function generateStaticParams() {
  return (await getSite()).collections.map((c) => ({ key: c.key }));
}

async function find(params: Promise<{ key: string }>) {
  const { key } = await params;
  const lk = await getLookup();
  const c = lk.site.collections.find((x) => x.key === decodeURIComponent(key));
  if (!c) notFound();
  return { lk, c };
}

export async function generateMetadata({ params }: PageProps<"/[locale]/c/[key]">): Promise<Metadata> {
  const { c } = await find(params);
  return { title: c.title };
}

export default async function CollectionPage({ params }: PageProps<"/[locale]/c/[key]">) {
  const { lk, c } = await find(params);
  const t = await getTranslations("common");
  const items = lk.items([...c.ids].sort((a, b) => a - b));
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <PageHead title={c.title} sub={t("clips", { count: items.length })} share={`/c/${c.key}`} />
      <Suspense fallback={<LessonList items={items} showSheikh />}>
        <CollectionView items={items} />
      </Suspense>
    </main>
  );
}
