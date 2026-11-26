/**
 * Site configuration: everything mosque-specific comes from site.config.json.
 * It is validated here at build time, so a mistake fails the build with a clear
 * message instead of breaking the site for visitors.
 */
import { z } from "zod";
import raw from "@/site.config.json";

export const LOCALES = ["ar", "en", "ur", "hi", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const RTL_LOCALES: readonly Locale[] = ["ar", "ur"];

export const FONTS = ["Cairo", "Tajawal", "Almarai", "Noto Kufi Arabic", "Readex Pro", "El Messiri", "Changa", "Rubik"] as const;

/** Reserved identity of masjed-alhasany.vercel.app: other sites must look different. */
const RESERVED_COLORS = ["#2e3f6b", "#1e2a4a", "#cfa64a", "#a8832f", "#26365e"];
const RESERVED_FONTS = ["alexandria", "ibm plex sans arabic"];

const hex = z
  .string()
  .regex(/^#[0-9a-fA-F]{6}$/, "Colors must look like #0f766e")
  .refine((c) => !RESERVED_COLORS.some((r) => distance(c, r) < 40), {
    message: "This color is too close to another mosque's identity. Pick a color that represents your own mosque.",
  });

const sheikhSchema = z.object({
  key: z.string().min(1),
  name: z.string().min(1),
  aliases: z.array(z.string()).default([]),
  main: z.boolean().default(false),
  day: z.string().optional(),
  tone: z.number().int().min(1).default(1),
  slug: z.string().optional(),
});

/** The same text in every language, or one per language: "درس" or {"ar": "درس", "en": "Lesson"}. */
const textSchema = z.union([z.string().min(1), z.partialRecord(z.enum(LOCALES), z.string().min(1))]);

const typeSchema = z.object({
  key: z.string().regex(/^[a-z][a-z0-9_-]*$/, "A type key uses small English letters, numbers, - or _ (for example: lecture)"),
  name: textSchema.optional(),
  plural: textSchema.optional(),
  icon: z.string().optional(),
  words: z.array(z.string()).default([]),
  menu: z.boolean().optional(),
  surahs: z.boolean().optional(),
  default: z.boolean().optional(),
});

const configSchema = z
  .object({
    name: z.string().min(1),
    shortName: z.string().optional(),
    description: z.string().optional(),
    domain: z.string().default(""),
    /** Optional: the site works without a Telegram channel. */
    telegramChannel: z
      .string()
      .default("")
      .transform((s) => s.replace(/^@|^https:\/\/t\.me\//g, "").replace(/\/$/, "").trim()),
    githubRepo: z.string().min(3),
    audioBase: z.string().default(""),
    colors: z.object({
      primary: hex.default("#0f766e"),
      highlight: hex.default("#f59e0b"),
      background: hex.default("#f7f7f5"),
      tones: z.array(hex).min(1).default(["#0f766e", "#7c3aed", "#b45309", "#be123c"]),
    }),
    design: z.object({
      font: z
        .string()
        .refine((f) => !RESERVED_FONTS.includes(f.toLowerCase()), { message: "This font is reserved. Choose another one." })
        .pipe(z.enum(FONTS))
        .default("Cairo"),
      corners: z.enum(["sharp", "soft", "round"]).default("soft"),
      header: z.enum(["light", "colored"]).default("light"),
    }),
    i18n: z
      .object({ default: z.enum(LOCALES), locales: z.array(z.enum(LOCALES)).min(1) })
      .default({ default: "ar", locales: ["ar"] })
      .refine((i) => i.locales.includes(i.default), { message: "i18n.default must be one of i18n.locales" }),
    /** Where data and audio live. Secrets (DATABASE_URL, keys) go in environment variables, never here. */
    storage: z
      .object({
        data: z.object({ provider: z.enum(["github-json", "postgres", "sqlite"]) }),
        audio: z.discriminatedUnion("provider", [
          z.object({ provider: z.literal("github-releases") }),
          z.object({ provider: z.literal("s3"), publicBase: z.url() }),
        ]),
      })
      .default({ data: { provider: "github-json" }, audio: { provider: "github-releases" } }),
    sheikhs: z.array(sheikhSchema),
    /** Old way to set the words of the built-in types (still read). New sites use `types`. */
    kinds: z.record(z.string(), z.array(z.string())).default({}),
    /** The content types (lesson, sermon, recitation… or your own). Leave it out to keep the built-in ones. */
    types: z
      .array(typeSchema)
      .optional()
      .refine((t) => !t || new Set(t.map((x) => x.key)).size === t.length, { message: "Two types have the same key" })
      .refine((t) => !t || t.every((x) => ["lesson", "khutba", "tilawa", "other"].includes(x.key) || (x.name && x.plural)), {
        message: "A new type needs a name (one item) and a plural (the section title)",
      })
      .refine((t) => !t || t.length > 0, { message: "Add at least one type" }),
    /** How dates show on the site. */
    dates: z
      .object({
        calendar: z.enum(["hijri", "gregorian", "both", "none"]).default("hijri"),
        hijriOffset: z.number().int().min(-2).max(2).default(0),
      })
      .default({ calendar: "hijri", hijriOffset: 0 }),
    /** Which home sections show, in this order. */
    home: z.array(z.enum(["categories", "feature", "latestTilawat", "featured", "videos", "weekly", "latest", "popular", "series", "others"])).optional(),
    /** Video: which sources the dashboard accepts, and the largest video file that can be uploaded. */
    media: z
      .object({
        video: z.array(z.enum(["youtube", "facebook", "drive", "link", "file"])).default(["youtube", "facebook", "drive", "link", "file"]),
        maxUploadMB: z.number().int().min(10).max(2000).default(500),
      })
      .default({ video: ["youtube", "facebook", "drive", "link", "file"], maxUploadMB: 500 }),
    /** Change any wording of the site, per language: {"ar": {"common.sheikh": "الأستاذ"}}. Keys are in messages/<language>.json. */
    texts: z.partialRecord(z.enum(LOCALES), z.record(z.string(), z.string())).default({}),
    /** Words before a sheikh's name in captions, per language (used by tools/build_data.py). */
    sheikhPrefixes: z.array(z.string()).default(["الشيخ", "ش", "Sheikh", "Shaykh", "مولانا", "Шейх"]),
    collections: z
      .array(z.object({ key: z.string(), title: z.string(), label: z.string().optional(), icon: z.string().optional(), match: z.string().optional() }))
      .default([]),
  })
  .transform((c) => ({
    ...c,
    shortName: c.shortName || c.name,
    description: c.description || c.name,
    domain: c.domain.replace(/\/$/, ""),
    audioBase: (c.audioBase || `https://github.com/${c.githubRepo}/releases/download`).replace(/\/$/, ""),
  }));

export type SiteConfig = z.output<typeof configSchema>;
export type Sheikh = SiteConfig["sheikhs"][number];

/** Problems in a site.config.json (empty when it's fine) — used by the dashboard's settings screen. */
export function configProblems(value: unknown): string[] {
  const r = configSchema.safeParse(value);
  return r.success ? [] : r.error.issues.map((i) => `${i.path.join(".") || "(root)"}: ${i.message}`);
}

function parse(): SiteConfig {
  const r = configSchema.safeParse(raw);
  if (!r.success) {
    const lines = r.error.issues.map((i) => `  • site.config.json → ${i.path.join(".") || "(root)"}: ${i.message}`);
    throw new Error(`site.config.json has problems:\n${lines.join("\n")}`);
  }
  return r.data;
}

export const config: SiteConfig = parse();

function distance(a: string, b: string) {
  const ch = (h: string) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
  const [x, y] = [ch(a.toLowerCase()), ch(b)];
  return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]);
}
