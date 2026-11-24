"use client";

import { ChevronLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import type { Item } from "@/lib/library";
import { cn } from "@/lib/utils";
import { LessonList, PlayButton, useHijri } from "./lesson-list";

export function LatestCard({ item, label }: { item: Item; label: string }) {
  const hijri = useHijri();
  return (
    <div className="mb-4 flex items-center gap-3.5 rounded-xl border border-s-[5px] border-s-highlight bg-card px-4 py-3.5">
      <PlayButton item={item} list={[item]} size="lg" />
      <div className="min-w-0">
        <small className="font-bold text-muted-foreground">{label}</small>
        <div className="text-[17px] font-bold">{item.t}</div>
        <div className="text-[13.5px] text-muted-foreground">
          {hijri(item.h)}
          {item.d ? ` — ${item.d}` : ""}
        </div>
      </div>
    </div>
  );
}

/** Sections of a series that open on tap; playback follows the series' natural order. */
export function SeriesSections({ sections, queue }: { sections: { t: string; items: Item[] }[]; queue: Item[] }) {
  const t = useTranslations("common");
  const [open, setOpen] = useState<Record<number, boolean>>({});
  return (
    <div className="space-y-2">
      {sections.map((s, i) => (
        <section key={s.t + i} className="overflow-hidden rounded-xl border bg-card">
          <button className="flex w-full items-center gap-2.5 px-3.5 py-3 text-start font-bold" aria-expanded={!!open[i]} onClick={() => setOpen((o) => ({ ...o, [i]: !o[i] }))}>
            <ChevronLeft className={cn("size-5 text-muted-foreground transition-transform ltr:rotate-180", open[i] && "-rotate-90 ltr:rotate-90")} />
            <span className="flex-1">{s.t || t("lessonsCount", { count: s.items.length })}</span>
            <small className="font-semibold text-muted-foreground">{t("lessonsCount", { count: s.items.length })}</small>
          </button>
          {open[i] ? <LessonList items={s.items} queue={queue} className="rounded-none border-0 border-t" /> : null}
        </section>
      ))}
    </div>
  );
}
