"use client";

/**
 * The video of a recording on its page. YouTube, Facebook and Drive load only when the visitor
 * presses play (the page stays fast, and nothing from those sites loads before that);
 * YouTube uses its privacy mode (youtube-nocookie). Direct links and uploaded files play in the
 * browser's own video player. Starting a video pauses the site's audio player.
 */
import { ExternalLink, Play } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState, type ReactNode } from "react";
import type { Video } from "@/lib/media";
import { usePlayer } from "./player/player-provider";

/** Safari can't play GitHub's octet-stream files: those go through /api/audio (as for audio). */
const needsProxy = () =>
  /iP(hone|ad|od)/.test(navigator.userAgent) ||
  (/Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|Edg|Android|CriOS|FxiOS/.test(navigator.userAgent)) ||
  (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));

function embedUrl(v: Video) {
  switch (v.source) {
    case "youtube":
      return `https://www.youtube-nocookie.com/embed/${v.id}?autoplay=1&rel=0&playsinline=1${v.start ? `&start=${v.start}` : ""}`;
    case "facebook":
      return `https://www.facebook.com/plugins/video.php?href=${encodeURIComponent(v.url)}&show_text=false&autoplay=true`;
    case "drive":
      return `https://drive.google.com/file/d/${v.id}/preview`;
    default:
      return "";
  }
}

export function VideoPlayer({ v, id, title, poster }: { v: Video; id: number; title: string; poster?: ReactNode }) {
  const t = useTranslations("video");
  const p = usePlayer();
  const [on, setOn] = useState(false);
  const start = () => {
    p.audio.current?.pause();
    setOn(true);
  };
  const box = "mm-video relative aspect-video w-full overflow-hidden rounded-xl bg-black";

  let player: ReactNode;
  if (v.source === "file" || v.source === "link") {
    const src = v.source === "file" && on && needsProxy() ? `/api/audio/${id}.mp4` : v.url;
    player = (
      <div className={box}>
        {/* the address is set once the visitor presses play (on Safari it then goes through the site) */}
        {on ? (
          <video className="size-full" src={src} controls autoPlay playsInline preload="metadata" title={title} onPlay={() => p.audio.current?.pause()} />
        ) : (
          <Start label={t("play")} onClick={start} poster={poster} />
        )}
      </div>
    );
  } else {
    const thumb = v.source === "youtube" ? `https://i.ytimg.com/vi/${v.id}/hqdefault.jpg` : null;
    player = (
      <div className={box}>
        {on ? (
          <iframe
            className="size-full"
            src={embedUrl(v)}
            title={title}
            allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
            referrerPolicy="strict-origin-when-cross-origin"
          />
        ) : (
          <Start
            label={t("play")}
            onClick={start}
            poster={
              thumb ? (
                // eslint-disable-next-line @next/next/no-img-element -- YouTube's own thumbnail, shown as is
                <img src={thumb} alt="" className="size-full object-cover" loading="lazy" />
              ) : (
                poster
              )
            }
          />
        )}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-1.5">
      {player}
      {v.source !== "file" ? (
        <a href={v.url} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 self-start text-sm text-muted-foreground hover:text-primary">
          <ExternalLink className="size-4" />
          {t("openOn", { site: t(`site.${v.source}`) })}
        </a>
      ) : null}
    </div>
  );
}

function Start({ label, onClick, poster }: { label: string; onClick: () => void; poster?: ReactNode }) {
  return (
    <button onClick={onClick} className="group absolute inset-0 grid place-items-center" aria-label={label}>
      <span className="absolute inset-0 [&>*]:size-full">{poster}</span>
      <span className="absolute inset-0 bg-black/25 transition-colors group-hover:bg-black/35" />
      <span className="relative grid size-16 place-items-center rounded-full bg-highlight text-highlight-foreground shadow-lg transition-transform group-hover:scale-105">
        <Play className="ms-1 size-7 fill-current" />
      </span>
    </button>
  );
}
