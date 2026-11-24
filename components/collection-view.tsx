"use client";

import { AudioLines, BookText, Moon, Sunrise } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSearchParams } from "next/navigation";
import { Link, usePathname } from "@/i18n/navigation";
import type { Item } from "@/lib/library";
import { cn } from "@/lib/utils";
import { LessonList } from "./lesson-list";

/** Sections inside a collection (e.g. Ramadan nights), detected from the titles. */
const TYPES = [
  { id: "lessons", icon: BookText, test: (i: Item) => i.k === "lesson" && !/تهجد|فجر/.test(i.t) },
  { id: "tarawih", icon: AudioLines, test: (i: Item) => /^(تلاوة|عشاء) ليلة|تراويح/.test(i.t) },
  { id: "tahajjud", icon: Moon, test: (i: Item) => /تهجد/.test(i.t) },
  { id: "other", icon: Sunrise, test: () => true },
] as const;

export function CollectionView({ items }: { items: Item[] }) {
  const t = useTranslations("collection");
  const type = useSearchParams().get("type") ?? "";
  const pathname = usePathname();
  const typeOf = (i: Item) => TYPES.find((x) => x.test(i))!.id;
  const groups = TYPES.map((x) => ({ ...x, items: items.filter((i) => typeOf(i) === x.id) })).filter((g) => g.items.length);
  const cur = groups.find((g) => g.id === type);
  const shown = cur ? cur.items : items;
  const chip = "inline-flex shrink-0 items-center gap-1.5 rounded-full border bg-card px-3.5 py-1 text-[14.5px] font-semibold";
  return (
    <>
      {groups.length > 1 ? (
        <nav className="mb-2 flex gap-2 overflow-x-auto pb-2">
          <Link href={pathname} replace scroll={false} className={cn(chip, !cur && "border-primary bg-primary text-primary-foreground")}>
            {t("all")} <small className="opacity-70">{items.length}</small>
          </Link>
          {groups.map((g) => (
            <Link key={g.id} href={`${pathname}?type=${g.id}`} replace scroll={false} className={cn(chip, cur?.id === g.id && "border-primary bg-primary text-primary-foreground")}>
              <g.icon className="size-4" />
              {t(g.id)} <small className="opacity-70">{g.items.length}</small>
            </Link>
          ))}
        </nav>
      ) : null}
      <LessonList items={shown} showSheikh />
    </>
  );
}
