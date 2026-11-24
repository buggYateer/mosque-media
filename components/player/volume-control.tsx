"use client";

/**
 * Volume (same behavior as the original site):
 * - Desktop (mouse): hovering shows the vertical slider; clicking the icon mutes / unmutes.
 * - Touch: tapping opens the slider, which has a mute button.
 * - Dragging works anywhere on the popover (pointer events) and never pulls the page to refresh.
 * - iOS ignores audio.volume (hardware buttons only), so the control hides itself there.
 */
import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { cn } from "@/lib/utils";
import { usePlayer } from "./player-provider";

let canSet: boolean | null = null;
function volumeSettable() {
  if (canSet === null) {
    try {
      const a = new Audio();
      a.volume = 0.5;
      canSet = a.volume === 0.5;
    } catch {
      canSet = false;
    }
  }
  return canSet;
}
const noop = () => () => {};
const fineQuery = "(hover: hover) and (pointer: fine)";

export function VolumeControl({ size = "md" }: { size?: "md" | "lg" }) {
  const t = useTranslations("player");
  const p = usePlayer();
  const supported = useSyncExternalStore(noop, volumeSettable, () => false);
  const fine = useSyncExternalStore(
    (cb) => {
      const m = matchMedia(fineQuery);
      m.addEventListener("change", cb);
      return () => m.removeEventListener("change", cb);
    },
    () => matchMedia(fineQuery).matches,
    () => false,
  );
  const [open, setOpen] = useState(false);
  const last = useRef(1);
  const pop = useRef<HTMLDivElement>(null);
  const track = useRef<HTMLDivElement>(null);
  const root = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  useEffect(() => {
    if (p.volume > 0) last.current = p.volume;
  }, [p.volume]);
  // Close when tapping elsewhere (touch mode).
  useEffect(() => {
    if (!open || fine) return;
    const close = (e: Event) => !root.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("pointerdown", close);
    return () => document.removeEventListener("pointerdown", close);
  }, [open, fine]);
  // A non-passive touchmove listener is the only way to stop pull-to-refresh while dragging.
  useEffect(() => {
    const el = pop.current;
    if (!el) return;
    const stop = (e: TouchEvent) => e.preventDefault();
    el.addEventListener("touchmove", stop, { passive: false });
    return () => el.removeEventListener("touchmove", stop);
  }, [open]);

  if (!supported) return null;
  const toggleMute = () => p.setVolume(p.volume === 0 ? last.current || 0.6 : 0);
  const at = (clientY: number) => {
    const r = track.current?.getBoundingClientRect();
    if (r) p.setVolume((r.bottom - clientY) / r.height);
  };
  const Icon = p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2;
  const pct = Math.round(p.volume * 100);

  return (
    <div
      ref={root}
      className="relative"
      onPointerEnter={() => fine && setOpen(true)}
      onPointerLeave={() => fine && !dragging.current && setOpen(false)}
      onWheel={(e) => p.setVolume(p.volume + (e.deltaY < 0 ? 0.05 : -0.05))}
    >
      <button
        type="button"
        aria-label={fine ? (p.volume === 0 ? t("unmute") : t("mute")) : t("volume")}
        aria-expanded={fine ? undefined : open}
        title={t("volume")}
        className={cn("grid shrink-0 place-items-center rounded-full hover:bg-muted", size === "lg" ? "size-[42px]" : "size-10")}
        onClick={() => (fine ? toggleMute() : setOpen((o) => !o))}
      >
        <Icon className={size === "lg" ? "size-[26px]" : "size-5"} />
      </button>
      {open ? (
        <div
          ref={pop}
          role="group"
          aria-label={t("volume")}
          className="absolute bottom-full left-1/2 z-50 flex -translate-x-1/2 touch-none flex-col items-center gap-2 rounded-xl border bg-popover px-2.5 pt-2.5 pb-2 shadow-lg select-none"
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("[data-mute]")) return;
            e.preventDefault();
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            at(e.clientY);
          }}
          onPointerMove={(e) => dragging.current && at(e.clientY)}
          onPointerUp={() => (dragging.current = false)}
          onPointerCancel={() => (dragging.current = false)}
        >
          <span className="text-xs font-bold tabular-nums">{pct}</span>
          <div
            ref={track}
            role="slider"
            tabIndex={0}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct}
            aria-label={t("volume")}
            onKeyDown={(e) => {
              if (e.key === "ArrowUp" || e.key === "ArrowRight") p.setVolume(p.volume + 0.05);
              if (e.key === "ArrowDown" || e.key === "ArrowLeft") p.setVolume(p.volume - 0.05);
            }}
            className="relative h-32 w-2 cursor-pointer rounded-full bg-border outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="absolute inset-x-0 bottom-0 rounded-full bg-primary" style={{ height: `${pct}%` }} />
            <div className="absolute left-1/2 size-4 -translate-x-1/2 translate-y-1/2 rounded-full border-2 border-background bg-primary shadow" style={{ bottom: `${pct}%` }} />
          </div>
          {!fine ? (
            <button type="button" data-mute className="grid size-9 place-items-center rounded-full hover:bg-muted" aria-label={p.volume === 0 ? t("unmute") : t("mute")} onClick={toggleMute}>
              {p.volume === 0 ? <Volume2 className="size-5" /> : <VolumeX className="size-5" />}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
