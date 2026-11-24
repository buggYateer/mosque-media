"use client";

import { Play } from "lucide-react";
import type { Item } from "@/lib/library";
import { LessonCard } from "./lesson-list";
import { usePlayer } from "./player/player-provider";

export function FeaturePlay({ item, label }: { item: Item; label: string }) {
  const p = usePlayer();
  return (
    <button
      onClick={() => p.play(item, [item])}
      disabled={!item.p}
      className="mt-auto inline-flex items-center gap-2 self-start rounded-lg bg-highlight px-5 py-2.5 text-base font-extrabold text-highlight-foreground hover:bg-highlight/90 disabled:opacity-60"
    >
      <Play className="size-5 fill-current rtl:-scale-x-100" />
      {label}
    </button>
  );
}

/** Cards that play within their own group (the queue is the group). */
export function HomeCards({ items }: { items: Item[] }) {
  return items.map((i) => <LessonCard key={i.id} item={i} list={items} />);
}
