"use client";

import { Volume1, Volume2, VolumeX } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "../ui/popover";
import { usePlayer } from "./player-provider";

/** iOS ignores audio.volume (hardware buttons only), so the control hides itself there. */
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

/** Volume button with a vertical slider (up = louder). The level is remembered on this device. */
export function VolumeControl() {
  const t = useTranslations("player");
  const p = usePlayer();
  const supported = useSyncExternalStore(
    () => () => {},
    volumeSettable,
    () => false,
  );
  if (!supported) return null;
  const Icon = p.volume === 0 ? VolumeX : p.volume < 0.5 ? Volume1 : Volume2;
  return (
    <Popover>
      <PopoverTrigger aria-label={t("volume")} title={t("volume")} className="grid size-10 shrink-0 place-items-center rounded-full hover:bg-muted">
        <Icon className="size-5" />
      </PopoverTrigger>
      <PopoverContent side="top" className="flex w-14 flex-col items-center gap-2 px-2 py-3">
        <span className="text-xs font-bold tabular-nums">{Math.round(p.volume * 100)}</span>
        <input
          type="range"
          min={0}
          max={100}
          value={Math.round(p.volume * 100)}
          aria-label={t("volume")}
          aria-orientation="vertical"
          onChange={(e) => p.setVolume(Number(e.target.value) / 100)}
          onWheel={(e) => p.setVolume(p.volume + (e.deltaY < 0 ? 0.05 : -0.05))}
          className="h-32 w-6 cursor-pointer accent-primary [direction:rtl] [writing-mode:vertical-lr]"
        />
      </PopoverContent>
    </Popover>
  );
}
