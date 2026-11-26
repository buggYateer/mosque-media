import type { Metadata } from "next";
import { FilterPage, filterMetadata } from "@/components/filter-page";
import { TYPES } from "@/lib/site-shared";

/** Pages of the content types that have no page of their own (the mosque's own types, and «misc»). */
export function generateStaticParams() {
  const own = TYPES.filter((t) => t.path.startsWith("/t/")).map((t) => ({ type: t.key }));
  // (at least one entry is needed; an unknown type shows «not found»)
  return own.length ? own : [{ type: "other" }];
}

export async function generateMetadata({ params }: PageProps<"/[locale]/t/[type]">): Promise<Metadata> {
  return filterMetadata({ type: decodeURIComponent((await params).type) });
}

export default async function TypePage({ params }: PageProps<"/[locale]/t/[type]">) {
  return <FilterPage type={decodeURIComponent((await params).type)} />;
}
