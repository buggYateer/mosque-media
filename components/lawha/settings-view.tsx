"use client";

/**
 * Settings: the parts of site.config.json a mosque changes most (dates, wording, content types,
 * home sections, sheikhs, video), without opening the file. Saving checks everything with the same
 * rules as the build, then commits site.config.json; Vercel rebuilds the site in a minute or two.
 * Settings are saved on their own (not with «Publish changes»).
 */
import { CirclePlus, Save, Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { ICONS, iconFor } from "@/components/icons";
import { HOME_SECTIONS } from "@/lib/site-shared";
import { cn } from "@/lib/utils";
import { Button } from "../ui/button";
import { Card, control, type Ctx, field, H2 } from "./parts";
import { move, Reorder } from "./reorder";

type Text = string | Record<string, string>;
type TypeCfg = { key: string; name?: Text; plural?: Text; icon?: string; words?: string[]; menu?: boolean; surahs?: boolean; default?: boolean };
type SheikhCfg = { key: string; name: string; aliases?: string[]; main?: boolean; day?: string; tone?: number; slug?: string };
type Cfg = Record<string, unknown> & {
  i18n?: { default?: string; locales?: string[] };
  dates?: { calendar?: string; hijriOffset?: number };
  texts?: Record<string, Record<string, string>>;
  types?: TypeCfg[];
  home?: string[];
  sheikhs?: SheikhCfg[];
  media?: { video?: string[]; maxUploadMB?: number };
  colors?: { tones?: string[] };
};

const BUILTIN = ["tilawa", "lesson", "khutba", "other"];
const TYPE_ICONS = ["lesson", "tilawa", "khutba", "other", "book", "book-open", "quran", "mic", "audio", "video", "school", "child", "users", "talk", "heart", "charity", "star", "sparkles", "idea", "mosque", "moon", "sun"].filter((k) => k in ICONS);
const SOURCES = ["youtube", "facebook", "drive", "link", "file"];
const OTHERS_KEYS = ["nav.others", "home.others", "pages.others.title"];

const textOf = (x: Text | undefined, lang: string) => (typeof x === "string" ? x : (x?.[lang] ?? ""));
/** Sets the text for one language; a text that was the same in every language stays that way. */
const withText = (x: Text | undefined, lang: string, v: string): Text | undefined => {
  if (typeof x === "object") {
    const n = { ...x, [lang]: v };
    if (!v) delete n[lang];
    return Object.keys(n).length ? n : undefined;
  }
  return v || undefined;
};
const list = (s: string) =>
  s
    .split(/[,،]/)
    .map((x) => x.trim())
    .filter(Boolean);

export function SettingsView(c: Ctx) {
  const { t, addSheikhs } = c;
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const [before, setBefore] = useState<Cfg | null>(null);
  const [cfg, setCfg] = useState<Cfg | null>(null);
  const [canSave, setCanSave] = useState(false);
  const [why, setWhy] = useState("");
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [newType, setNewType] = useState({ key: "", name: "", plural: "" });
  const [newSheikh, setNewSheikh] = useState("");

  const load = () =>
    fetch("/api/admin/settings")
      .then((r) => r.json())
      .then((j) => {
        if (!j.config) throw new Error(j.detail ?? j.error);
        setBefore(j.config);
        setCfg(structuredClone(j.config));
        setCanSave(!!j.canSave);
        setWhy(j.detail ?? "");
        setProblems([]);
      })
      .catch((e) => {
        setWhy(String((e as Error).message ?? e));
        toast.error(t("settings.loadFailed"));
      });
  useEffect(() => {
    load();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (!cfg) return <p className="py-10 text-center text-muted-foreground">{why ? `${t("settings.loadFailed")}: ${why}` : t("loading")}</p>;
  const lang = cfg.i18n?.default ?? "ar";
  const set = (fn: (x: Cfg) => Cfg) => setCfg((x) => (x ? fn(structuredClone(x)) : x));
  const types: TypeCfg[] = cfg.types?.length ? cfg.types : BUILTIN.map((key) => ({ key }));
  const setTypes = (fn: (x: TypeCfg[]) => TypeCfg[]) => set((x) => ({ ...x, types: fn(x.types?.length ? x.types : BUILTIN.map((key) => ({ key }))) }));
  const texts = cfg.texts?.[lang] ?? {};
  const setText = (keys: string[], v: string) =>
    set((x) => {
      const all = { ...(x.texts ?? {}) };
      const mine = { ...(all[lang] ?? {}) };
      for (const k of keys) {
        if (v.trim()) mine[k] = v.trim();
        else delete mine[k];
      }
      all[lang] = mine;
      return { ...x, texts: all };
    });
  const homeOn = cfg.home?.length ? cfg.home : [...HOME_SECTIONS];
  const homeRows = [...homeOn, ...HOME_SECTIONS.filter((k) => !homeOn.includes(k))].map((key) => ({ key, on: homeOn.includes(key) }));
  const setHome = (rows: { key: string; on: boolean }[]) => set((x) => ({ ...x, home: rows.filter((r) => r.on).map((r) => r.key) }));
  const sheikhs = cfg.sheikhs ?? [];
  const setSheikh = (i: number, p: Partial<SheikhCfg>) => set((x) => ({ ...x, sheikhs: (x.sheikhs ?? []).map((s, k) => (k === i ? { ...s, ...p } : s)) }));
  const video = cfg.media?.video ?? SOURCES;
  const changed = JSON.stringify(cfg) !== JSON.stringify(before);

  const save = async () => {
    setSaving(true);
    setProblems([]);
    const r = await fetch("/api/admin/settings", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ config: cfg, before }) }).catch(() => null);
    setSaving(false);
    const j = r ? await r.json().catch(() => ({})) : {};
    if (r?.ok) {
      setBefore(structuredClone(cfg));
      addSheikhs(cfg.sheikhs ?? []);
      return toast.success(t("settings.saved"));
    }
    if (r?.status === 409) return toast.error(t("settings.changedElsewhere"));
    if (j.problems) return setProblems(j.problems);
    toast.error(t("settings.saveFailed", { detail: j.detail ?? j.error ?? r?.status ?? "" }));
  };

  const section = "flex flex-col gap-3 rounded-xl border bg-card p-4";
  return (
    <div className="flex flex-col gap-2">
      <p className="text-sm text-muted-foreground">{t("settings.intro")}</p>
      {!canSave ? (
        <p className="rounded-lg bg-muted p-3 text-sm">
          {why ? t("settings.githubFailed", { detail: why }) : t("settings.cantSave")}
        </p>
      ) : null}

      <H2>{t("settings.dates")}</H2>
      <div className={section}>
        <div className="flex flex-wrap gap-2">
          {(["hijri", "gregorian", "both", "none"] as const).map((k) => (
            <button
              key={k}
              onClick={() => set((x) => ({ ...x, dates: { ...x.dates, calendar: k } }))}
              className={cn("rounded-full border px-3.5 py-1.5 text-sm font-semibold", (cfg.dates?.calendar ?? "hijri") === k ? "border-primary bg-primary text-primary-foreground" : "bg-background")}
            >
              {t(`settings.cal.${k}`)}
            </button>
          ))}
        </div>
        <label className={cn(field, "max-w-xs")}>
          {t("settings.hijriOffset")}
          <select className={control} value={cfg.dates?.hijriOffset ?? 0} onChange={(e) => set((x) => ({ ...x, dates: { ...x.dates, hijriOffset: Number(e.target.value) } }))}>
            {[-2, -1, 0, 1, 2].map((n) => (
              <option key={n} value={n}>
                {n > 0 ? `+${n}` : n}
              </option>
            ))}
          </select>
        </label>
      </div>

      <H2>{t("settings.words")}</H2>
      <div className={cn(section, "sm:grid sm:grid-cols-2")}>
        <label className={field}>
          {t("settings.personTitle")}
          <input className={control} placeholder={tc("sheikh")} value={texts["common.sheikh"] ?? ""} onChange={(e) => setText(["common.sheikh"], e.target.value)} />
          <small className="font-normal">{t("settings.personTitleHint")}</small>
        </label>
        <label className={field}>
          {t("settings.othersName")}
          <input className={control} placeholder={tn("others")} value={texts["home.others"] ?? ""} onChange={(e) => setText(OTHERS_KEYS, e.target.value)} />
        </label>
        <small className="text-muted-foreground sm:col-span-2">{t("settings.wordsHint")}</small>
      </div>

      <H2>{t("settings.types")}</H2>
      <p className="text-sm text-muted-foreground">{t("settings.typesHint")}</p>
      <Card>
        <Reorder
          items={types}
          keyOf={(x) => x.key}
          onMove={(from, to) => setTypes((x) => move(x, from, to))}
          labels={{ up: t("moveUp"), down: t("moveDown"), drag: t("seriesView.drag") }}
          render={(ty, i) => {
            const Icon = iconFor(ty.icon ?? ty.key);
            const upd = (p: Partial<TypeCfg>) => setTypes((x) => x.map((y, k) => (k === i ? { ...y, ...p } : y)));
            return (
              <div className="grid w-full gap-2 py-1 sm:grid-cols-[auto_1fr_1fr_1fr_auto]">
                <span className="flex items-center gap-1.5">
                  <Icon className="size-5 text-primary" />
                  <select className="h-9 rounded-lg border bg-background px-1 text-sm" value={ty.icon ?? ty.key} onChange={(e) => upd({ icon: e.target.value })} aria-label={t("settings.icon")}>
                    {TYPE_ICONS.map((k) => (
                      <option key={k} value={k}>
                        {k}
                      </option>
                    ))}
                  </select>
                </span>
                <input className={cn(control, "h-9")} placeholder={BUILTIN.includes(ty.key) ? c.tk(ty.key) : t("settings.typeName")} value={textOf(ty.name, lang)} onChange={(e) => upd({ name: withText(ty.name, lang, e.target.value) })} aria-label={t("settings.typeName")} />
                <input className={cn(control, "h-9")} placeholder={BUILTIN.includes(ty.key) ? t("settings.samePlural") : t("settings.typePlural")} value={textOf(ty.plural, lang)} onChange={(e) => upd({ plural: withText(ty.plural, lang, e.target.value) })} aria-label={t("settings.typePlural")} />
                <input className={cn(control, "h-9")} placeholder={t("settings.typeWords")} value={(ty.words ?? []).join("، ")} onChange={(e) => upd({ words: list(e.target.value) })} aria-label={t("settings.typeWords")} />
                <span className="flex items-center gap-2">
                  <label className="flex items-center gap-1 text-xs whitespace-nowrap">
                    <input type="checkbox" checked={ty.menu ?? ty.key !== "other"} onChange={(e) => upd({ menu: e.target.checked })} />
                    {t("settings.inMenu")}
                  </label>
                  <Button size="icon-sm" variant="ghost" aria-label={t("remove")} disabled={types.length < 2} onClick={() => setTypes((x) => x.filter((_, k) => k !== i))}>
                    <Trash2 className="size-4 text-destructive" />
                  </Button>
                </span>
              </div>
            );
          }}
        />
      </Card>
      <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed p-3">
        <label className={field}>
          {t("settings.typeKey")}
          <input className={cn(control, "h-9 w-36")} dir="ltr" placeholder="lecture" value={newType.key} onChange={(e) => setNewType({ ...newType, key: e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, "") })} />
        </label>
        <label className={field}>
          {t("settings.typeName")}
          <input className={cn(control, "h-9")} value={newType.name} onChange={(e) => setNewType({ ...newType, name: e.target.value })} />
        </label>
        <label className={field}>
          {t("settings.typePlural")}
          <input className={cn(control, "h-9")} value={newType.plural} onChange={(e) => setNewType({ ...newType, plural: e.target.value })} />
        </label>
        <Button
          variant="outline"
          className="h-9 gap-1.5"
          disabled={!/^[a-z][a-z0-9_-]*$/.test(newType.key) || !newType.name.trim() || !newType.plural.trim() || types.some((x) => x.key === newType.key)}
          onClick={() => {
            setTypes((x) => [...x, { key: newType.key, name: { [lang]: newType.name.trim() }, plural: { [lang]: newType.plural.trim() }, icon: "book", words: [] }]);
            setNewType({ key: "", name: "", plural: "" });
          }}
        >
          <CirclePlus className="size-4" />
          {t("settings.addType")}
        </Button>
      </div>

      <H2>{t("settings.home")}</H2>
      <p className="text-sm text-muted-foreground">{t("settings.homeHint")}</p>
      <Card>
        <Reorder
          items={homeRows}
          keyOf={(x) => x.key}
          onMove={(from, to) => setHome(move(homeRows, from, to))}
          labels={{ up: t("moveUp"), down: t("moveDown"), drag: t("seriesView.drag") }}
          render={(r, i) => (
            <label className="flex flex-1 items-center gap-2 font-semibold">
              <input type="checkbox" checked={r.on} onChange={(e) => setHome(homeRows.map((x, k) => (k === i ? { ...x, on: e.target.checked } : x)))} />
              <span className={cn(!r.on && "text-muted-foreground line-through")}>{t(`settings.sec.${r.key}`)}</span>
            </label>
          )}
        />
      </Card>

      <H2>{t("settings.sheikhs")}</H2>
      <p className="text-sm text-muted-foreground">{t("settings.sheikhsHint")}</p>
      <Card>
        {sheikhs.map((s, i) => (
          <div key={s.key} className="grid gap-2 border-b p-3 last:border-b-0 sm:grid-cols-[1.2fr_1.2fr_auto_1fr]">
            <input className={cn(control, "h-9")} value={s.name} onChange={(e) => setSheikh(i, { name: e.target.value })} aria-label={t("settings.sheikhName")} />
            <input className={cn(control, "h-9")} placeholder={t("settings.aliases")} value={(s.aliases ?? []).join("، ")} onChange={(e) => setSheikh(i, { aliases: list(e.target.value) })} aria-label={t("settings.aliases")} />
            <label className="flex items-center gap-1.5 text-sm font-semibold whitespace-nowrap">
              <input type="checkbox" checked={!!s.main} onChange={(e) => setSheikh(i, { main: e.target.checked })} />
              {t("settings.weekly")}
            </label>
            <input className={cn(control, "h-9")} placeholder={t("settings.day")} disabled={!s.main} value={s.day ?? ""} onChange={(e) => setSheikh(i, { day: e.target.value || undefined })} aria-label={t("settings.day")} />
          </div>
        ))}
      </Card>
      <div className="flex gap-2">
        <input className={cn(control, "h-9")} placeholder={t("settings.newSheikh")} value={newSheikh} onChange={(e) => setNewSheikh(e.target.value)} />
        <Button
          variant="outline"
          className="h-9 shrink-0 gap-1.5"
          disabled={!newSheikh.trim() || sheikhs.some((s) => s.name === newSheikh.trim())}
          onClick={() => {
            const name = newSheikh.trim().replace(/^(الشيخ|ش\.?)\s+/, "");
            const tones = cfg.colors?.tones?.length ?? 4;
            set((x) => ({ ...x, sheikhs: [...(x.sheikhs ?? []), { key: name.replace(/\s+/g, "_"), name, main: false, tone: ((x.sheikhs ?? []).length % tones) + 1 }] }));
            setNewSheikh("");
          }}
        >
          <CirclePlus className="size-4" />
          {t("settings.addSheikh")}
        </Button>
      </div>
      {sheikhs.some((s) => !c.data.sheikhs.some((x) => x.key === s.key)) ? <p className="text-sm text-muted-foreground">{t("settings.newSheikhSave")}</p> : null}

      <H2>{t("settings.video")}</H2>
      <div className={section}>
        <div className="flex flex-wrap gap-3">
          {SOURCES.map((k) => (
            <label key={k} className="flex items-center gap-1.5 text-sm font-semibold">
              <input
                type="checkbox"
                checked={video.includes(k)}
                onChange={(e) => set((x) => ({ ...x, media: { ...x.media, video: e.target.checked ? [...video, k] : video.filter((v) => v !== k) } }))}
              />
              {t(`sourceName.${k}`)}
            </label>
          ))}
        </div>
        <label className={cn(field, "max-w-xs")}>
          {t("settings.maxUpload")}
          <input
            className={control}
            type="number"
            min={10}
            max={2000}
            value={cfg.media?.maxUploadMB ?? 500}
            onChange={(e) => set((x) => ({ ...x, media: { ...x.media, maxUploadMB: Math.round(Number(e.target.value) || 0) } }))}
          />
        </label>
      </div>

      {problems.length ? (
        <div className="mt-3 rounded-xl border border-destructive bg-card p-3 text-sm text-destructive">
          <b>{t("settings.problems")}</b>
          <ul className="mt-1 list-inside list-disc" dir="ltr">
            {problems.map((p) => (
              <li key={p}>{p}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {/* stays in view while scrolling */}
      <div className="sticky bottom-3 mt-3 flex items-center gap-3 rounded-xl border bg-card/95 p-3 shadow-lg backdrop-blur">
        <Button onClick={save} disabled={!changed || saving || !canSave} className="gap-1.5 font-bold">
          <Save className="size-4" />
          {saving ? t("settings.saving") : t("settings.save")}
        </Button>
        {changed ? (
          <Button variant="ghost" onClick={() => setCfg(structuredClone(before))}>
            {t("settings.discard")}
          </Button>
        ) : null}
        <small className="text-muted-foreground">{changed ? t("settings.unsaved") : t("settings.rebuildHint")}</small>
      </div>
    </div>
  );
}
