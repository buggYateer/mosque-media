"use client";

/**
 * Adding a recording, in three steps:
 *   1. what: an audio file / a video link / a video file / audio + video
 *   2. the file(s) or the link (+ its Telegram post, if it has one)
 *   3. details (title, sheikh, type, date, series — or a new series) with a preview
 * A picked file starts uploading right away (shown below with its progress); «Publish» waits for it.
 */
import { ArrowLeft, ArrowRight, AudioLines, CirclePlus, Clapperboard, Link2, RotateCw, Trash2, Video } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useState } from "react";
import { toast } from "sonner";
import { Cover } from "@/components/cover";
import { dateText, today } from "@/lib/dates";
import { AUDIO_EXT, AUDIO_MAX_MB, isAudioLink, parseVideo, VIDEO_EXT } from "@/lib/media";
import { DEFAULT_TYPE, SITE_ID_START, TYPE_KEYS, VIDEO_SOURCES_ON } from "@/lib/site-shared";
import type { Kind } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, control, type Ctx, DateField, Dropzone, durationOf, field, H2, mediaError, Row, VideoLinkField } from "./parts";

type What = "audio" | "videoLink" | "videoFile" | "both";
const NEW_SERIES = "__new";

/** «https://t.me/channel/640» or «640» → 640 (only posts of this site's channel). */
function telegramId(s: string, channel: string): number | null {
  const x = s.trim();
  if (/^\d{1,6}$/.test(x)) return Number(x);
  const m = /^(?:https?:\/\/)?t\.me\/(?:s\/)?([\w]+)\/(\d{1,6})/i.exec(x);
  return m && channel && m[1].toLowerCase() === channel.toLowerCase() ? Number(m[2]) : null;
}

