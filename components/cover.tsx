import { BookOpen } from "lucide-react";
import { TypeIcon } from "./icons";
import type { Kind } from "@/lib/storage/types";
import { cn } from "@/lib/utils";

/** Literal class names so Tailwind generates them. */
export const TONE_BG = ["bg-tone-1", "bg-tone-2", "bg-tone-3", "bg-tone-4", "bg-tone-5", "bg-tone-6"];
export const toneBg = (tone = 1) => TONE_BG[(tone - 1) % TONE_BG.length];


/**
 * A cover drawn in code (no image files): the sheikh's color, an icon, a small tag and the title.
 * Deliberately plain — each mosque can restyle it in this one file.
 */
export function Cover({
  tone,
  pat = 0,
  kind,
  tag,
  title,
  byline,
  className,
}: {
  tone?: number;
  /** Any number (e.g. the recording id) — picks one of 5 pattern slots a theme can style via [data-pat]. */
  pat?: number;
  kind?: Kind | "series";
  tag?: string;
  title: string;
  byline?: string;
  className?: string;
}) {
  return (
    <div aria-hidden data-tone={tone ?? 1} data-pat={Math.abs(pat) % 5} className={cn("mm-cover @container relative flex aspect-video items-end overflow-hidden p-4 text-white", toneBg(tone), className)}>
      {kind === "series" ? <BookOpen className="mm-cover-icon absolute top-3 end-3 size-8 opacity-55" /> : <TypeIcon kind={kind ?? ""} className="mm-cover-icon absolute top-3 end-3 size-8 opacity-55" />}
      {/* Empty by default; a theme can show the mosque logo here. */}
      <span className="mm-cover-logo" />
      <div className="mm-cover-text flex max-w-[88%] flex-col leading-snug">
        {tag ? <small className="text-[12.5px] opacity-80">{tag}</small> : null}
        <b className="line-clamp-2 text-[clamp(15px,8cqw,22px)] font-extrabold">{title}</b>
        {byline ? <i className="text-[13px] not-italic opacity-85">{byline}</i> : null}
      </div>
    </div>
  );
}
