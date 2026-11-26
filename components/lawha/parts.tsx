"use client";

/** Pieces shared by the dashboard's screens: types, small layout helpers, date / media / file fields. */
import { CloudUpload, X } from "lucide-react";
import type { useTranslations } from "next-intl";
import { useState } from "react";
import { gregorianToHijri, hijriToGregorian, parseGregorian, parseHijri, toHijriText, toIso } from "@/lib/dates";
import { extOf, isAudioLink, parseVideo } from "@/lib/media";
import { CALENDAR, VIDEO_SOURCES_ON } from "@/lib/site-shared";
import type { Lesson, Overrides } from "@/lib/storage/types";
import { cn } from "@/lib/utils";

export type State = {
  channel: string;
  storage: { data: string; audio: string };
  uploads: boolean;
  maxVideoMB: number;
  lessons: Record<string, Lesson>;
  sheikhs: { key: string; name: string; series: { key: string; title: string; sections: string[]; ids: number[] }[] }[];
  seriesOf: Record<string, string>;
  overrides: Overrides;
};
export type Eff = Lesson & { series: string; hidden: boolean; isNew: boolean; edited: boolean };

/** A file being uploaded to Vercel Blob as soon as it is picked; publishing waits for it. */
export type Job = { key: string; id: number; kind: "audio" | "video"; file: File; ext: string; pct: number; url?: string; err?: string };
export const jobKey = (id: number | string, kind: Job["kind"]) => `${id}:${kind}`;

export type Tab = "status" | "list" | "add" | "series" | "featured" | "settings";
export type Ctx = {
  t: ReturnType<typeof useTranslations<"lawha">>;
  tk: ReturnType<typeof useTranslations<"kind">>;
  data: State;
  ov: Overrides;
  setOv: (fn: (o: Overrides) => Overrides) => void;
  /** the edits as last published (to list and undo what's new) */
  orig: Overrides;
  publish: () => void;
  busy: string;
  jobs: Record<string, Job>;
  addJob: (id: number, kind: Job["kind"], file: File) => void;
  removeJob: (key: string) => void;
  retryJob: (key: string) => void;
  eff: (id: number) => Eff;
  allIds: number[];
  shName: (k: string) => string;
  seriesOpts: (readonly [string, string])[];
  locale: string;
  setTab: (t: Tab) => void;
  /** after saving the settings: sheikhs the add list doesn't know yet */
  addSheikhs: (list: { key: string; name: string }[]) => void;
};

export const field = "flex flex-col gap-1.5 text-sm font-semibold text-muted-foreground";
export const control = "h-10 w-full rounded-lg border bg-background px-3 text-foreground";

