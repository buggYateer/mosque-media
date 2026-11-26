"use client";

/**
 * /lawha — the mosque's dashboard (same features as the original site):
 *  status: new channel posts not on the site, recordings without audio, ignored posts
 *  list:   search / filter / edit (title, sheikh, type, date, series, hidden, featured)
 *  add:    add a recording that's on the channel, with its audio file
 *  featured: order the home-page picks
 * Edits stay in this browser until "Publish changes" saves them in one go (server side; no key in the browser).
 */
import { upload } from "@vercel/blob/client";
import { ArrowUp, CirclePlus, CloudUpload, ExternalLink, EyeOff, LayoutDashboard, Library, LogOut, RefreshCw, Search, Send, Star, Trash2, Undo2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { gregorianToHijri, hijriToGregorian, parseGregorian, parseHijri, toHijriText, toIso, today } from "@/lib/dates";
import { isAudioLink, parseVideo } from "@/lib/media";
import { CALENDAR, DEFAULT_TYPE, SITE_ID_START, TYPE_KEYS, TYPES, VIDEO_SOURCES_ON } from "@/lib/site-shared";
import type { Kind, Lesson, Overrides } from "@/lib/storage/types";
import { norm } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";

type State = {
  channel: string;
  storage: { data: string; audio: string };
  uploads: boolean;
  lessons: Record<string, Lesson>;
  sheikhs: { key: string; name: string; series: { key: string; title: string; sections: string[] }[] }[];
  seriesOf: Record<string, string>;
  overrides: Overrides;
};
type Eff = Lesson & { series: string; hidden: boolean; isNew: boolean; edited: boolean };
/** The content types from site.config.json. */
const KINDS: Kind[] = TYPE_KEYS;
const MAX = 300 * 1024 * 1024;

function fmtDur(sec: number) {
  const s = Math.round(sec);
  return s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
const durationOf = (file: File) =>
  new Promise<string>((res) => {
    const a = new Audio();
    a.preload = "metadata";
    a.onloadedmetadata = () => {
      res(fmtDur(a.duration));
      URL.revokeObjectURL(a.src);
    };
    a.onerror = () => res("");
    a.src = URL.createObjectURL(file);
  });

const field = "flex flex-col gap-1.5 text-sm font-semibold text-muted-foreground";
const control = "h-10 w-full rounded-lg border bg-background px-3 text-foreground";

export function Dashboard({ logo }: { logo: React.ReactNode }) {
  const t = useTranslations("lawha");
  const tk = useTranslations("kind");
  const locale = useLocale();
  const [phase, setPhase] = useState<"loading" | "login" | "ready" | "not-configured" | "error">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<State | null>(null);
  const [ov, setOv] = useState<Overrides | null>(null);
  const [orig, setOrig] = useState("");
  const [files, setFiles] = useState<Record<number, File>>({});
  const [tab, setTab] = useState<"status" | "list" | "add" | "featured">("status");
  const [busy, setBusy] = useState("");

  const load = useCallback(async () => {
    setPhase("loading");
    const r = await fetch("/api/admin/state", { cache: "no-store" });
    const j = await r.json().catch(() => ({}));
    if (r.status === 401) return setPhase("login");
    if (r.status === 503) return setPhase("not-configured");
    if (!r.ok) {
      setError(t("loadFailed", { detail: j.detail ?? r.status }));
      return setPhase("error");
    }
    setData(j);
    setOv(j.overrides);
    setOrig(JSON.stringify(j.overrides));
    setFiles({});
    setPhase("ready");
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load from the server
    load();
  }, [load]);

  const pending = ov ? (JSON.stringify(ov) !== orig ? 1 : 0) + Object.keys(files).length : 0;
  useEffect(() => {
    const warn = (e: BeforeUnloadEvent) => {
      if (pending) e.preventDefault();
    };
    addEventListener("beforeunload", warn);
    return () => removeEventListener("beforeunload", warn);
  }, [pending]);

  const eff = useCallback(
    (id: number): Eff => {
      const base = data!.lessons[id] ?? (ov!.add[id] as Lesson | undefined) ?? ({ t: "", s: "", k: DEFAULT_TYPE, d: "", h: "", p: 0 } as Lesson);
      const e = ov!.edit[id] ?? {};
      const L: Eff = { ...base, series: "", hidden: !!e.hidden, isNew: !!ov!.add[id] && !data!.lessons[id], edited: !!ov!.edit[id] };
      for (const f of ["t", "s", "k", "h", "g"] as const) if (e[f]) (L as Record<string, unknown>)[f] = e[f];
      L.series = e.series !== undefined ? `${e.series}|${e.sec ?? ""}` : ov!.add[id] ? `${ov!.add[id].series ?? ""}|${ov!.add[id].sec ?? ""}` : (data!.seriesOf[id] ?? "");
      if (L.series === "|") L.series = "";
      return L;
    },
    [data, ov],
  );

  const publish = async () => {
    if (!ov) return;
    try {
      const uploads: { id: number; url: string }[] = [];
      for (const [id, file] of Object.entries(files)) {
        setBusy(t("uploadingFile", { id, pct: 0 }));
        const b = await upload(`incoming/${id}.mp3`, file, {
          access: "public",
          handleUploadUrl: "/api/admin/upload",
          contentType: "audio/mpeg",
          multipart: file.size > 50 * 1024 * 1024,
          onUploadProgress: (p) => setBusy(t("uploadingFile", { id, pct: Math.round(p.percentage) })),
        });
        uploads.push({ id: Number(id), url: b.url });
      }
      setBusy(t("publishing"));
      const r = await fetch("/api/admin/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overrides: ov, uploads }) });
      if (r.status === 401) return setPhase("login");
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? r.status);
      setOrig(JSON.stringify(ov));
      setFiles({});
      toast.success(t("published"));
    } catch (e) {
      toast.error(t("publishFailed", { detail: String((e as Error).message ?? e) }));
    } finally {
      setBusy("");
    }
  };

  const header = (
    <header className="sticky top-0 z-30 border-b bg-header text-header-foreground">
      <div className="mx-auto flex h-16 max-w-5xl items-center gap-2 px-4">
        <b className="flex items-center gap-2 text-lg font-extrabold">
          {logo}
          {t("title")}
        </b>
        <span className="flex-1" />
        <Link href="/" target="_blank" className="grid size-10 place-items-center rounded-lg hover:bg-header-foreground/10" aria-label={t("openSite")} title={t("openSite")}>
          <ExternalLink className="size-5" />
        </Link>
        {phase === "ready" ? (
          <>
            <Button onClick={publish} disabled={!pending || !!busy} className="h-10 gap-2 bg-highlight px-4 font-bold text-highlight-foreground hover:bg-highlight/90">
              <CloudUpload className="size-5" />
              {busy || (pending ? t("publish") : t("nothingToPublish"))}
              {pending && !busy ? <b className="rounded-full bg-black/15 px-2 text-xs">{pending}</b> : null}
            </Button>
            <button
              className="grid size-10 place-items-center rounded-lg hover:bg-header-foreground/10"
              aria-label={t("signOut")}
              title={t("signOut")}
              onClick={async () => {
                await fetch("/api/admin/logout", { method: "POST" });
                setPhase("login");
              }}
            >
              <LogOut className="size-5 rtl:-scale-x-100" />
            </button>
          </>
        ) : null}
      </div>
    </header>
  );

  if (phase !== "ready" || !data || !ov)
    return (
      <>
        {header}
        <main className="mx-auto max-w-md px-4 py-16">
          {phase === "login" ? <Login onDone={load} /> : null}
          {phase === "loading" ? <p className="text-center text-muted-foreground">{t("loading")}</p> : null}
          {phase === "not-configured" ? <p className="rounded-xl border bg-card p-5">{t("notConfigured")}</p> : null}
          {phase === "error" ? <p className="rounded-xl border border-destructive bg-card p-5 text-destructive">{error}</p> : null}
        </main>
      </>
    );

  const allIds = [...new Set([...Object.keys(data.lessons), ...Object.keys(ov.add)])].map(Number).sort((a, b) => b - a);
  const shName = (k: string) => data.sheikhs.find((s) => s.key === k)?.name ?? "";
  const seriesOpts = data.sheikhs.flatMap((sh) =>
    sh.series.flatMap((se) => (se.sections.length > 1 ? se.sections : [""]).map((sec) => [`${se.key}|${sec}`, `${se.title}${sec ? ` — ${sec}` : ""} (${sh.name})`] as const)),
  );
  const updateOv = (fn: (o: Overrides) => Overrides) => setOv((o) => (o ? fn(o) : o));
  const ctx = { t, tk, data, ov, setOv: updateOv, files, setFiles, eff, allIds, shName, seriesOpts, locale, setTab };
  const tabs = [
    ["status", LayoutDashboard],
    ["list", Library],
    ["add", CirclePlus],
    ["featured", Star],
  ] as const;

  return (
    <>
      {header}
      <nav className="sticky top-16 z-20 border-b bg-background">
        <div className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 py-2">
          {tabs.map(([k, Icon]) => (
            <button key={k} onClick={() => setTab(k)} className={cn("flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 font-semibold", tab === k ? "bg-primary text-primary-foreground" : "hover:bg-muted")}>
              <Icon className="size-4.5" />
              {t(`tabs.${k}`)}
            </button>
          ))}
        </div>
      </nav>
      <main className="mx-auto max-w-5xl px-4 py-5">
        {tab === "status" ? <StatusView {...ctx} /> : null}
        {tab === "list" ? <ListView {...ctx} /> : null}
        {tab === "add" ? <AddView {...ctx} /> : null}
        {tab === "featured" ? <FeaturedView {...ctx} /> : null}
        <p className="mt-8 text-center text-xs text-muted-foreground">{t("storage", { data: data.storage.data, audio: data.storage.audio })}</p>
      </main>
    </>
  );
}

function Login({ onDone }: { onDone: () => void }) {
  const t = useTranslations("lawha");
  const [err, setErr] = useState("");
  const [sending, setSending] = useState(false);
  return (
    <form
      className="flex flex-col gap-4 rounded-xl border bg-card p-6"
      onSubmit={async (e) => {
        e.preventDefault();
        setSending(true);
        const r = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: new FormData(e.currentTarget).get("password") }) });
        setSending(false);
        if (r.ok) return onDone();
        setErr(r.status === 503 ? t("notConfigured") : t("wrongPassword"));
      }}
    >
      <h1 className="text-2xl font-extrabold">{t("title")}</h1>
      <p className="text-muted-foreground">{t("loginIntro")}</p>
      <label className={field}>
        {t("password")}
        <Input name="password" type="password" autoComplete="current-password" required className="h-10" />
      </label>
      <Button type="submit" disabled={sending} className="h-10 font-bold">
        {t("signIn")}
      </Button>
      {err ? <p className="text-sm text-destructive">{err}</p> : null}
    </form>
  );
}

