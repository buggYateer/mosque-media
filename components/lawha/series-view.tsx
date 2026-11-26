"use client";

/**
 * Series: pick one to rename it, put its lessons in order (drag, or the arrows), take lessons out,
 * or add lessons to it; or start a new series for a sheikh.
 */
import { CirclePlus, Minus, Plus, Search } from "lucide-react";
import { useState } from "react";
import { norm } from "@/lib/text";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, control, type Ctx, field, H2, Row } from "./parts";
import { move, Reorder } from "./reorder";

type S = { key: string; title: string; sheikh: string; libIds: number[]; firstSec: string; isNew: boolean };

export function SeriesView(c: Ctx) {
  const { t, data, ov, setOv, eff, allIds, shName } = c;
  const all: S[] = [
    ...data.sheikhs.flatMap((sh) => sh.series.map((se) => ({ key: se.key, title: se.title, sheikh: sh.key, libIds: se.ids, firstSec: se.sections.length > 1 ? se.sections[0] : "", isNew: false }))),
    ...ov.series.map((se) => ({ key: se.key, title: se.title, sheikh: se.sheikh, libIds: [], firstSec: "", isNew: true })),
  ];
  const [sel, setSel] = useState(all[0]?.key ?? "");
  const [newOpen, setNewOpen] = useState(false);
  const [nv, setNv] = useState({ title: "", sheikh: data.sheikhs[0]?.key ?? "" });
  const [q, setQ] = useState("");
  const cur = all.find((s) => s.key === sel);

  const titleOf = (s: S) => ov.seriesEdit[s.key]?.title ?? (s.isNew ? s.title : s.title);
  const inSeries = (i: number, key: string) => eff(i).series.split("|")[0] === key && !eff(i).hidden;
  /** the lessons of a series in the order they show: the admin's order, then the original order, then new ones */
  const members = (s: S) => {
    const ids = allIds.filter((i) => inSeries(i, s.key));
    const order = ov.seriesEdit[s.key]?.order ?? [];
    const base = [...order, ...s.libIds.filter((i) => !order.includes(i))];
    return [...base.filter((i) => ids.includes(i)), ...ids.filter((i) => !base.includes(i)).sort((a, b) => a - b)];
  };
  const setOrder = (s: S, ids: number[]) => setOv((o) => ({ ...o, seriesEdit: { ...o.seriesEdit, [s.key]: { ...o.seriesEdit[s.key], order: ids } } }));
  const setSeriesOf = (i: number, key: string, sec: string) =>
    setOv((o) => {
      const id = String(i);
      if (o.add[id] && !data.lessons[id]) return { ...o, add: { ...o.add, [id]: { ...o.add[id], series: key, sec } } };
      return { ...o, edit: { ...o.edit, [id]: { ...(o.edit[id] ?? {}), series: key, sec } } };
    });

  const createSeries = () => {
    if (!nv.title.trim() || !nv.sheikh) return;
    const key = `s-${Date.now().toString(36)}`;
    setOv((o) => ({ ...o, series: [...o.series, { key, title: nv.title.trim(), sheikh: nv.sheikh }] }));
    setSel(key);
    setNv({ ...nv, title: "" });
    setNewOpen(false);
  };

  const list = cur ? members(cur) : [];
  const candidates = cur && q.trim() ? allIds.filter((i) => !inSeries(i, cur.key) && !eff(i).hidden && norm(`${i} ${eff(i).t} ${shName(eff(i).s)}`).includes(norm(q))).slice(0, 12) : [];

  return (
    <div className="grid gap-5 md:grid-cols-[260px_1fr]">
      <div>
        <div className="mb-2 flex items-center justify-between">
          <h2 className="text-lg font-extrabold">{t("tabs.series")}</h2>
          <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setNewOpen((x) => !x)}>
            <CirclePlus className="size-4" />
            {t("seriesView.new")}
          </Button>
        </div>
        {newOpen ? (
          <div className="mb-3 flex flex-col gap-2 rounded-xl border bg-card p-3">
            <input className={control} autoFocus placeholder={t("seriesView.newTitle")} value={nv.title} onChange={(e) => setNv({ ...nv, title: e.target.value })} />
            <select className={control} value={nv.sheikh} onChange={(e) => setNv({ ...nv, sheikh: e.target.value })}>
              {data.sheikhs.map((s) => (
                <option key={s.key} value={s.key}>
                  {s.name}
                </option>
              ))}
            </select>
            <Button onClick={createSeries} disabled={!nv.title.trim()}>
              {t("seriesView.create")}
            </Button>
            <small className="text-muted-foreground">{t("seriesView.newHint")}</small>
          </div>
        ) : null}
        <Card>
          {all.length ? (
            all.map((s) => (
              <button key={s.key} onClick={() => setSel(s.key)} className={cn("block w-full border-b px-3.5 py-2.5 text-start last:border-b-0 hover:bg-muted/60", sel === s.key && "bg-accent")}>
                <b className="block truncate">{titleOf(s)}</b>
                <small className="text-muted-foreground">
                  {shName(s.sheikh)} · {t("seriesView.count", { n: members(s).length })}
                </small>
              </button>
            ))
          ) : (
            <p className="py-6 text-center text-muted-foreground">{t("seriesView.none")}</p>
          )}
        </Card>
      </div>

      {cur ? (
        <div>
          <label className={field}>
            {t("seriesView.title")}
            <input
              className={control}
              value={titleOf(cur)}
              onChange={(e) =>
                setOv((o) =>
                  cur.isNew
                    ? { ...o, series: o.series.map((x) => (x.key === cur.key ? { ...x, title: e.target.value } : x)) }
                    : { ...o, seriesEdit: { ...o.seriesEdit, [cur.key]: { ...o.seriesEdit[cur.key], title: e.target.value } } },
                )
              }
            />
          </label>
          <H2 extra={<small className="text-muted-foreground">{list.length}</small>}>{t("seriesView.lessons")}</H2>
          <p className="mb-2 text-sm text-muted-foreground">{t("seriesView.orderHint")}</p>
          <Card>
            {list.length ? (
              <Reorder
                items={list}
                keyOf={(i) => i}
                onMove={(from, to) => setOrder(cur, move(list, from, to))}
                labels={{ up: t("moveUp"), down: t("moveDown"), drag: t("seriesView.drag") }}
                render={(i, n) => (
                  <>
                    <span className="min-w-7 text-center font-extrabold text-primary tabular-nums">{n + 1}</span>
                    <span className="min-w-0 flex-1 truncate font-semibold">{eff(i).t}</span>
                    <Button size="icon-sm" variant="ghost" aria-label={t("seriesView.takeOut")} title={t("seriesView.takeOut")} onClick={() => setSeriesOf(i, "", "")}>
                      <Minus className="size-4 text-destructive" />
                    </Button>
                  </>
                )}
              />
            ) : (
              <p className="py-6 text-center text-muted-foreground">{t("seriesView.empty")}</p>
            )}
          </Card>

          <H2>{t("seriesView.addLessons")}</H2>
          <div className="mb-2 flex items-center gap-2 rounded-lg border bg-card px-3">
            <Search className="size-5 text-muted-foreground" />
            <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={t("searchPlaceholder")} className="h-11 flex-1 bg-transparent outline-none" />
          </div>
          {candidates.length ? (
            <Card>
              {candidates.map((i) => (
                <Row key={i} id={i} title={eff(i).t} sub={shName(eff(i).s)}>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setSeriesOf(i, cur.key, cur.firstSec)}>
                    <Plus className="size-4" />
                    {t("seriesView.add")}
                  </Button>
                </Row>
              ))}
            </Card>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
