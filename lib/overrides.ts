/**
 * Applies dashboard edits (overrides) on top of the library built from the Telegram channel.
 * Same rules as the original site: edit / hide / move to a series / add a new clip / featured.
 * Pure function: returns a new library and never mutates its input.
 */
import { CONFIG_SHEIKHS, DEFAULT_TYPE, sheikhSlug, TYPE_KEYS } from "./site-shared";
import { KINDS, type Library, type Overrides } from "./storage/types";

export type Site = Library & { featured: number[] };

export function applyOverrides(source: Library, o: Overrides): Site {
  const lib: Library = structuredClone(source);
  const allSeries = () => lib.sheikhs.flatMap((sh) => (sh.series ?? []).map((se) => ({ se, sh })));
  const dropEverywhere = (id: number, keepSeries = false) => {
    for (const sh of lib.sheikhs) {
      for (const k of KINDS) sh[k] = sh[k].filter((x) => x !== id);
      if (!keepSeries) for (const se of sh.series ?? []) for (const sec of se.sections) sec.ids = sec.ids.filter((x) => x !== id);
    }
  };

  // a sheikh added from the dashboard settings: not in the library until a clip of theirs is (added below, dropped at the end if none)
  const fromConfig = new Set<string>();
  for (const c of CONFIG_SHEIKHS) {
    if (lib.sheikhs.some((x) => x.key === c.key)) continue;
    let slug = c.slug || sheikhSlug(c.key);
    while (lib.sheikhs.some((x) => x.slug === slug)) slug += "-2";
    lib.sheikhs.push({ key: c.key, name: c.name, slug, main: c.main, lesson: [], khutba: [], tilawa: [], other: [], byType: {} });
    fromConfig.add(c.key);
  }

  // series created from the dashboard (empty ones are dropped at the end)
  for (const ns of o.series) {
    const sh = lib.sheikhs.find((x) => x.key === ns.sheikh);
    if (sh && !allSeries().some(({ se }) => se.key === ns.key)) (sh.series ??= []).push({ key: ns.key, title: ns.title, sections: [{ t: "", ids: [] }] });
  }

  const entries = [
    ...Object.entries(o.add).map(([k, v]) => ({ k, e: v as Overrides["edit"][string] & Partial<Library["lessons"][string]>, isNew: true })),
    ...Object.entries(o.edit).map(([k, v]) => ({ k, e: v as Overrides["edit"][string] & Partial<Library["lessons"][string]>, isNew: false })),
  ];
  for (const { k, e, isNew } of entries) {
    const id = Number(k);
    if (isNew && !lib.lessons[k]) lib.lessons[k] = { t: e.t ?? "", s: e.s ?? "", k: e.k ?? DEFAULT_TYPE, h: e.h ?? "", d: e.d ?? "", p: e.p ?? 0 };
    // a new clip with only a video or an outside audio link still counts as a clip
    const L = lib.lessons[k];
    if (!L) continue;
    if (e.hidden) {
      delete lib.lessons[k];
      dropEverywhere(id);
      for (const c of lib.collections) c.ids = c.ids.filter((x) => x !== id);
      continue;
    }
    for (const f of ["t", "s", "k", "h", "g", "d", "p"] as const) {
      const v = e[f];
      if (v !== undefined && v !== "") (L as Record<string, unknown>)[f] = v;
    }
    // video / outside audio: an empty value removes it
    for (const f of ["vid", "au"] as const) {
      const v = e[f];
      if (v === "") delete L[f];
      else if (v !== undefined) L[f] = v;
    }
    if (e.series !== undefined) {
      dropEverywhere(id);
      const hit = allSeries().find(({ se }) => se.key === e.series);
      if (hit) {
        let sec = hit.se.sections.find((x) => (x.t || "") === (e.sec || "")) ?? hit.se.sections[0];
        if (!sec) {
          sec = { t: e.sec ?? "", ids: [] };
          hit.se.sections.push(sec);
        }
        sec.ids.push(id);
        sec.ids.sort((a, b) => a - b);
      }
    } else dropEverywhere(id, true);
  }

  // A type that was removed from site.config.json falls back to the default type.
  for (const L of Object.values(lib.lessons)) if (!TYPE_KEYS.includes(L.k)) L.k = DEFAULT_TYPE;
  // Each sheikh's loose recordings per type (anything not in a series or a collection).
  const inSeriesSet = new Set(allSeries().flatMap(({ se }) => se.sections.flatMap((x) => x.ids)));
  const inColl = new Set(lib.collections.flatMap((c) => c.ids));
  const byKey = new Map(lib.sheikhs.map((sh) => [sh.key, sh]));
  for (const sh of lib.sheikhs) sh.byType = {};
  for (const id of Object.keys(lib.lessons).map(Number).sort((a, b) => a - b)) {
    const L = lib.lessons[String(id)];
    const sh = byKey.get(L.s);
    if (sh && !inSeriesSet.has(id) && !inColl.has(id)) (sh.byType[L.k] ??= []).push(id);
  }
  // renamed series, and lessons in the order the admin chose (ones not listed keep their place after them)
  for (const { se } of allSeries()) {
    const e = o.seriesEdit[se.key];
    if (!e) continue;
    if (e.title) se.title = e.title;
    if (e.order?.length) {
      const all = se.sections.flatMap((x) => x.ids);
      const first = e.order.filter((id) => all.includes(id));
      const rest = all.filter((id) => !first.includes(id));
      // one section: just reorder it; several sections: reorder inside each one
      for (const sec of se.sections) {
        const mine = new Set(sec.ids);
        sec.ids = [...first.filter((id) => mine.has(id)), ...rest.filter((id) => mine.has(id))];
      }
    }
  }
  // a series with no lessons left doesn't show
  for (const sh of lib.sheikhs) if (sh.series) sh.series = sh.series.filter((se) => se.sections.some((x) => x.ids.length));
  // a sheikh from the settings with no clips yet (and not a weekly-lesson sheikh) doesn't show
  lib.sheikhs = lib.sheikhs.filter((sh) => !fromConfig.has(sh.key) || sh.main || Object.values(lib.lessons).some((L) => L.s === sh.key));
  return { ...lib, featured: o.featured.filter((i) => lib.lessons[i]) };
}