type Ctx = {
  t: ReturnType<typeof useTranslations<"lawha">>;
  tk: ReturnType<typeof useTranslations<"kind">>;
  data: State;
  ov: Overrides;
  setOv: (fn: (o: Overrides) => Overrides) => void;
  files: Record<number, File>;
  setFiles: (fn: (f: Record<number, File>) => Record<number, File>) => void;
  eff: (id: number) => Eff;
  allIds: number[];
  shName: (k: string) => string;
  seriesOpts: (readonly [string, string])[];
  locale: string;
  setTab: (t: "status" | "list" | "add" | "featured") => void;
};

const Row = ({ id, title, sub, children, onClick }: { id: number | string; title: React.ReactNode; sub?: React.ReactNode; children?: React.ReactNode; onClick?: () => void }) => (
  <div className={cn("flex items-center gap-3 border-b px-3.5 py-2.5 last:border-b-0", onClick && "cursor-pointer hover:bg-muted/60")} onClick={onClick}>
    <span className="min-w-12 rounded-md bg-muted px-1.5 py-0.5 text-center text-xs font-bold text-muted-foreground tabular-nums">{id}</span>
    <div className="min-w-0 flex-1">
      <b className="block truncate font-semibold">{title}</b>
      {sub ? <small className="block truncate text-muted-foreground">{sub}</small> : null}
    </div>
    {children ? <div className="flex shrink-0 items-center gap-1.5">{children}</div> : null}
  </div>
);
const Card = ({ children }: { children: React.ReactNode }) => <div className="overflow-hidden rounded-xl border bg-card">{children}</div>;
const H2 = ({ children, extra }: { children: React.ReactNode; extra?: React.ReactNode }) => (
  <div className="mt-7 mb-2 flex items-center gap-2">
    <h2 className="text-lg font-extrabold">{children}</h2>
    <span className="flex-1" />
    {extra}
  </div>
);

