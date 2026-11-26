"use client";

/**
 * /lawha — the mosque's dashboard (same features as the original site):
 *  status: new channel posts not on the site, recordings without audio, ignored posts
 *  list:   search / filter / edit (title, sheikh, type, date, series, hidden, featured)
 *  add:    add a recording in three steps: an audio file, a video link or file, or both (components/lawha/add-wizard.tsx)
 *  featured: order the home-page picks
 * Edits stay in this browser until "Publish changes" saves them in one go (server side; no key in the browser).
 * Picked files start uploading to Vercel Blob at once; publishing waits for them.
 */
import { upload } from "@vercel/blob/client";
import { CirclePlus, CloudUpload, Eye, EyeOff, ExternalLink, LayoutDashboard, Library, ListOrdered, LogOut, RefreshCw, Search, Send, Settings, Star, Trash2, Undo2, Video } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Link } from "@/i18n/navigation";
import { AUDIO_EXT, AUDIO_MAX_MB, extOf } from "@/lib/media";
import { DEFAULT_TYPE, SITE_ID_START, TYPE_KEYS, TYPES } from "@/lib/site-shared";
import type { Kind, Lesson, Overrides } from "@/lib/storage/types";
import { norm } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "../ui/dialog";
import { Input } from "../ui/input";
import { Switch } from "../ui/switch";
import { AddWizard } from "./add-wizard";
import { Overview } from "./overview";
import { move, Reorder } from "./reorder";
import { SeriesView } from "./series-view";
import { SettingsView } from "./settings-view";
import { LocaleSwitcher } from "../locale-switcher";
import { Card, control, type Ctx, DateField, Dropzone, type Eff, field, H2, type Job, jobKey, MediaFields, mediaError, Row, type State, type Tab } from "./parts";

/** The content types from site.config.json. */
const KINDS: Kind[] = TYPE_KEYS;

