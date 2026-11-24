"use client";

import { Download, Pause, Play, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import type { Item } from "@/lib/library";
import { usePlayer } from "./player/player-provider";
import { ShareButton } from "./share-button";

/** Download every part of a recording (multi-part clips download one after the other). */
export function downloadAll(item: Item, url: (id: number, part?: number) => string) {
  for (let k = 1; k <= item.p; k++)
    setTimeout(
      () => {
        const a = document.createElement("a");
        a.href = url(item.id, k);
        a.download = "";
        document.body.appendChild(a);
        a.click();
        a.remove();
      },
      (k - 1) * 900,
    );
}

export function LessonActions({ item }: { item: Item }) {
  const p = usePlayer();
  const t = useTranslations("common");
  const playing = p.current?.id === item.id && p.playing;
  const btn = "inline-flex h-11 items-center gap-2 rounded-lg border bg-card px-4 font-semibold hover:bg-muted";
  return (
    <div className="mt-5 flex flex-wrap gap-2">
      {item.p ? (
        <>
          <button onClick={() => p.play(item, [item])} className="inline-flex h-11 items-center gap-2 rounded-lg bg-highlight px-5 font-extrabold text-highlight-foreground hover:bg-highlight/90">
            {playing ? <Pause className="size-5 fill-current" /> : <Play className="size-5 fill-current rtl:-scale-x-100" />}
            {t("listen")}
          </button>
          <a
            href={p.downloadUrl(item.id)}
            className={btn}
            onClick={(e) => {
              if (item.p > 1) {
                e.preventDefault();
                downloadAll(item, p.downloadUrl);
              }
            }}
          >
            <Download className="size-5 text-primary" />
            {t("download")}
          </a>
        </>
      ) : null}
      <ShareButton path={`/l/${item.id}`} title={item.t} className="h-11 px-4" />
      <a href={p.telegramUrl(item.id)} target="_blank" rel="noopener" className={btn}>
        <Send className="size-5 text-primary rtl:-scale-x-100" />
        {t("telegram")}
      </a>
    </div>
  );
}
