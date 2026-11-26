/**
 * The storage contract. Pages and the dashboard only talk to these interfaces,
 * so a mosque can keep its data in JSON files on GitHub (default), Supabase,
 * Postgres, … without any change to the site code.
 *
 * To add a new provider: implement DataStore and/or AudioStore in a new file under
 * lib/storage/, register it in lib/storage/index.ts, and add its name to the
 * provider enum in lib/config.ts.
 */
import { z } from "zod";

/** The built-in content types. A site can add its own in site.config.json → types (see lib/site-shared.ts). */
export const KINDS = ["lesson", "khutba", "tilawa", "other"] as const;
/** A content type key: a built-in one or one from site.config.json. */
export type Kind = string;
const kindSchema = z.string().regex(/^[a-z][a-z0-9_-]*$/);

/** One recording. Short keys keep lessons.json small (it is produced by tools/build_data.py). */
export const lessonSchema = z.object({
  t: z.string(), // title
  s: z.string(), // sheikh key
  k: kindSchema, // content type
  d: z.string().default(""), // duration "m:ss" / "h:mm:ss"
  h: z.string().default(""), // hijri date "d-m-yyyy" or free text
  g: z.string().optional(), // gregorian date "yyyy-mm-dd"
  p: z.number().int().default(0), // number of audio parts available (0 = Telegram only)
  vid: z.string().optional(), // video: a YouTube / Facebook / Drive / direct link, or "file" (uploaded <id>.mp4) — see lib/media.ts
  au: z.string().optional(), // audio kept elsewhere: a direct link to the file
  n: z.number().int().optional(), // number inside a series
  v: z.number().int().optional(), // Telegram views
});
export type Lesson = z.infer<typeof lessonSchema>;

const sectionSchema = z.object({ t: z.string().default(""), ids: z.array(z.number().int()) });
const seriesSchema = z.object({ key: z.string(), title: z.string(), sections: z.array(sectionSchema) });

export const sheikhDataSchema = z.object({
  key: z.string(),
  name: z.string(),
  slug: z.string(),
  main: z.boolean().default(false),
  img: z.string().optional(),
  lesson: z.array(z.number().int()).default([]),
  khutba: z.array(z.number().int()).default([]),
  tilawa: z.array(z.number().int()).default([]),
  other: z.array(z.number().int()).default([]),
  series: z.array(seriesSchema).optional(),
  /** Loose recordings of this sheikh per content type (not in a series or a collection). Filled by applyOverrides. */
  byType: z.record(z.string(), z.array(z.number().int())).default({}),
});
export type SheikhData = z.infer<typeof sheikhDataSchema>;
export type Series = z.infer<typeof seriesSchema>;

export const librarySchema = z.object({
  channel: z.string(),
  audioBase: z.string(),
  demo: z.boolean().optional(),
  sheikhs: z.array(sheikhDataSchema),
  collections: z
    .array(z.object({ key: z.string(), title: z.string(), label: z.string().optional(), icon: z.string().optional(), ids: z.array(z.number().int()) }))
    .default([]),
  lessons: z.record(z.string(), lessonSchema),
});
export type Library = z.infer<typeof librarySchema>;

/** Edits made from the /lawha dashboard, applied on top of the library. */
export const overridesSchema = z.object({
  edit: z
    .record(
      z.string(),
      z.object({
        t: z.string().optional(),
        s: z.string().optional(),
        k: kindSchema.optional(),
        h: z.string().optional(),
        g: z.string().optional(),
        vid: z.string().optional(), // "" removes the video
        au: z.string().optional(), // "" removes the outside audio link
        hidden: z.boolean().optional(),
        series: z.string().optional(),
        sec: z.string().optional(),
        d: z.string().optional(),
        p: z.number().int().optional(), // audio uploaded from the dashboard
      }),
    )
    .default({}),
  add: z.record(z.string(), lessonSchema.extend({ series: z.string().optional(), sec: z.string().optional() })).default({}),
  featured: z.array(z.number().int()).default([]),
  ignore: z.array(z.number().int()).default([]),
  /** Series created from the dashboard (lessons join them with edit.series / add.series). */
  series: z.array(z.object({ key: z.string().regex(/^[\w-]+$/), title: z.string().min(1), sheikh: z.string() })).default([]),
});
export type Overrides = z.infer<typeof overridesSchema>;

export interface DataStore {
  /** Human-readable provider name, shown in the dashboard. */
  readonly name: string;
  getLibrary(): Promise<Library>;
  /** `fresh`: read the latest saved version (the dashboard), not the copy bundled with this deployment. */
  getOverrides(opts?: { fresh?: boolean }): Promise<Overrides>;
  /** Persist dashboard edits. `extraFiles` lets git-based stores commit audio pointers in the same commit. */
  saveOverrides(overrides: Overrides, message: string, extraFiles?: { path: string; content: string }[]): Promise<void>;
}

export interface AudioStore {
  readonly name: string;
  /** Public URL of one audio part (1-based). */
  audioUrl(id: number, part: number, lesson: Lesson): string;
  /** Public URL of a video uploaded to the store (<id>.mp4). */
  videoUrl(id: number): string;
}
