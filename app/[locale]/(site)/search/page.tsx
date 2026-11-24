import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { PageHead } from "@/components/blocks";
import { SearchResults } from "@/components/search-results";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("pages.search");
  return { title: t("title"), robots: { index: false } };
}

export default async function SearchPage() {
  const t = await getTranslations("pages.search");
  return (
    <main className="mx-auto max-w-6xl px-4 pt-5">
      <PageHead title={t("title")} />
      <Suspense>
        <SearchResults />
      </Suspense>
    </main>
  );
}