function StatusView(c: Ctx) {
  const { t, data, ov, setOv, eff, allIds, shName } = c;
  const [chan, setChan] = useState<{ last: number; found: { id: number; date: string }[] } | null>(null);
  const [upFor, setUpFor] = useState<number | null>(null);
  const lastSite = allIds[0] ?? 0;
  const scan = useCallback(() => {
    setChan(null);
    const from = Math.max(0, Math.min(lastSite, ...ov.ignore) - 1);
    fetch(`/api/channel?from=${from}`)
      .then((r) => r.json())
      .then(setChan)
      .catch(() => {
        setChan({ last: 0, found: [] });
        toast.error(t("channelUnreachable"));
      });
  }, [lastSite, ov.ignore, t]);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- scan the channel once when the tab opens
  useEffect(() => scan(), []); // eslint-disable-line react-hooks/exhaustive-deps

  const missing = allIds.filter((i) => {
    const L = eff(i);
    return !L.hidden && !(data.lessons[i] ?? ov.add[i])?.p && !c.files[i];
  });
  const newOnes = chan ? chan.found.filter((x) => x.id > lastSite && !ov.ignore.includes(x.id) && !ov.add[x.id]) : null;
  const fmtDate = (d: string) => new Date(d).toLocaleString(c.locale, { dateStyle: "medium", timeStyle: "short" });
  const stat = (label: string, value: React.ReactNode, note: string, warn = false) => (
    <div className={cn("flex flex-col rounded-xl border bg-card p-4", warn && "border-highlight")}>
      <small className="text-muted-foreground">{label}</small>
      <b className="text-2xl font-extrabold tabular-nums">{value}</b>
      <i className="truncate text-xs text-muted-foreground not-italic">{note}</i>
    </div>
  );
  // a link to the post, only for clips that came from the channel
  const tgLink = (id: number) =>
    data.channel && id < SITE_ID_START ? (
      <a className="inline-flex h-8 items-center gap-1 rounded-lg border px-2.5 text-sm hover:bg-muted" href={`https://t.me/${data.channel}/${id}`} target="_blank" rel="noopener">
        <ExternalLink className="size-4" />
        {t("open")}
      </a>
    ) : null;

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stat(t("lastOnSite"), lastSite, eff(lastSite).t)}
        {data.channel ? stat(t("lastOnChannel"), chan ? chan.last || "؟" : "…", chan ? (chan.found.length ? new Date(chan.found.at(-1)!.date).toLocaleDateString(c.locale) : t("nothingNew")) : t("searching")) : null}
        {data.channel ? stat(t("notOnSite"), newOnes ? newOnes.length : "…", t("newPosts"), !!newOnes?.length) : null}
        {stat(t("noAudio"), missing.length, t("telegramOnlyNote"), !!missing.length)}
      </div>

      {/* posts on the channel that aren't on the site yet (only with a Telegram channel) */}
      {data.channel ? (
        <>
          <H2
            extra={
              <Button variant="outline" size="sm" onClick={scan} className="gap-1.5">
                <RefreshCw className="size-4" />
                {t("refresh")}
              </Button>
            }
          >
            {t("notOnSite")}
          </H2>
          <p className="mb-2 text-sm text-muted-foreground">{t("notOnSiteHint")}</p>
          <Card>
            {newOnes === null ? (
              <p className="py-6 text-center text-muted-foreground">{t("searching")}</p>
            ) : newOnes.length ? (
              newOnes.map((x) => (
                <Row key={x.id} id={x.id} title={t("message", { id: x.id })} sub={fmtDate(x.date)}>
                  {tgLink(x.id)}
                  <Button size="sm" onClick={() => (sessionStorage.setItem("lawha:add", String(x.id)), c.setTab("add"))}>
                    {t("addIt")}
                  </Button>
                  <Button size="sm" variant="destructive" onClick={() => setOv((o) => ({ ...o, ignore: [...o.ignore, x.id] }))}>
                    {t("ignore")}
                  </Button>
                </Row>
              ))
            ) : (
              <p className="py-6 text-center text-muted-foreground">{t("allOnSite")}</p>
            )}
          </Card>
        </>
      ) : null}

      <H2 extra={<small className="text-muted-foreground">{missing.length}</small>}>{t("noAudio")}</H2>
      <p className="mb-2 text-sm text-muted-foreground">{t("noAudioHint")}</p>
      <Card>
        {missing.map((i) => (
          <Row key={i} id={i} title={eff(i).t} sub={shName(eff(i).s)}>
            {tgLink(i)}
            <Button size="sm" variant="outline" onClick={() => setUpFor(i)} className="gap-1.5" disabled={!data.uploads}>
              <CloudUpload className="size-4" />
              {t("uploadAudio")}
            </Button>
          </Row>
        ))}
      </Card>

      {ov.ignore.length ? (
        <>
          <H2 extra={<small className="text-muted-foreground">{ov.ignore.length}</small>}>{t("ignored")}</H2>
          <Card>
            {[...ov.ignore]
              .sort((a, b) => b - a)
              .map((i) => (
                <Row key={i} id={i} title={t("message", { id: i })} sub={t("ignoredHint")}>
                  <Button size="sm" variant="outline" onClick={() => setOv((o) => ({ ...o, ignore: o.ignore.filter((x) => x !== i) }))} className="gap-1.5">
                    <Undo2 className="size-4" />
                    {t("unignore")}
                  </Button>
                </Row>
              ))}
          </Card>
        </>
      ) : null}
      {!data.uploads ? <p className="mt-4 rounded-xl border bg-card p-3 text-sm text-muted-foreground">{t("uploadsOff")}</p> : null}
      {upFor !== null ? <UploadDialog {...c} id={upFor} onClose={() => setUpFor(null)} /> : null}
    </>
  );
}

