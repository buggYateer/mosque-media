"use client";

import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { Item } from "@/lib/library";
import { norm } from "@/lib/text";
import { LessonList } from "./lesson-list";

type Indexed = Item & { x: string };
let cache: Promise<Indexed[]> | null = null;
const loadIndex = () => (cache ??= fetch("/data/index.json").then((r) => r.json()));

export function SearchResults() {
  const t = useTranslations("pages.search");
  const q = useSearchParams().get("q")?.trim() ?? "";
  const [index, setIndex] = useState<Indexed[] | null>(null);
  useEffect(() => {
    loadIndex().then(setIndex).catch(() => setIndex([]));
  }, []);
  const results = useMemo(() => {
    const words = norm(q).split(/\s+/).filter(Boolean);
    if (!words.length || !index) return [];
    return index.filter((i) => {
      const hay = norm(`${i.t} ${i.sh?.name ?? ""} ${i.x}`);
      return words.every((w) => hay.includes(w));
    });
  }, [q, index]);
  return (
    <>
      <p className="-mt-2 mb-4 text-muted-foreground">{q ? (index ? t("results", { count: results.length, q }) : "…") : t("prompt")}</p>
      {q && index ? <LessonList items={results} limit={30} showSheikh showKind /> : null}
    </>
  );
}
