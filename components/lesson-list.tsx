"use client";

import { Pause, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Link } from "@/i18n/navigation";
import type { Item } from "@/lib/library";
import { formatHijri, parseDur } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Cover } from "./cover";
import { useStored } from "@/lib/use-stored";
import { usePlayer } from "./player/player-provider";

export function useHijri() {
  const t = useTranslations("common");
  const months = t.raw("months") as string[];
  const suffix = t("hijriSuffix");
  return (h: string) => formatHijri(h, months, suffix);
}

const BADGE: Record<string, string> = {
  lesson: "bg-blue-100 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
  khutba: "bg-pink-100 text-pink-700 dark:bg-pink-950 dark:text-pink-300",
  tilawa: "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
  other: "bg-muted text-muted-foreground",
};

export function KindBadge({ kind }: { kind: Item["k"] }) {
  const t = useTranslations("kind");
  return <span className={cn("me-1.5 inline-block rounded-full px-2 align-[2px] text-xs font-bold", BADGE[kind])}>{t(kind)}</span>;
}

/** Listening progress saved on this device. */
function Progress({ item }: { item: Item }) {
  const [pos] = useStored(`pos:${item.id}`, "0");
  const d = parseDur(item.d);
  const pct = Number(pos) && d ? Math.min(100, (Number(pos) / d) * 100) : 0;
  if (pct <= 1) return null;
  return (
    <div className="mt-1.5 h-[3px] overflow-hidden rounded-full bg-border">
      <i className="block h-full bg-highlight" style={{ width: `${pct}%` }} />
    </div>
  );
}

export function PlayButton({ item, list, className, size = "md" }: { item: Item; list: Item[]; className?: string; size?: "md" | "lg" }) {
  const p = usePlayer();
  const t = useTranslations("common");
  const on = p.current?.id === item.id;
  const playing = on && p.playing;
  return (
    <button
      onClick={(e) => {
        e.stopPropagation();
        p.play(item, list);
      }}
      disabled={!item.p}
      title={item.p ? undefined : t("telegramOnlyTitle")}
      aria-label={t("play", { title: item.t })}
      className={cn(
        "mm-play grid shrink-0 place-items-center rounded-full border-[1.5px] border-primary text-primary transition-colors hover:bg-primary hover:text-primary-foreground disabled:border-border disabled:text-muted-foreground disabled:hover:bg-transparent",
        size === "lg" ? "size-12" : "size-10",
        on && "bg-primary text-primary-foreground",
        className,
      )}
    >
      {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current" />}
    </button>
  );
}

export function LessonRow({ item, list, showSheikh, showKind }: { item: Item; list: Item[]; showSheikh?: boolean; showKind?: boolean }) {
  const p = usePlayer();
  const t = useTranslations("common");
  const hijri = useHijri();
  const on = p.current?.id === item.id;
  return (
    <div
      data-playing={on || undefined}
      className={cn("mm-row flex cursor-pointer items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0 hover:bg-muted/60", on && "bg-accent hover:bg-accent")}
      onClick={(e) => {
        if (!(e.target as HTMLElement).closest("a,button") && item.p) p.play(item, list);
      }}
    >
      <PlayButton item={item} list={list} />
      <div className="min-w-0 flex-1">
        <div className={cn("leading-relaxed font-semibold", on && "text-primary")}>
          {showKind ? <KindBadge kind={item.k} /> : null}
          {item.n ? <span className="me-1.5 inline-block min-w-6 font-extrabold text-primary">{item.n}</span> : null}
          <Link href={`/l/${item.id}`} className="hover:underline">
            {item.t}
          </Link>
        </div>
        <div className="mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5 text-[13.5px] text-muted-foreground">
          {showSheikh && item.sh ? (
            <Link href={`/s/${item.sh.slug}`} className="mm-row-sh font-semibold text-primary hover:underline">
              {item.sh.name}
            </Link>
          ) : null}
          {item.h ? <span>{hijri(item.h)}</span> : null}
          {item.d ? <span className="tabular-nums">{item.d}</span> : null}
          {!item.p ? (
            <a href={p.telegramUrl(item.id)} target="_blank" rel="noopener" className="text-primary underline">
              {t("telegramOnly")}
            </a>
          ) : null}
        </div>
        <Progress item={item} />
      </div>
    </div>
  );
}

export function LessonList({
  items,
  queue,
  limit,
  showSheikh,
  showKind,
  className,
}: {
  items: Item[];
  /** Playback order (defaults to the displayed order). */
  queue?: Item[];
  limit?: number;
  showSheikh?: boolean;
  showKind?: boolean;
  className?: string;
}) {
  const t = useTranslations("common");
  const base = limit ?? items.length;
  const [shown, setShown] = useState(base);
  // A new list (e.g. after changing a filter) starts collapsed again.
  const [src, setSrc] = useState(items);
  if (src !== items) {
    setSrc(items);
    setShown(base);
  }
  const list = queue ?? items;
  return (
    <div className={cn("mm-list overflow-hidden rounded-xl border bg-card", className)}>
      {items.length ? (
        items.slice(0, shown).map((it) => <LessonRow key={it.id} item={it} list={list} showSheikh={showSheikh} showKind={showKind} />)
      ) : (
        <p className="py-10 text-center text-muted-foreground">{t("empty")}</p>
      )}
      {items.length > shown ? (
        <button className="block w-full border-t bg-muted/50 py-3 font-bold text-primary hover:bg-muted" onClick={() => setShown((s) => s + 20)}>
          {t("showMore", { count: items.length - shown })}
        </button>
      ) : null}
    </div>
  );
}

export function LessonCard({ item, list }: { item: Item; list: Item[] }) {
  const p = usePlayer();
  const t = useTranslations();
  return (
    <button
      onClick={() => p.play(item, list)}
      disabled={!item.p}
      className="mm-card mm-lesson-card flex flex-col overflow-hidden rounded-xl border bg-card text-start transition-colors hover:border-primary disabled:opacity-60"
    >
      <Cover
        pat={item.id} tone={item.sh?.tone} kind={item.k} tag={item.se?.sec || item.se?.title || t(`kind.${item.k}`)} title={item.t} byline={item.sh ? `${t("common.sheikh")} ${item.sh.name}` : undefined} />
      <div className="mm-card-body px-3.5 pt-2.5 pb-3">
        <h3 className="line-clamp-2 text-[15.5px] font-bold">
          <KindBadge kind={item.k} />
          {item.t}
        </h3>
        {item.sh ? <p className="mm-card-sub mt-0.5 text-[13.5px] text-muted-foreground">{item.sh.name}</p> : null}
      </div>
    </button>
  );
}