export function Dashboard({ logo }: { logo: React.ReactNode }) {
  const t = useTranslations("lawha");
  const tk = useTranslations("kind");
  const locale = useLocale();
  const [phase, setPhase] = useState<"loading" | "login" | "ready" | "not-configured" | "error">("loading");
  const [error, setError] = useState("");
  const [data, setData] = useState<State | null>(null);
  const [ov, setOv] = useState<Overrides | null>(null);
  const [orig, setOrig] = useState("");
  const [jobs, setJobs] = useState<Record<string, Job>>({});
  const jobsRef = useRef(jobs);
  useEffect(() => {
    jobsRef.current = jobs;
  });
  /** uploads still running (publishing waits for them) */
  const running = useRef<Record<string, Promise<void>>>({});
  const [tab, setTab] = useState<Tab>("status");
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
    setJobs({});
    setPhase("ready");
  }, [t]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- first load from the server
    load();
  }, [load]);

  const pending = ov ? (JSON.stringify(ov) !== orig ? 1 : 0) + Object.keys(jobs).length : 0;
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
      for (const f of ["vid", "au"] as const) if (e[f] !== undefined) L[f] = e[f] || undefined;
      L.series = e.series !== undefined ? `${e.series}|${e.sec ?? ""}` : ov!.add[id] ? `${ov!.add[id].series ?? ""}|${ov!.add[id].sec ?? ""}` : (data!.seriesOf[id] ?? "");
      if (L.series === "|") L.series = "";
      return L;
    },
    [data, ov],
  );

  const patchJob = (key: string, p: Partial<Job>) => setJobs((j) => (j[key] ? { ...j, [key]: { ...j[key], ...p } } : j));
  /** Sends one file to Vercel Blob (incoming/<id>.<ext> or incoming/<id>.video.<ext>). */
  const startJob = (job: Job) => {
    patchJob(job.key, { pct: 0, err: undefined });
    const task = upload(`incoming/${job.id}${job.kind === "video" ? ".video" : ""}.${job.ext}`, job.file, {
      access: "public",
      handleUploadUrl: "/api/admin/upload",
      contentType: job.file.type || (job.kind === "video" ? "video/mp4" : "audio/mpeg"),
      multipart: job.file.size > 50 * 1024 * 1024,
      onUploadProgress: (p) => patchJob(job.key, { pct: Math.round(p.percentage) }),
    })
      .then((b) => patchJob(job.key, { url: b.url, pct: 100 }))
      .catch((e) => patchJob(job.key, { err: String((e as Error).message ?? e) }))
      .finally(() => delete running.current[job.key]);
    running.current[job.key] = task;
  };
  const addJob = (id: number, kind: Job["kind"], file: File) => {
    const job: Job = { key: jobKey(id, kind), id, kind, file, ext: extOf(file.name) || (kind === "video" ? "mp4" : "mp3"), pct: 0 };
    setJobs((j) => ({ ...j, [job.key]: job }));
    startJob(job);
  };
  const retryJob = (key: string) => {
    const job = jobsRef.current[key];
    if (job) startJob(job);
  };
  /** Drops a file (and deletes what was already uploaded); a new clip that had nothing else is dropped too. */
  const removeJob = (key: string) => {
    const job = jobsRef.current[key];
    if (!job) return;
    if (job.url) fetch("/api/admin/upload", { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: job.url }) }).catch(() => {});
    setJobs((j) => {
      const n = { ...j };
      delete n[key];
      return n;
    });
    setOv((o) => {
      if (!o) return o;
      const id = String(job.id);
      if (o.add[id] && !data?.lessons[id]) {
        const a = o.add[id];
        const left = job.kind === "audio" ? !!(a.vid || a.au) : !!(a.p || a.au || (a.vid && a.vid !== "file"));
        const add = { ...o.add };
        if (left) add[id] = job.kind === "audio" ? { ...a, p: 0 } : { ...a, vid: undefined };
        else delete add[id];
        return { ...o, add };
      }
      // an existing clip: undo «has audio» / «has video» that came with the file
      const e = { ...(o.edit[id] ?? {}) };
      if (job.kind === "audio") delete e.p;
      else delete e.vid;
      const edit = { ...o.edit };
      if (Object.keys(e).length) edit[id] = e;
      else delete edit[id];
      return { ...o, edit };
    });
  };

  const publish = async () => {
    if (!ov) return;
    try {
      // wait for files still uploading
      if (Object.keys(running.current).length) {
        setBusy(t("wiz.waitUploads"));
        await Promise.allSettled(Object.values(running.current));
      }
      const list = Object.values(jobsRef.current);
      if (list.some((j) => !j.url)) {
        toast.error(t("wiz.uploadsFailed"));
        return;
      }
      const uploads = list.map((j) => ({ id: j.id, url: j.url!, kind: j.kind, ext: j.ext }));
      setBusy(t("publishing"));
      const r = await fetch("/api/admin/save", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ overrides: ov, uploads }) });
      if (r.status === 401) return setPhase("login");
      if (!r.ok) throw new Error((await r.json().catch(() => ({}))).detail ?? r.status);
      setOrig(JSON.stringify(ov));
      setJobs({});
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
        {/* switching the language reloads the dashboard, so it waits until the edits are published */}
        <div
          onClickCapture={(e) => {
            if (pending && (e.target as HTMLElement).closest("[role^=menuitem]")) {
              e.preventDefault();
              e.stopPropagation();
              toast.error(t("unsaved"));
            }
          }}
        >
          <Suspense fallback={null}>
            <LocaleSwitcher />
          </Suspense>
        </div>
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
  const seriesOpts = [
    ...data.sheikhs.flatMap((sh) =>
      sh.series.flatMap((se) => (se.sections.length > 1 ? se.sections : [""]).map((sec) => [`${se.key}|${sec}`, `${se.title}${sec ? ` — ${sec}` : ""} (${sh.name})`] as const)),
    ),
    // series made from the dashboard
    ...ov.series.map((se) => [`${se.key}|`, `${se.title} (${shName(se.sheikh)})`] as const),
  ];
  const updateOv = (fn: (o: Overrides) => Overrides) => setOv((o) => (o ? fn(o) : o));
  const origOv = JSON.parse(orig) as Overrides;
  const addSheikhs = (list: { key: string; name: string }[]) =>
    setData((d) => (d ? { ...d, sheikhs: [...d.sheikhs, ...list.filter((s) => !d.sheikhs.some((x) => x.key === s.key)).map((s) => ({ key: s.key, name: s.name, series: [] }))] } : d));
  const ctx: Ctx = { t, tk, data, ov, setOv: updateOv, orig: origOv, publish, busy, jobs, addJob, removeJob, retryJob, eff, allIds, shName, seriesOpts, locale, setTab, addSheikhs };
  const tabs = [
    ["status", LayoutDashboard],
    ["list", Library],
    ["add", CirclePlus],
    ["series", ListOrdered],
    ["featured", Star],
    ["settings", Settings],
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
        {tab === "add" ? <AddWizard {...ctx} /> : null}
        {tab === "series" ? <SeriesView {...ctx} /> : null}
        {tab === "featured" ? <FeaturedView {...ctx} /> : null}
        {tab === "settings" ? <SettingsView {...ctx} /> : null}
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
    return !L.hidden && !(data.lessons[i] ?? ov.add[i])?.p && !(data.lessons[i] ?? ov.add[i])?.vid && !c.jobs[jobKey(i, "audio")];
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
      <Overview {...c} />
      <H2>{t("home.channel")}</H2>
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
        <Dropzone t={t} file={file} onPick={setFile} exts={AUDIO_EXT} mime="audio/*" maxMB={AUDIO_MAX_MB} label={t("wiz.dropAudio")} hint={t("wiz.dropAudioHint", { max: AUDIO_MAX_MB })} />
        <DialogFooter>
          <Button
            disabled={!file || !c.data.uploads}
            onClick={() => {
              c.addJob(id, "audio", file!);
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
  const [sf, setSf] = useState("");
  const [editing, setEditing] = useState<number | null>(null);
  const ids = useMemo(
    () =>
      allIds.filter((i) => {
        const L = eff(i);
        return (
          (!kf || L.k === kf || (kf === "hid" && L.hidden) || (kf === "ed" && (L.edited || L.isNew)) || (kf === "vid" && !!L.vid)) &&
          (!sf || L.s === sf) &&
          (!q || norm(`${i} ${L.t} ${shName(L.s)}`).includes(norm(q)))
        );
      }),
    [allIds, eff, kf, sf, q, shName],
  );
  const toggleHidden = (i: number) =>
    c.setOv((o) => {
      const id = String(i);
      const e = { ...(o.edit[id] ?? {}) };
      if (e.hidden) delete e.hidden;
      else e.hidden = true;
      const edit = { ...o.edit };
      if (Object.keys(e).length) edit[id] = e;
      else delete edit[id];
      return { ...o, edit };
    });
  const toggleFeatured = (i: number) => c.setOv((o) => ({ ...o, featured: o.featured.includes(i) ? o.featured.filter((x) => x !== i) : [i, ...o.featured] }));
  const chips: [string, string][] = [
    ["", t("filterAll")],
    ...TYPES.filter((x) => x.menu).map((x): [string, string] => [x.key, c.tk(x.key)]),
    ["vid", t("filterVideo")],
    ["ed", t("filterEdited")],
    ["hid", t("filterHidden")],
  ];
  return (
    <>
      <div className="mb-3 flex items-center gap-2 rounded-lg border bg-card px-3">
        <Search className="size-5 text-muted-foreground" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="h-11 flex-1 bg-transparent outline-none" />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <select value={sf} onChange={(e) => setSf(e.target.value)} className="h-8 rounded-full border bg-card px-3 text-sm font-semibold" aria-label={t("fieldSheikh")}>
          <option value="">{t("allSheikhs")}</option>
          {c.data.sheikhs.map((s) => (
            <option key={s.key} value={s.key}>
              {s.name}
            </option>
          ))}
        </select>
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
                  {L.vid ? <Video className="me-1.5 inline size-4 align-[-2px] text-primary" /> : null}
                  {L.t}
                  {L.isNew ? <Tag tone="new">{t("tagNew")}</Tag> : null}
                  {L.hidden ? <Tag tone="hid">{t("tagHidden")}</Tag> : L.edited ? <Tag tone="ed">{t("tagEdited")}</Tag> : null}
                </>
              }
              sub={`${shName(L.s)} · ${c.tk(L.k)}`}
            >
              {/* quick actions (the row itself opens the full edit) */}
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={c.ov.featured.includes(i) ? t("unfeature") : t("feature")}
                title={c.ov.featured.includes(i) ? t("unfeature") : t("feature")}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleFeatured(i);
                }}
              >
                <Star className={cn("size-4", c.ov.featured.includes(i) && "fill-highlight text-highlight")} />
              </Button>
              <Button
                size="icon-sm"
                variant="ghost"
                aria-label={L.hidden ? t("show") : t("hide")}
                title={L.hidden ? t("show") : t("hide")}
                onClick={(e) => {
                  e.stopPropagation();
                  toggleHidden(i);
                }}
              >
                {L.hidden ? <Eye className="size-4" /> : <EyeOff className="size-4" />}
              </Button>
            </Row>
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

function FeaturedView(c: Ctx) {
  const { t, ov, setOv, eff, data, shName } = c;
  const ids = ov.featured.filter((i) => data.lessons[i] || ov.add[i]);
  return (
    <>
      <H2>{t("tabs.featured")}</H2>
      <p className="mb-2 text-sm text-muted-foreground">{t("featuredHint")}</p>
      <Card>
        {ids.length ? (
          <Reorder
            items={ids}
            keyOf={(i) => i}
            onMove={(from, to) => setOv((o) => ({ ...o, featured: move(ids, from, to) }))}
            labels={{ up: t("moveUp"), down: t("moveDown"), drag: t("seriesView.drag") }}
            render={(i, n) => (
              <>
                <span className="min-w-7 text-center font-extrabold text-primary tabular-nums">{n + 1}</span>
                <span className="min-w-0 flex-1">
                  <b className="block truncate font-semibold">{eff(i).t}</b>
                  <small className="block truncate text-muted-foreground">{shName(eff(i).s)}</small>
                </span>
                <Button size="icon-sm" variant="ghost" aria-label={t("remove")} onClick={() => setOv((o) => ({ ...o, featured: o.featured.filter((x) => x !== i) }))}>
                  <Trash2 className="size-4 text-destructive" />
                </Button>
              </>
            )}
          />
        ) : (
          <p className="py-6 text-center text-muted-foreground">{t("noFeatured")}</p>
        )}
      </Card>
    </>
  );
}