/**
 * The date of a recording, in the calendar the mosque chose (site.config.json → dates).
 * Both dates are kept in step, so switching the calendar later still has every date.
 */
function DateField({ t, h, g, onChange }: { t: Ctx["t"]; h: string; g: string; onChange: (d: { h: string; g: string }) => void }) {
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
function mediaError(t: Ctx["t"], vid: string, au: string) {
  if (vid.trim()) {
    const v = parseVideo(vid.trim(), "x");
    if (!v || v.source === "file") return t("badLink");
    if (!VIDEO_SOURCES_ON.includes(v.source)) return t("sourceOff", { site: t(`sourceName.${v.source}`) });
  }
  if (au.trim() && !isAudioLink(au.trim())) return t("badLink");
  return "";
}

/** A video link (YouTube / Facebook / Drive / direct) and an outside audio link, with what was recognized. */
function MediaFields({ t, vid, au, onChange }: { t: Ctx["t"]; vid: string; au: string; onChange: (m: { vid: string; au: string }) => void }) {
  const v = vid.trim() && vid !== "file" ? parseVideo(vid.trim(), "x") : null;
  const note = !vid.trim() || vid === "file" ? "" : v && VIDEO_SOURCES_ON.includes(v.source) ? t("videoFound", { site: t(`sourceName.${v.source}`) }) : mediaError(t, vid, "");
  const ok = !!v && VIDEO_SOURCES_ON.includes(v.source);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <label className={field}>
        {t("fieldVideo")}
        <input className={control} dir="ltr" inputMode="url" placeholder="https://youtu.be/…" value={vid === "file" ? "" : vid} onChange={(e) => onChange({ vid: e.target.value, au })} />
        {note ? <small className={cn("font-normal", ok ? "text-primary" : "text-destructive")}>{note}</small> : null}
      </label>
      <label className={field}>
        {t("fieldAudioLink")}
        <input className={control} dir="ltr" inputMode="url" placeholder="https://…/lesson.mp3" value={au} onChange={(e) => onChange({ vid, au: e.target.value })} />
      </label>
    </div>
  );
}

