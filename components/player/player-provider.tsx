"use client";

/**
 * The one audio player of the site. It lives in the root layout, so audio keeps
 * playing while the visitor navigates between pages.
 * Features (parity with the original site): queue with next/previous, resume
 * position per recording, multi-part recordings, playback speed, lock-screen
 * controls (Media Session), expanded view that the Back button minimizes.
 */
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { Item } from "@/lib/library";
import { SITE_ID_START } from "@/lib/site-shared";
import { readStored, useStored, writeStored } from "@/lib/use-stored";

export const SPEEDS = [0.75, 1, 1.25, 1.5, 1.75, 2];

export const savedPosition = (id: number) => Number(readStored(`pos:${id}`) ?? 0) || 0;
const savePosition = (id: number, sec: number) => writeStored(`pos:${id}`, String(sec));

type PlayerState = {
  current: Item | null;
  queue: Item[];
  index: number;
  part: number;
  playing: boolean;
  expanded: boolean;
  error: boolean;
};

type PlayerApi = PlayerState & {
  speed: number;
  /** 0–1, saved on this device. */
  volume: number;
  setVolume: (v: number) => void;
  audio: React.RefObject<HTMLAudioElement | null>;
  play: (item: Item, list?: Item[]) => void;
  toggle: () => void;
  step: (d: 1 | -1) => void;
  seekBy: (s: number) => void;
  seekTo: (fraction: number) => void;
  setSpeed: (s: number) => void;
  setExpanded: (on: boolean) => void;
  close: () => void;
  audioUrl: (id: number, part: number, parts: number) => string;
  /** The clip's Telegram post, or "" when there is no channel or the clip was added on the site. */
  telegramUrl: (id: number) => string;
  downloadUrl: (id: number, part?: number) => string;
  siteName: string;
};

const Ctx = createContext<PlayerApi | null>(null);

export function usePlayer() {
  const c = useContext(Ctx);
  if (!c) throw new Error("usePlayer must be used inside <PlayerProvider>");
  return c;
}

