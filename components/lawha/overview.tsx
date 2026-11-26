"use client";

/**
 * The top of the dashboard's home: quick numbers, every change not published yet (each can be
 * undone on its own), and files that were published but are still being converted / moved.
 */
import { CloudUpload, Hourglass, RefreshCw, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import type { Overrides } from "@/lib/storage/types";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, type Ctx, H2, Row } from "./parts";

type Change = { key: string; label: string; title: string; undo: (o: Overrides) => Overrides };

const same = (a: unknown, b: unknown) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);
const without = <T,>(rec: Record<string, T>, k: string) => {
  const n = { ...rec };
  delete n[k];
  return n;
};

/** What changed since the last publish, one line per clip / series / list. */
function changesOf(c: Ctx): Change[] {
  const { ov, orig, eff, t } = c;
  const out: Change[] = [];
  for (const id of new Set([...Object.keys(ov.add), ...Object.keys(orig.add)])) {
    if (same(ov.add[id], orig.add[id])) continue;
    const title = ov.add[id]?.t ?? orig.add[id]?.t ?? id;
    out.push({
      key: `add:${id}`,
      label: !orig.add[id] ? t("home.chNew") : !ov.add[id] ? t("home.chRemoved") : t("home.chEdited"),
      title,
      undo: (o) => ({ ...o, add: orig.add[id] ? { ...o.add, [id]: orig.add[id] } : without(o.add, id) }),
    });
  }
  for (const id of new Set([...Object.keys(ov.edit), ...Object.keys(orig.edit)])) {
    if (same(ov.edit[id], orig.edit[id])) continue;
    const hid = !!ov.edit[id]?.hidden !== !!orig.edit[id]?.hidden;
    out.push({
      key: `edit:${id}`,
      label: hid ? (ov.edit[id]?.hidden ? t("home.chHidden") : t("home.chShown")) : t("home.chEdited"),
      title: eff(Number(id)).t,
      undo: (o) => ({ ...o, edit: orig.edit[id] ? { ...o.edit, [id]: orig.edit[id] } : without(o.edit, id) }),
    });
  }
  for (const se of ov.series)
    if (!orig.series.some((x) => x.key === se.key)) out.push({ key: `series:${se.key}`, label: t("home.chSeries"), title: se.title, undo: (o) => ({ ...o, series: o.series.filter((x) => x.key !== se.key) }) });
  for (const k of new Set([...Object.keys(ov.seriesEdit), ...Object.keys(orig.seriesEdit)]))
    if (!same(ov.seriesEdit[k], orig.seriesEdit[k]))
      out.push({
        key: `seriesEdit:${k}`,
        label: t("home.chSeriesEdit"),
        title: ov.seriesEdit[k]?.title ?? c.data.sheikhs.flatMap((s) => s.series).find((s) => s.key === k)?.title ?? ov.series.find((s) => s.key === k)?.title ?? k,
        undo: (o) => ({ ...o, seriesEdit: orig.seriesEdit[k] ? { ...o.seriesEdit, [k]: orig.seriesEdit[k] } : without(o.seriesEdit, k) }),
      });
  if (!same(ov.featured, orig.featured)) out.push({ key: "featured", label: t("home.chFeatured"), title: "", undo: (o) => ({ ...o, featured: orig.featured }) });
  if (!same(ov.ignore, orig.ignore)) out.push({ key: "ignore", label: t("home.chIgnored"), title: "", undo: (o) => ({ ...o, ignore: orig.ignore }) });
  return out;
}

export function Overview(c: Ctx) {
  const { t, eff, allIds, setOv, jobs, publish, busy } = c;
  const changes = changesOf(c);
  const files = Object.values(jobs);
  const visible = allIds.filter((i) => !eff(i).hidden);
  const stats = [
    [t("home.clips"), visible.length],
    [t("home.videos"), visible.filter((i) => eff(i).vid).length],
    [t("home.hidden"), allIds.length - visible.length],
    [t("home.series"), new Set(c.seriesOpts.map(([k]) => k.split("|")[0])).size],
  ] as const;

  // files published earlier that GitHub is still converting / moving
  const [pending, setPending] = useState<{ id: number; kind: string }[] | null>(null);
  const check = useCallback(() => {
    setPending(null);
    fetch("/api/admin/incoming")
      .then((r) => r.json())
      .then((j) => setPending(j.pending ?? []))
      .catch(() => setPending([]));
  }, []);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- ask once when the screen opens
  useEffect(() => check(), [check]);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {stats.map(([label, n]) => (
          <div key={label} className="flex flex-col rounded-xl border bg-card p-4">
            <small className="text-muted-foreground">{label}</small>
            <b className="text-2xl font-extrabold tabular-nums">{n}</b>
          </div>
        ))}
      </div>

      <H2
        extra={
          changes.length || files.length ? (
            <Button onClick={publish} disabled={!!busy} className="gap-1.5 font-bold">
              <CloudUpload className="size-4" />
              {busy || t("publish")}
            </Button>
          ) : null
        }
      >
        {t("home.unpublished")}
      </H2>
      <Card>
        {changes.length || files.length ? (
          <>
            {changes.map((ch) => (
              <Row key={ch.key} id={ch.label} title={ch.title || ch.label} sub={ch.title ? undefined : t("home.listChange")}>
                <Button
                  size="sm"
                  variant="outline"
                  className="gap-1.5"
                  onClick={() => {
                    setOv(ch.undo);
                    // a new clip that is undone takes its files with it
                    if (ch.key.startsWith("add:") && !c.orig.add[ch.key.slice(4)]) for (const j of files) if (String(j.id) === ch.key.slice(4)) c.removeJob(j.key);
                  }}
                >
                  <Undo2 className="size-4" />
                  {t("home.undo")}
                </Button>
              </Row>
            ))}
            {files.map((j) => (
              <Row key={j.key} id={j.id} title={eff(j.id).t} sub={j.err ? t("wiz.uploadFailed") : j.url ? t("wiz.uploaded") : t("wiz.uploading", { pct: j.pct })} />
            ))}
          </>
        ) : (
          <p className="py-6 text-center text-muted-foreground">{t("home.nothing")}</p>
        )}
      </Card>

      {pending === null || pending.length ? (
        <>
          <H2
            extra={
              <Button size="sm" variant="outline" className="gap-1.5" onClick={check}>
                <RefreshCw className={cn("size-4", pending === null && "animate-spin")} />
                {t("refresh")}
              </Button>
            }
          >
            {t("home.processing")}
          </H2>
          <p className="mb-2 text-sm text-muted-foreground">{t("home.processingHint")}</p>
          <Card>
            {(pending ?? []).map((p) => (
              <Row key={`${p.id}:${p.kind}`} id={p.id} title={eff(p.id).t || String(p.id)} sub={p.kind === "video" ? t("home.processingVideo") : t("home.processingAudio")}>
                <Hourglass className="size-4 text-muted-foreground" />
              </Row>
            ))}
            {pending === null ? <p className="py-4 text-center text-sm text-muted-foreground">{t("searching")}</p> : null}
          </Card>
        </>
      ) : null}
    </>
  );
}