function FilePick({ t, file, onPick }: { t: Ctx["t"]; file?: File; onPick: (f: File) => void }) {
  return (
    <label className={cn("flex cursor-pointer flex-col items-center gap-1 rounded-xl border-2 border-dashed p-5 text-center hover:bg-muted/50", file && "border-primary bg-accent")}>
      <CloudUpload className="size-7 text-primary" />
      <b>{file ? `${file.name} — ${(file.size / 1e6).toFixed(1)} MB` : t("chooseFile")}</b>
      <small className="text-muted-foreground">{t("fileLimit")}</small>
      <input type="file" accept="audio/mpeg,.mp3" className="hidden" onChange={(e) => e.target.files?.[0] && onPick(e.target.files[0])} />
    </label>
  );
}

function UploadDialog(c: Ctx & { id: number; onClose: () => void }) {
  const { t, id, eff, shName } = c;
  const [file, setFile] = useState<File>();
  return (
    <Dialog open onOpenChange={(o) => !o && c.onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{t("uploadTitle", { id })}</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {eff(id).t} — {shName(eff(id).s)}
        </p>
        <FilePick t={t} file={file} onPick={setFile} />
        <DialogFooter>
          <Button
            disabled={!file || file.size > MAX}
            onClick={() => {
              c.setFiles((f) => ({ ...f, [id]: file! }));
              c.setOv((o) => ({ ...o, edit: { ...o.edit, [id]: { ...(o.edit[id] ?? {}), p: 1 } } }));
              toast(t("readyHint"));
              c.onClose();
            }}
          >
            {t("ok")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ListView(c: Ctx) {
  const { t, allIds, eff, shName } = c;
  const [q, setQ] = useState("");
  const [kf, setKf] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const ids = useMemo(
    () =>
      allIds.filter((i) => {
        const L = eff(i);
        return (!kf || L.k === kf || (kf === "hid" && L.hidden) || (kf === "ed" && (L.edited || L.isNew))) && (!q || norm(`${i} ${L.t} ${shName(L.s)}`).includes(norm(q)));
      }),
    [allIds, eff, kf, q, shName],
  );
  const chips: [string, string][] = [
    ["", t("filterAll")],
    ...TYPES.filter((x) => x.menu).map((x): [string, string] => [x.key, c.tk(x.key)]),
    ["ed", t("filterEdited")],
    ["hid", t("filterHidden")],
  ];
  return (
    <>
      <div className="mb-3 flex items-center gap-2 rounded-lg border bg-card px-3">
        <Search className="size-5 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="h-11 flex-1 bg-transparent outline-none" />
      </div>
      <div className="mb-3 flex flex-wrap gap-2">
        {chips.map(([k, label]) => (
          <button key={k} onClick={() => setKf(k)} className={cn("rounded-full border bg-card px-3.5 py-1 text-sm font-semibold", kf === k && "border-primary bg-primary text-primary-foreground")}>
            {label}
          </button>
        ))}
      </div>
      <Card>
        {ids.slice(0, 100).map((i) => {
          const L = eff(i);
          return (
            <Row
              key={i}
              id={i}
              onClick={() => setEditing(i)}
              title={
                <>
                  {L.t}
                  {L.isNew ? <Tag tone="new">{t("tagNew")}</Tag> : null}
                  {L.hidden ? <Tag tone="hid">{t("tagHidden")}</Tag> : L.edited ? <Tag tone="ed">{t("tagEdited")}</Tag> : null}
                </>
              }
              sub={`${shName(L.s)} · ${c.tk(L.k)}`}
            />
          );
        })}
      </Card>
      {ids.length > 100 ? <p className="mt-2 text-sm text-muted-foreground">{t("firstN", { n: 100, total: ids.length })}</p> : null}
      {editing !== null ? <EditDialog {...c} id={editing} onClose={() => setEditing(null)} /> : null}
    </>
  );
}

const Tag = ({ tone, children }: { tone: "new" | "ed" | "hid"; children: React.ReactNode }) => (
  <span
    className={cn(
      "ms-2 inline-block rounded-full px-2 align-[1px] text-[11px] font-bold",
      tone === "new" && "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-300",
      tone === "ed" && "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300",
      tone === "hid" && "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300",
    )}
  >
    {children}
  </span>
);

function EditDialog(c: Ctx & { id: number; onClose: () => void }) {
  const { t, id, eff, data, ov, setOv } = c;
  const L = eff(id);
  const [v, setV] = useState({ t: L.t, s: L.s, k: L.k, h: L.h, g: L.g ?? "", vid: L.vid ?? "", au: L.au ?? "", series: L.series, hidden: L.hidden, featured: ov.featured.includes(id) });
  const save = () => {
    const bad = mediaError(t, v.vid, v.au);
    if (bad) return toast.error(bad);
    setOv((o) => {
      const n: Overrides = { ...o, edit: { ...o.edit }, add: { ...o.add }, featured: o.featured.filter((x) => x !== id) };
      const [series, sec] = v.series.split("|");
      if (n.add[id] && !data.lessons[id]) {
        const { vid: _v, au: _a, ...rest } = n.add[id];
        void _v;
        void _a;
        n.add[id] = { ...rest, t: v.t, s: v.s, k: v.k, h: v.h, ...(v.g ? { g: v.g } : {}), ...(v.vid.trim() ? { vid: v.vid.trim() } : {}), ...(v.au.trim() ? { au: v.au.trim() } : {}), series: series ?? "", sec: sec ?? "" };
      }
      else {
        const orig = { ...data.lessons[id], series: data.seriesOf[id] ?? "" };
        const e: Overrides["edit"][string] = {};
        for (const f of ["t", "s", "k", "h", "g"] as const) if (v[f] && v[f] !== (orig[f] ?? "")) (e as Record<string, unknown>)[f] = v[f];
        // video and outside audio: an emptied field removes it
        for (const f of ["vid", "au"] as const) if (v[f].trim() !== (orig[f] ?? "")) e[f] = v[f].trim();
        if (v.series !== orig.series) {
          e.series = series ?? "";
          e.sec = sec ?? "";
        }
        if (v.hidden) e.hidden = true;
        const keepP = o.edit[id]?.p;
        if (keepP) e.p = keepP;
        if (Object.keys(e).length) n.edit[id] = e;
        else delete n.edit[id];
      }
      if (v.featured) n.featured = [id, ...n.featured];
      return n;
    });
    toast(t("savedHint"));
    c.onClose();
  };
  return (
    <Dialog open onOpenChange={(o) => !o && c.onClose()}>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{t("editTitle", { id })}</DialogTitle>
        </DialogHeader>
        <div className="flex flex-col gap-3">
          <label className={field}>
            {t("fieldTitle")}
            <input className={control} value={v.t} onChange={(e) => setV({ ...v, t: e.target.value })} />
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
                {KINDS.map((k) => (
                  <option key={k} value={k}>
                    {c.tk(k)}
                  </option>
                ))}
              </select>
            </label>
            <DateField t={t} h={v.h} g={v.g} onChange={(d) => setV({ ...v, ...d })} />
            <MediaFields t={t} vid={v.vid} au={v.au} onChange={(m) => setV({ ...v, ...m })} />
            <label className={field}>
              {t("fieldSeries")}
              <select className={control} value={v.series} onChange={(e) => setV({ ...v, series: e.target.value })}>
                <option value="">{t("noSeries")}</option>
                {c.seriesOpts.map(([k, label]) => (
                  <option key={k} value={k}>
                    {label}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 font-semibold">
            <span className="flex items-center gap-2">
              <EyeOff className="size-4.5 text-muted-foreground" />
              {t("hidden")}
            </span>
            <Switch checked={v.hidden} onCheckedChange={(x) => setV({ ...v, hidden: x })} />
          </label>
          <label className="flex items-center justify-between gap-3 rounded-lg border px-3 py-2.5 font-semibold">
            <span className="flex items-center gap-2">
              <Star className="size-4.5 text-muted-foreground" />
              {t("inFeatured")}
            </span>
            <Switch checked={v.featured} onCheckedChange={(x) => setV({ ...v, featured: x })} />
          </label>
        </div>
        <DialogFooter className="gap-2 sm:justify-between">
          {data.channel && id < SITE_ID_START ? (
            <a className="inline-flex h-9 items-center gap-1.5 rounded-lg border px-3 text-sm hover:bg-muted" href={`https://t.me/${data.channel}/${id}`} target="_blank" rel="noopener">
              <Send className="size-4 rtl:-scale-x-100" />
              Telegram
            </a>
          ) : (
            <span />
          )}
          <div className="flex gap-2">
            {ov.edit[id] ? (
              <Button
                variant="outline"
                onClick={() => {
                  setOv((o) => {
                    const edit = { ...o.edit };
                    delete edit[id];
                    return { ...o, edit };
                  });
                  toast(t("resetHint"));
                  c.onClose();
                }}
                className="gap-1.5"
              >
                <Undo2 className="size-4" />
                {t("reset")}
              </Button>
            ) : null}
            <Button onClick={save}>{t("save")}</Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function AddView(c: Ctx) {
  const { t, data, ov, setOv, files, setFiles, eff } = c;
  const [prefill] = useState(() => {
    try {
      const v = sessionStorage.getItem("lawha:add") ?? "";
      sessionStorage.removeItem("lawha:add");
      return v;
    } catch {
      return "";
    }
  });
  const [v, setV] = useState(() => ({ id: prefill, k: DEFAULT_TYPE as Kind, t: "", s: data.sheikhs[0]?.key ?? "", ...today(), vid: "", au: "", series: "" }));
  const [file, setFile] = useState<File>();
  const [err, setErr] = useState("");
  // a clip that isn't on Telegram gets its own number, from 1,000,000 up (never clashes with the channel)
  const nextId = () => String(Math.max(SITE_ID_START - 1, ...[...Object.keys(data.lessons), ...Object.keys(ov.add)].map(Number).filter((n) => n >= SITE_ID_START)) + 1);
  const add = async () => {
    const id = v.id || nextId();
    if (!/^\d+$/.test(id)) return setErr(t("errId"));
    if (data.lessons[id] || ov.add[id]) return setErr(t("errExists"));
    if (!file && !v.vid.trim() && !v.au.trim()) return setErr(t("errMedia"));
    if (file && file.size > MAX) return setErr(t("errSize"));
    const bad = mediaError(t, v.vid, v.au);
    if (bad) return setErr(bad);
    if (!v.t.trim()) return setErr(t("errTitle"));
    const d = file ? await durationOf(file) : "";
    const [series, sec] = v.series.split("|");
    const media = { ...(v.vid.trim() ? { vid: v.vid.trim() } : {}), ...(v.au.trim() ? { au: v.au.trim() } : {}) };
    setOv((o) => ({ ...o, add: { ...o.add, [id]: { t: v.t.trim(), s: v.s, k: v.k, h: v.h.trim(), ...(v.g ? { g: v.g } : {}), d, p: file ? 1 : 0, ...media, series: series ?? "", sec: sec ?? "" } } }));
    if (file) setFiles((f) => ({ ...f, [Number(id)]: file }));
    setV({ ...v, id: "", t: "", vid: "", au: "", ...today() });
    setFile(undefined);
    setErr("");
    toast(t("addedHint"));
  };
  return (
    <>
      <div className="flex flex-col gap-3 rounded-xl border bg-card p-5">
        <h2 className="text-lg font-extrabold">{t("addTitle")}</h2>
        <p className="text-sm text-muted-foreground">{t("addHint")}</p>
        {!data.uploads ? <p className="rounded-lg bg-muted p-3 text-sm">{t("uploadsOff")}</p> : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={field}>
            {t("fieldId")}
            <input className={control} inputMode="numeric" placeholder={t("idAuto")} value={v.id} onChange={(e) => setV({ ...v, id: e.target.value.trim() })} />
          </label>
          <label className={field}>
            {t("fieldKind")}
            <select className={control} value={v.k} onChange={(e) => setV({ ...v, k: e.target.value as Kind })}>
              {KINDS.map((k) => (
                <option key={k} value={k}>
                  {c.tk(k)}
                </option>
              ))}
            </select>
          </label>
        </div>
        <FilePick t={t} file={file} onPick={setFile} />
        <MediaFields t={t} vid={v.vid} au={v.au} onChange={(m) => setV({ ...v, ...m })} />
        <label className={field}>
          {t("fieldTitle")}
          <input className={control} placeholder={t("titlePlaceholder")} value={v.t} onChange={(e) => setV({ ...v, t: e.target.value })} />
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
          <DateField t={t} h={v.h} g={v.g} onChange={(d) => setV({ ...v, ...d })} />
        </div>
        <label className={field}>
          {t("fieldSeries")}
          <select className={control} value={v.series} onChange={(e) => setV({ ...v, series: e.target.value })}>
            <option value="">{t("noSeries")}</option>
            {c.seriesOpts.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {/* uploading a file needs the Blob store; links don't */}
        <Button onClick={add} disabled={!!file && !data.uploads} className="h-10 gap-2 self-start px-5 font-bold">
          <CirclePlus className="size-5" />
          {t("add")}
        </Button>
        {err ? <p className="text-sm text-destructive">{err}</p> : null}
      </div>
      {Object.keys(files).length ? (
        <>
          <H2>{t("waiting")}</H2>
          <Card>
            {Object.entries(files).map(([i, f]) => (
              <Row key={i} id={i} title={eff(Number(i)).t} sub={`${f.name} · ${(f.size / 1e6).toFixed(1)} MB`}>
                <Button
                  size="sm"
                  variant="destructive"
                  className="gap-1.5"
                  onClick={() => {
                    setFiles((x) => {
                      const n = { ...x };
                      delete n[Number(i)];
                      return n;
                    });
                    if (ov.add[i] && !data.lessons[i])
                      setOv((o) => {
                        const add = { ...o.add };
                        delete add[i];
                        return { ...o, add };
                      });
                  }}
                >
                  <Trash2 className="size-4" />
                  {t("remove")}
                </Button>
              </Row>
            ))}
          </Card>
        </>
      ) : null}
    </>
  );
}

function FeaturedView(c: Ctx) {
  const { t, ov, setOv, eff, data, shName } = c;
  const ids = ov.featured.filter((i) => data.lessons[i] || ov.add[i]);
  return (
    <>
      <H2>{t("tabs.featured")}</H2>
      <p className="mb-2 text-sm text-muted-foreground">{t("featuredHint")}</p>
      <Card>
        {ids.length ? (
          ids.map((i, n) => (
            <Row key={i} id={n + 1} title={eff(i).t} sub={shName(eff(i).s)}>
              <Button
                size="icon-sm"
                variant="outline"
                aria-label={t("moveUp")}
                disabled={!n}
                onClick={() =>
                  setOv((o) => {
                    const f = [...o.featured];
                    const k = f.indexOf(i);
                    [f[k - 1], f[k]] = [f[k], f[k - 1]];
                    return { ...o, featured: f };
                  })
                }
              >
                <ArrowUp className="size-4" />
              </Button>
              <Button size="icon-sm" variant="destructive" aria-label={t("remove")} onClick={() => setOv((o) => ({ ...o, featured: o.featured.filter((x) => x !== i) }))}>
                <Trash2 className="size-4" />
              </Button>
            </Row>
          ))
        ) : (
          <p className="py-6 text-center text-muted-foreground">{t("noFeatured")}</p>
        )}
      </Card>
    </>
  );
}