export function PlayerProvider({ children, audioBase, channel, siteName, logo }: { children: ReactNode; audioBase: string; channel: string; siteName: string; logo: string }) {
  const audio = useRef<HTMLAudioElement | null>(null);
  const [s, set] = useState<PlayerState>({ current: null, queue: [], index: -1, part: 1, playing: false, expanded: false, error: false });
  const [speedStr, setSpeedStr] = useStored("speed", "1");
  const speed = Number(speedStr) || 1;
  const [volStr, setVolStr] = useStored("vol", "1");
  const volume = Math.min(1, Math.max(0, Number(volStr)));
  useEffect(() => {
    if (audio.current) audio.current.volume = volume;
  }, [volume]);
  const setVolume = useCallback((v: number) => setVolStr(String(Math.min(1, Math.max(0, Math.round(v * 100) / 100)))), [setVolStr]);
  const ref = useRef(s);
  useEffect(() => {
    ref.current = s;
  });

  const audioUrl = useCallback(
    (id: number, part: number, parts: number) => {
      const file = parts > 1 ? `${id}_${part}.mp3` : `${id}.mp3`;
      if (audioBase.startsWith("/")) return `${audioBase}/${file}`;
      // Safari (every iPhone browser) won't play GitHub's octet-stream files, so it goes through /api/audio
      if (/iP(hone|ad|od)/.test(navigator.userAgent) || (/Safari\//.test(navigator.userAgent) && !/Chrome|Chromium|Edg|Android|CriOS|FxiOS/.test(navigator.userAgent)) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent)))
        return `/api/audio/${file}`;
      return `${audioBase}/audio-${Math.floor(id / 500)}/${file}`;
    },
    [audioBase],
  );

  const savePos = useCallback(() => {
    const a = audio.current,
      cur = ref.current.current;
    if (a && cur && ref.current.part === 1 && a.currentTime > 5) savePosition(cur.id, Math.floor(a.currentTime));
  }, []);

  const load = useCallback(
    (item: Item, queue: Item[], index: number, part = 1) => {
      const a = audio.current;
      if (!a) return;
      savePos();
      a.src = audioUrl(item.id, part, item.p);
      a.playbackRate = Number(readStored("speed") ?? 1) || 1;
      if (part === 1) {
        const resume = savedPosition(item.id);
        a.addEventListener(
          "loadedmetadata",
          () => {
            if (resume > 5 && resume < a.duration - 10) a.currentTime = resume;
          },
          { once: true },
        );
      }
      a.play().catch(() => {});
      const next = { ...ref.current, current: item, queue, index, part, error: false };
      ref.current = next;
      set(next);
    },
    [audioUrl, savePos],
  );

  const play = useCallback(
    (item: Item, list?: Item[]) => {
      if (!item.p) return;
      const cur = ref.current;
      if (cur.current?.id === item.id) {
        const a = audio.current;
        if (a) (a.paused ? a.play() : a.pause())?.catch?.(() => {});
        return;
      }
      const queue = (list ?? [item]).filter((x) => x.p);
      load(item, queue, Math.max(0, queue.findIndex((x) => x.id === item.id)));
    },
    [load],
  );

  const step = useCallback(
    (d: 1 | -1) => {
      const { queue, index } = ref.current;
      const i = index + d;
      if (i >= 0 && i < queue.length) load(queue[i], queue, i);
    },
    [load],
  );

  const toggle = useCallback(() => {
    const a = audio.current;
    if (a?.src) (a.paused ? a.play() : (a.pause(), undefined))?.catch?.(() => {});
  }, []);

  const seekBy = useCallback((sec: number) => {
    const a = audio.current;
    if (a) a.currentTime = Math.max(0, Math.min(a.duration || 0, a.currentTime + sec));
  }, []);

  const seekTo = useCallback((fraction: number) => {
    const a = audio.current;
    if (a?.duration) a.currentTime = fraction * a.duration;
  }, []);

  const setSpeed = useCallback(
    (v: number) => {
      if (audio.current) audio.current.playbackRate = v;
      setSpeedStr(String(v));
    },
    [setSpeedStr],
  );

  // Expanded view takes one step in history, so the Back button minimizes it first.
  const setExpanded = useCallback((on: boolean) => {
    const was = ref.current.expanded;
    if (on && !was) history.pushState({ pl: 1 }, "", location.href);
    if (!on && was && history.state?.pl) {
      history.back();
      return;
    }
    set((p) => ({ ...p, expanded: on }));
  }, []);

  const close = useCallback(() => {
    savePos();
    const a = audio.current;
    if (a) {
      a.pause();
      a.removeAttribute("src");
      a.load();
    }
    if (ref.current.expanded && history.state?.pl) history.back();
    set((p) => ({ ...p, current: null, queue: [], index: -1, playing: false, expanded: false }));
  }, [savePos]);

  useEffect(() => {
    const onPop = () => set((p) => (p.expanded ? { ...p, expanded: false } : p));
    addEventListener("popstate", onPop);
    addEventListener("pagehide", savePos);
    return () => {
      removeEventListener("popstate", onPop);
      removeEventListener("pagehide", savePos);
    };
  }, [savePos]);

  const { current, expanded } = s;
  useEffect(() => {
    document.body.classList.toggle("has-player", !!current);
    document.body.style.overflow = expanded ? "hidden" : "";
  }, [current, expanded]);

  // Lock-screen / headphones controls
  useEffect(() => {
    if (!("mediaSession" in navigator) || !current) return;
    navigator.mediaSession.metadata = new MediaMetadata({
      title: current.t,
      artist: current.sh?.name ?? "",
      album: siteName,
      artwork: [{ src: logo, sizes: "512x512", type: "image/png" }],
    });
    navigator.mediaSession.setActionHandler("nexttrack", () => step(1));
    navigator.mediaSession.setActionHandler("previoustrack", () => step(-1));
    navigator.mediaSession.setActionHandler("seekbackward", () => seekBy(-10));
    navigator.mediaSession.setActionHandler("seekforward", () => seekBy(10));
  }, [current, siteName, logo, step, seekBy]);

  const api = useMemo<PlayerApi>(
    () => ({
      ...s,
      speed,
      volume,
      setVolume,
      audio,
      play,
      toggle,
      step,
      seekBy,
      seekTo,
      setSpeed,
      setExpanded,
      close,
      audioUrl,
      telegramUrl: (id) => (channel && id < SITE_ID_START ? `https://t.me/${channel}/${id}` : ""),
      downloadUrl: (id, part) => `/api/dl?id=${id}${part && part > 1 ? `&p=${part}` : ""}`,
      siteName,
    }),
    [s, speed, volume, setVolume, play, toggle, step, seekBy, seekTo, setSpeed, setExpanded, close, audioUrl, channel, siteName],
  );

  return (
    <Ctx.Provider value={api}>
      {children}
      <audio
        ref={audio}
        preload="metadata"
        onPlay={() => set((p) => ({ ...p, playing: true }))}
        onPause={() => {
          set((p) => ({ ...p, playing: false }));
          savePos();
        }}
        onTimeUpdate={(e) => {
          if (Math.floor(e.currentTarget.currentTime) % 10 === 0) savePos();
        }}
        onError={() => {
          if (ref.current.current) set((p) => ({ ...p, error: true, playing: false }));
        }}
        onEnded={() => {
          const { current, queue, index, part } = ref.current;
          if (!current) return;
          if (part < current.p) return load(current, queue, index, part + 1);
          savePosition(current.id, 0);
          step(1);
        }}
      />
    </Ctx.Provider>
  );
}