function fmtDur(sec: number) {
  const s = Math.round(sec);
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
/** The length of an audio or video file («47:59»), or "" when the browser can't read it. */
export const durationOf = (file: File) =>
  new Promise<string>((res) => {
    const a = document.createElement(file.type.startsWith("video") ? "video" : "audio");
    a.preload = "metadata";
    const done = (v: string) => {
      res(v);
      URL.revokeObjectURL(a.src);
    };
    a.onloadedmetadata = () => done(Number.isFinite(a.duration) ? fmtDur(a.duration) : "");
    a.onerror = () => done("");
    setTimeout(() => done(""), 8000);
    a.src = URL.createObjectURL(file);
  });

export const Row = ({ id, title, sub, children, onClick }: { id: number | string; title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; onClick?: () => void }) => (
  <div className={cn("flex items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0", onClick && "cursor-pointer hover:bg-muted/60")} onClick={onClick}>
    <span className="min-w-12 rounded-md bg-muted px-1.5 py-0.5 text-center text-xs font-bold text-muted-foreground tabular-nums">{id}</span>
    <div className="min-w-0 flex-1">
      <b className="block truncate font-semibold">{title}</b>
      {sub ? <small className="block truncate text-muted-foreground">{sub}</small> : null}
    </div>
    {children ? <div className="flex shrink-0 items-center gap-1.5">{children}</div> : null}
  </div>
);
export const Card = ({ children }: { children: React.ReactNode }) => <div className="overflow-hidden rounded-xl border bg-card">{children}</div>;
export const H2 = ({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) => (
  <div className="mt-7 mb-2 flex items-center gap-2">
    <h2 className="text-lg font-extrabold">{children}</h2>
    <span className="flex-1" />
    {extra}
  </div>
);

/**
 * The date of a recording, in the calendar the mosque chose (site.config.json → dates).
 * Both dates are kept in step, so switching the calendar later still has every date.
 */
export function DateField({ t, h, g, onChange }: { t: Ctx["t"]; h: string; g: string; onChange: (d: { h: string; g: string }) => void }) {
  if (CALENDAR === "none") return null;
  const gValue = g || (parseHijri(h) ? toIso(hijriToGregorian(parseHijri(h)!)) : "");
  const setG = (x: string) => {
    const p = parseGregorian(x);
    onChange({ g: x, h: p ? toHijriText(gregorianToHijri(p)) : h });
  };
  const setH = (x: string) => {
    const p = parseHijri(x);
    onChange({ h: x, g: p ? toIso(hijriToGregorian(p)) : g });
  };
  const hijri = (
    <label className={field}>
      {t("fieldDate")}
      <input className={control} value={h} inputMode="numeric" placeholder="7-6-1448" onChange={(e) => setH(e.target.value)} />
    </label>
  );
  const greg = (
    <label className={field}>
      {t("fieldDateG")}
      <input className={control} type="date" value={gValue} onChange={(e) => setG(e.target.value)} />
    </label>
  );
  if (CALENDAR === "gregorian") return greg;
  if (CALENDAR === "both")
    return (
      <>
        {greg}
        {hijri}
      </>
    );
  return hijri;
}

/** What's wrong with a video / audio link, or "" when both are fine (or empty). */
export function mediaError(t: Ctx["t"], vid: string, au: string) {
  if (vid.trim() && vid !== "file") {
    const v = parseVideo(vid.trim(), "x");
    if (!v || v.source === "file") return t("badLink");
    if (!VIDEO_SOURCES_ON.includes(v.source)) return t("sourceOff", { site: t(`sourceName.${v.source}`) });
  }
  if (au.trim() && !isAudioLink(au.trim())) return t("badLink");
  return "";
}

/** One video-link field that says what it recognized (YouTube, Drive…) or what's wrong. */
export function VideoLinkField({ t, value, onChange, autoFocus }: { t: Ctx["t"]; value: string; onChange: (v: string) => void; autoFocus?: boolean }) {
  const v = value.trim() && value !== "file" ? parseVideo(value.trim(), "x") : null;
  const ok = !!v && VIDEO_SOURCES_ON.includes(v.source);
  const note = !value.trim() || value === "file" ? "" : ok ? t("videoFound", { site: t(`sourceName.${v!.source}`) }) : mediaError(t, value, "");
  return (
    <label className={field}>
      {t("fieldVideo")}
      <input className={control} dir="ltr" inputMode="url" autoFocus={autoFocus} placeholder="https://youtu.be/…" value={value === "file" ? "" : value} onChange={(e) => onChange(e.target.value)} />
      {note ? <small className={cn("font-normal", ok ? "text-primary" : "text-destructive")}>{note}</small> : null}
    </label>
  );
}

/** A video link and an outside audio link (the edit dialog). */
export function MediaFields({ t, vid, au, onChange }: { t: Ctx["t"]; vid: string; au: string; onChange: (m: { vid: string; au: string }) => void }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <VideoLinkField t={t} value={vid} onChange={(x) => onChange({ vid: x, au })} />
      <label className={field}>
        {t("fieldAudioLink")}
        <input className={control} dir="ltr" inputMode="url" placeholder="https://…/lesson.mp3" value={au} onChange={(e) => onChange({ vid, au: e.target.value })} />
      </label>
    </div>
  );
}

/**
 * Pick a file by tapping, or drag it in. `exts` = the allowed extensions, `maxMB` = the size limit;
 * `onPick` gets only a file that passes both (otherwise the reason shows under the box).
 */
export function Dropzone({
  t,
  file,
  onPick,
  onClear,
  exts,
  mime,
  maxMB,
  label,
  hint,
}: {
  t: Ctx["t"];
  file?: File;
  onPick: (f: File) => void;
  /** shows a «remove file» button once a file is picked */
  onClear?: () => void;
  exts: string[];
  mime: "audio/*" | "video/*";
  maxMB: number;
  label: string;
  hint: string;
}) {
  const [over, setOver] = useState(false);
  const [err, setErr] = useState("");
  const take = (f?: File | null) => {
    if (!f) return;
    if (!exts.includes(extOf(f.name))) return setErr(t("wiz.badType", { types: exts.join("، ") }));
    if (f.size > maxMB * 1024 * 1024) return setErr(t("wiz.tooBig", { max: maxMB }));
    setErr("");
    onPick(f);
  };
  return (
    <div className="flex flex-col gap-1">
      <label
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setOver(false);
          take(e.dataTransfer.files?.[0]);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-6 text-center transition-colors hover:bg-muted/50",
          (file || over) && "border-primary bg-accent",
        )}
      >
        <CloudUpload className="size-8 text-primary" />
        <b className="[overflow-wrap:anywhere]">{file ? `${file.name} — ${(file.size / 1e6).toFixed(1)} MB` : label}</b>
        <small className="text-muted-foreground">{hint}</small>
        <input type="file" accept={[mime, ...exts.map((x) => `.${x}`)].join(",")} className="hidden" onChange={(e) => take(e.target.files?.[0])} />
      </label>
      {file && onClear ? (
        <button type="button" onClick={onClear} className="inline-flex items-center gap-1 self-start text-sm text-muted-foreground hover:text-destructive">
          <X className="size-4" />
          {t("wiz.clearFile")}
        </button>
      ) : null}
      {err ? <small className="text-destructive">{err}</small> : null}
    </div>
  );
}