export function AddWizard(c: Ctx) {
  const { t, data, ov, setOv, addJob } = c;
  const tc = useTranslations("common");
  const locale = useLocale();
  const [prefill] = useState(() => {
    try {
      const v = sessionStorage.getItem("lawha:add") ?? "";
      sessionStorage.removeItem("lawha:add");
      return v;
    } catch {
      return "";
    }
  });
  const fresh = () => ({ k: DEFAULT_TYPE as Kind, t: "", s: data.sheikhs[0]?.key ?? "", ...today(), series: "", newSeries: "" });
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [what, setWhat] = useState<What>("audio");
  const [audio, setAudio] = useState<File>();
  const [video, setVideo] = useState<File>();
  const [au, setAu] = useState("");
  const [vid, setVid] = useState("");
  const [tg, setTg] = useState(prefill);
  const [dur, setDur] = useState("");
  const [v, setV] = useState(fresh);
  const [err, setErr] = useState("");

  const linksOk = VIDEO_SOURCES_ON.some((s) => s !== "file");
  const filesOk = data.uploads;
  const choices: { key: What; icon: typeof AudioLines; on: boolean }[] = [
    { key: "audio", icon: AudioLines, on: true },
    { key: "videoLink", icon: Link2, on: linksOk },
    { key: "videoFile", icon: Clapperboard, on: VIDEO_SOURCES_ON.includes("file") },
    { key: "both", icon: Video, on: linksOk },
  ];
  const needsAudio = what === "audio" || what === "both";
  const needsVidLink = what === "videoLink" || what === "both";

  const reset = () => {
    setStep(1);
    setAudio(undefined);
    setVideo(undefined);
    setAu("");
    setVid("");
    setTg("");
    setDur("");
    setV(fresh());
    setErr("");
  };

  // a clip that isn't on Telegram gets its own number, from 1,000,000 up (never clashes with the channel)
  const nextId = () => Math.max(SITE_ID_START - 1, ...[...Object.keys(data.lessons), ...Object.keys(ov.add)].map(Number).filter((n) => n >= SITE_ID_START)) + 1;

  /** Step 2 → 3: check the media, then fill what can be guessed (title from the file or YouTube, length). */
  const toDetails = async () => {
    if (needsAudio && !audio && !isAudioLink(au.trim())) return setErr(au.trim() ? t("badLink") : t("wiz.needAudio"));
    if ((needsAudio && audio) || what === "videoFile") {
      if (!filesOk) return setErr(t("wiz.needUploads"));
    }
    if (needsVidLink) {
      if (!vid.trim()) return setErr(t("wiz.needVideo"));
      const bad = mediaError(t, vid, "");
      if (bad) return setErr(bad);
    }
    if (what === "videoFile" && !video) return setErr(t("wiz.needVideoFile"));
    if (tg.trim() && telegramId(tg, data.channel) === null) return setErr(t("wiz.tgBad"));
    setErr("");
    const file = audio ?? video;
    let title = v.t;
    if (!title && file) title = file.name.replace(/\.[^.]+$/, "").replace(/[_]+/g, " ").trim();
    if (!title && needsVidLink && parseVideo(vid.trim())?.source === "youtube") {
      const r = await fetch(`/api/admin/oembed?url=${encodeURIComponent(vid.trim())}`).catch(() => null);
      const j = r?.ok ? ((await r.json().catch(() => ({}))) as { title?: string }) : {};
      if (j.title) {
        title = j.title;
        toast(t("wiz.titleFound"));
      }
    }
    setV((x) => ({ ...x, t: title }));
    setDur(file ? await durationOf(file) : "");
    setStep(3);
  };

  const add = () => {
    const tgId = tg.trim() ? telegramId(tg, data.channel) : null;
    const id = tgId ?? nextId();
    if (data.lessons[id] || ov.add[id]) return setErr(t("errExists"));
    if (!v.t.trim()) return setErr(t("errTitle"));
    if (v.series === NEW_SERIES && !v.newSeries.trim()) return setErr(t("wiz.needSeriesName"));
    const newKey = v.series === NEW_SERIES ? `s-${Date.now().toString(36)}` : "";
    const [series, sec] = newKey ? [newKey, ""] : v.series.split("|");
    const videoSrc = what === "videoFile" ? "file" : needsVidLink ? vid.trim() : "";
    setOv((o) => ({
      ...o,
      ...(newKey ? { series: [...o.series, { key: newKey, title: v.newSeries.trim(), sheikh: v.s }] } : {}),
      add: {
        ...o.add,
        [id]: {
          t: v.t.trim(),
          s: v.s,
          k: v.k,
          h: v.h.trim(),
          ...(v.g ? { g: v.g } : {}),
          d: dur,
          p: audio ? 1 : 0,
          ...(videoSrc ? { vid: videoSrc } : {}),
          ...(needsAudio && !audio && au.trim() ? { au: au.trim() } : {}),
          series: series ?? "",
          sec: sec ?? "",
        },
      },
    }));
    if (audio) addJob(id, "audio", audio);
    if (what === "videoFile" && video) addJob(id, "video", video);
    toast.success(t("wiz.added"));
    reset();
  };

  const steps = [t("wiz.step1"), t("wiz.step2"), t("wiz.step3")];
  const shIndex = Math.max(0, data.sheikhs.findIndex((s) => s.key === v.s));
  const preview = (
    <div className="flex flex-col overflow-hidden rounded-xl border bg-background sm:flex-row">
      <Cover pat={nextId()} tone={shIndex + 1} kind={v.k} tag={c.tk(v.k)} title={v.t || "…"} byline={c.shName(v.s) ? `${tc("sheikh")} ${c.shName(v.s)}` : undefined} className="sm:w-56" />
      <div className="flex flex-col justify-center gap-1 p-3.5">
        <b className="text-[15.5px]">{v.t || "…"}</b>
        <small className="text-muted-foreground">
          {[c.shName(v.s), dateText({ h: v.h, g: v.g }, { months: tc.raw("months") as string[], hijriSuffix: tc("hijriSuffix"), locale }), dur].filter(Boolean).join(" · ")}
        </small>
        {what !== "audio" ? (
          <small className="inline-flex items-center gap-1 font-bold text-primary">
            <Video className="size-4" />
            {t("wiz.withVideo")}
          </small>
        ) : null}
      </div>
    </div>
  );

  return (
    <>
      <div className="flex flex-col gap-4 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-extrabold">{t("addTitle")}</h2>
        {/* where we are */}
        <ol className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
          {steps.map((s, i) => (
            <li key={s} className={cn("flex items-center gap-1.5", step === i + 1 ? "font-bold text-primary" : "text-muted-foreground")}>
              <span className={cn("grid size-6 place-items-center rounded-full border text-xs", step === i + 1 ? "border-primary bg-primary text-primary-foreground" : step > i + 1 && "border-primary text-primary")}>
                {i + 1}
              </span>
              {s}
              {i < 2 ? <span className="text-muted-foreground">‹</span> : null}
            </li>
          ))}
        </ol>

        {step === 1 ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {choices
              .filter((x) => x.on)
              .map(({ key, icon: Icon }) => (
                <button
                  key={key}
                  onClick={() => {
                    // a different choice starts clean (files and links from the other one would not fit)
                    if (key !== what) {
                      setAudio(undefined);
                      setVideo(undefined);
                      setAu("");
                      setVid("");
                    }
                    setWhat(key);
                    setStep(2);
                  }}
                  className="flex items-start gap-3 rounded-xl border p-4 text-start transition-colors hover:border-primary hover:bg-accent"
                >
                  <span className="grid size-11 shrink-0 place-items-center rounded-lg bg-accent text-primary">
                    <Icon className="size-6" />
                  </span>
                  <span>
                    <b className="block">{t(`wiz.${key}`)}</b>
                    <small className="text-muted-foreground">{t(`wiz.${key}Sub`, { max: data.maxVideoMB })}</small>
                  </span>
                </button>
              ))}
            {!filesOk ? <p className="rounded-lg bg-muted p-3 text-sm sm:col-span-2">{t("wiz.needUploads")}</p> : null}
          </div>
        ) : null}

        {step === 2 ? (
          <div className="flex flex-col gap-3">
            {needsAudio ? (
              <>
                <Dropzone t={t} file={audio} onPick={setAudio} onClear={() => setAudio(undefined)} exts={AUDIO_EXT} mime="audio/*" maxMB={AUDIO_MAX_MB} label={t("wiz.dropAudio")} hint={t("wiz.dropAudioHint", { max: AUDIO_MAX_MB })} />
                {!audio ? (
                  <label className={field}>
                    {t("wiz.orAudioLink")}
                    <input className={control} dir="ltr" inputMode="url" placeholder="https://…/lesson.mp3" value={au} onChange={(e) => setAu(e.target.value)} />
                  </label>
                ) : null}
              </>
            ) : null}
            {needsVidLink ? <VideoLinkField t={t} value={vid} onChange={setVid} autoFocus={what === "videoLink"} /> : null}
            {what === "videoFile" ? (
              <Dropzone t={t} file={video} onPick={setVideo} onClear={() => setVideo(undefined)} exts={VIDEO_EXT} mime="video/*" maxMB={data.maxVideoMB} label={t("wiz.dropVideo")} hint={t("wiz.dropVideoHint", { max: data.maxVideoMB })} />
            ) : null}
            {data.channel ? (
              <label className={field}>
                {t("wiz.tgLink")}
                <input className={control} dir="ltr" inputMode="url" placeholder={`https://t.me/${data.channel}/650`} value={tg} onChange={(e) => setTg(e.target.value)} />
              </label>
            ) : null}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => (setErr(""), setStep(1))} className="h-10 gap-1.5">
                <ArrowRight className="size-4 ltr:rotate-180" />
                {t("wiz.back")}
              </Button>
              <Button onClick={toDetails} className="h-10 gap-1.5 px-5 font-bold">
                {t("wiz.next")}
                <ArrowLeft className="size-4 ltr:rotate-180" />
              </Button>
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="flex flex-col gap-3">
            <label className={field}>
              {t("fieldTitle")}
              <input className={control} autoFocus placeholder={t("titlePlaceholder")} value={v.t} onChange={(e) => setV({ ...v, t: e.target.value })} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={field}>
                {t("fieldSheikh")}
                <select className={control} value={v.s} onChange={(e) => setV({ ...v, s: e.target.value })}>
                  {data.sheikhs.map((s) => (
                    <option key={s.key} value={s.key}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={field}>
                {t("fieldKind")}
                <select className={control} value={v.k} onChange={(e) => setV({ ...v, k: e.target.value as Kind })}>
                  {TYPE_KEYS.map((k) => (
                    <option key={k} value={k}>
                      {c.tk(k)}
                    </option>
                  ))}
                </select>
              </label>
              <DateField t={t} h={v.h} g={v.g} onChange={(d) => setV({ ...v, ...d })} />
              <label className={field}>
                {t("fieldSeries")}
                <select className={control} value={v.series} onChange={(e) => setV({ ...v, series: e.target.value })}>
                  <option value="">{t("noSeries")}</option>
                  {c.seriesOpts.map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                  <option value={NEW_SERIES}>{t("wiz.newSeries")}</option>
                </select>
              </label>
              {v.series === NEW_SERIES ? (
                <label className={cn(field, "sm:col-span-2")}>
                  {t("wiz.newSeriesName", { sheikh: c.shName(v.s) })}
                  <input className={control} autoFocus value={v.newSeries} onChange={(e) => setV({ ...v, newSeries: e.target.value })} />
                </label>
              ) : null}
            </div>
            <small className="font-semibold text-muted-foreground">{t("wiz.preview")}</small>
            {preview}
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => (setErr(""), setStep(2))} className="h-10 gap-1.5">
                <ArrowRight className="size-4 ltr:rotate-180" />
                {t("wiz.back")}
              </Button>
              <Button onClick={add} className="h-10 gap-2 px-5 font-bold">
                <CirclePlus className="size-5" />
                {t("add")}
              </Button>
            </div>
          </div>
        ) : null}
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
      </div>
      <Jobs {...c} />
    </>
  );
}

/** Files on their way up, with progress; removing one also removes a new clip that was only that file. */
export function Jobs(c: Ctx) {
  const { t, jobs, eff, removeJob, retryJob } = c;
  const list = Object.values(jobs);
  if (!list.length) return null;
  return (
    <>
      <H2>{t("waiting")}</H2>
      <p className="mb-2 text-sm text-muted-foreground">{t("wiz.publishHint")}</p>
      <Card>
        {list.map((j) => (
          <Row
            key={j.key}
            id={j.id}
            title={
              <span className="inline-flex items-center gap-1.5">
                {j.kind === "video" ? <Video className="size-4 text-primary" /> : <AudioLines className="size-4 text-primary" />}
                {eff(j.id).t}
              </span>
            }
            sub={
              <span className="flex items-center gap-2">
                <span className="truncate">{`${j.file.name} · ${(j.file.size / 1e6).toFixed(1)} MB`}</span>
                <span className={cn("shrink-0 font-semibold", j.err ? "text-destructive" : j.url ? "text-primary" : "")}>
                  {j.err ? t("wiz.uploadFailed") : j.url ? t("wiz.uploaded") : t("wiz.uploading", { pct: j.pct })}
                </span>
              </span>
            }
          >
            {!j.url && !j.err ? (
              <span className="hidden h-1.5 w-24 overflow-hidden rounded-full bg-muted sm:block">
                <span className="block h-full bg-primary transition-[width]" style={{ width: `${j.pct}%` }} />
              </span>
            ) : null}
            {j.err ? (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={() => retryJob(j.key)}>
                <RotateCw className="size-4" />
                {t("wiz.retry")}
              </Button>
            ) : null}
            <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => removeJob(j.key)}>
              <Trash2 className="size-4" />
              {t("remove")}
            </Button>
          </Row>
        ))}
      </Card>
    </>
  );
}

