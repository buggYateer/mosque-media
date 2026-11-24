"use client";

import { ChevronDown, Download, Pause, Play, RotateCcw, RotateCw, Send, SkipBack, SkipForward, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Link } from "@/i18n/navigation";
import { fmtTime } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Cover, KIND_ICON, toneBg } from "../cover";
import { ShareButton } from "../share-button";
import { MiniMenu } from "../mini-menu";
import { SPEEDS, usePlayer } from "./player-provider";
import { VolumeControl } from "./volume-control";

function useTime(audio: HTMLAudioElement | null) {
  const [t, setT] = useState({ cur: 0, dur: 0 });
  useEffect(() => {
    if (!audio) return;
    const up = () => setT({ cur: audio.currentTime, dur: audio.duration || 0 });
    audio.addEventListener("timeupdate", up);
    audio.addEventListener("loadedmetadata", up);
    audio.addEventListener("emptied", up);
    return () => {
      audio.removeEventListener("timeupdate", up);
      audio.removeEventListener("loadedmetadata", up);
      audio.removeEventListener("emptied", up);
    };
  }, [audio]);
  return t;
}

const iconBtn = "grid size-10 shrink-0 place-items-center rounded-full text-foreground hover:bg-muted disabled:opacity-40";

export function PlayerBar() {
  const p = usePlayer();
  const t = useTranslations();
  const { cur, dur } = useTime(p.audio.current);
  if (!p.current) return null;
  const L = p.current;
  const Icon = KIND_ICON[L.k];
  const pct = dur ? (cur / dur) * 100 : 0;
  const ex = p.expanded;

  const speed = (
    <MiniMenu
      label={t("player.speed")}
      side="top"
      align="center"
      className="min-w-24"
      triggerClass="h-8 rounded-full border px-2.5 text-[13px] font-bold tabular-nums hover:bg-muted"
      trigger={<>{p.speed}×</>}
      items={SPEEDS.map((s) => ({ key: String(s), checked: s === p.speed, label: <span className="tabular-nums">{s}×</span>, onSelect: () => p.setSpeed(s) }))}
    />
  );

  /** Speed + volume: next to the play controls. */
  const knobs = (
    <div className="flex items-center gap-3">
      <VolumeControl size={ex ? "md" : "lg"} />
      {speed}
    </div>
  );

  /** Share, download, Telegram, close: at the side. */
  const acts = (
    <div className="flex items-center gap-0.5">
      <ShareButton path={`/l/${L.id}`} title={L.t} variant="icon" className={cn(!ex && "max-md:hidden")} />
      <a href={p.downloadUrl(L.id)} className={cn(iconBtn, !ex && "max-md:hidden")} aria-label={t("common.download")} title={t("common.download")}>
        <Download className="size-5" />
      </a>
      <a href={p.telegramUrl(L.id)} target="_blank" rel="noopener" className={iconBtn} aria-label={t("player.openTelegram")} title={t("player.openTelegram")}>
        <Send className="size-5 rtl:-scale-x-100" />
      </a>
      {!ex && (
        <button className={iconBtn} onClick={p.close} aria-label={t("player.close")}>
          <X className="size-5" />
        </button>
      )}
    </div>
  );

  const seek = (
    <div dir="ltr" className="flex items-center gap-3 text-xs text-muted-foreground tabular-nums">
      <span className="w-10 text-end">{fmtTime(cur)}</span>
      <input
        type="range"
        min={0}
        max={1000}
        value={Math.round(pct * 10)}
        aria-label={t("player.seek")}
        onChange={(e) => p.seekTo(Number(e.target.value) / 1000)}
        className="h-1.5 flex-1 cursor-pointer appearance-none rounded-full accent-primary"
        style={{ background: `linear-gradient(to right, var(--primary) ${pct}%, var(--border) ${pct}%)` }}
      />
      <span className="w-10">{fmtTime(dur)}</span>
    </div>
  );

  const controls = (
    <div dir="ltr" className={cn("flex items-center justify-center", ex ? "gap-3" : "gap-1.5")}>
      <button className={iconBtn} onClick={() => p.step(-1)} disabled={p.index <= 0} aria-label={t("player.prev")}>
        <SkipBack className="size-5 fill-current" />
      </button>
      <button className={cn(iconBtn, "relative")} onClick={() => p.seekBy(-10)} aria-label={t("player.back10")}>
        <RotateCcw className="size-6" />
        <span className="absolute text-[9px] font-bold">10</span>
      </button>
      <button
        className={cn("grid shrink-0 place-items-center rounded-full bg-primary text-primary-foreground hover:bg-primary/90", ex ? "size-16" : "size-12")}
        onClick={p.toggle}
        aria-label={p.playing ? t("player.pause") : t("player.play")}
      >
        {p.playing ? <Pause className={cn("fill-current", ex ? "size-8" : "size-6")} /> : <Play className={cn("fill-current", ex ? "size-8" : "size-6")} />}
      </button>
      <button className={cn(iconBtn, "relative")} onClick={() => p.seekBy(10)} aria-label={t("player.fwd10")}>
        <RotateCw className="size-6" />
        <span className="absolute text-[9px] font-bold">10</span>
      </button>
      <button className={iconBtn} onClick={() => p.step(1)} disabled={p.index >= p.queue.length - 1} aria-label={t("player.next")}>
        <SkipForward className="size-5 fill-current" />
      </button>
    </div>
  );

  const sub = p.error ? (
    <span className="text-destructive">{t("player.unavailable")}</span>
  ) : L.sh ? (
    <>
      <Link href={`/s/${L.sh.slug}`} className="text-primary hover:underline" onClick={() => ex && p.setExpanded(false)}>
        {t("common.sheikh")} {L.sh.name}
      </Link>
      {L.se ? (
        <>
          {" — "}
          <Link href={`/s/${L.sh.slug}/${L.se.key}`} className="text-primary hover:underline" onClick={() => ex && p.setExpanded(false)}>
            {L.se.title}
          </Link>
        </>
      ) : null}
    </>
  ) : (
    p.siteName
  );

  if (ex)
    return (
      <div role="dialog" aria-label={t("player.nowPlaying")} className="mm-player mm-player-full fixed inset-0 z-40 overflow-y-auto bg-background">
        <div className="mx-auto flex min-h-full max-w-lg flex-col justify-center gap-6 px-5 pt-20 pb-8">
          <div className="absolute inset-x-4 top-3 flex items-center gap-2 text-sm font-semibold text-muted-foreground">
            <button className="grid size-11 place-items-center rounded-full bg-muted text-foreground" onClick={() => p.setExpanded(false)} aria-label={t("player.minimize")}>
              <ChevronDown className="size-6" />
            </button>
            {t("player.nowPlaying")}
          </div>
          <Cover pat={L.id} tone={L.sh?.tone} kind={L.k} tag={L.se?.sec || L.se?.title || t(`kind.${L.k}`)} title={L.t} byline={L.sh ? `${t("common.sheikh")} ${L.sh.name}` : undefined} className="rounded-xl shadow-lg" />
          <div className="text-center">
            <h2 className="text-2xl font-extrabold leading-snug">
              {L.n ? `${L.n}. ` : ""}
              {L.t}
            </h2>
            <p className="mt-1 text-sm">{sub}</p>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {knobs}
            {acts}
          </div>
          {seek}
          {controls}
        </div>
      </div>
    );

  return (
    <div className="mm-player mm-player-mini fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 shadow-[0_-4px_20px_rgb(0_0_0/0.08)] backdrop-blur">
      {/* Desktop: info · knobs · controls+seek · actions — knobs and actions line up with the controls row (48px). */}
      <div className="mx-auto grid max-w-6xl gap-2 px-3 py-2.5 md:grid-cols-[minmax(0,1fr)_auto_minmax(340px,520px)_minmax(0,1fr)] md:items-center md:gap-4 md:px-4">
        <div className="flex min-w-0 items-center gap-1">
        <button className="flex min-w-0 flex-1 items-center gap-3 text-start" onClick={() => p.setExpanded(true)} aria-label={t("player.expand")}>
          <span className={cn("grid size-11 shrink-0 place-items-center rounded-md text-white", toneBg(L.sh?.tone))}>
            <Icon className="size-5" />
          </span>
          <span className="min-w-0">
            <span className="block truncate font-bold">
              {L.n ? `${L.n}. ` : ""}
              {L.t}
            </span>
            <span className="block truncate text-[13px] text-muted-foreground">{p.error ? t("player.unavailable") : L.sh ? `${t("common.sheikh")} ${L.sh.name}` : p.siteName}</span>
          </span>
        </button>
          <div className="md:hidden">{knobs}</div>
          <button className={cn(iconBtn, "md:hidden")} onClick={p.close} aria-label={t("player.close")}>
            <X className="size-5" />
          </button>
        </div>
        <div className="hidden h-12 self-start md:flex">{knobs}</div>
        <div className="flex flex-col-reverse gap-1 md:flex-col md:gap-2">
          {controls}
          {seek}
        </div>
        <div className="hidden h-12 self-start justify-end md:flex">{acts}</div>
      </div>
    </div>
  );
}
