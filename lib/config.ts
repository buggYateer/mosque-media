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

const configSchema = z
  .object({
    name: z.string().min(1),
    shortName: z.string().optional(),
    description: z.string().optional(),
    domain: z.string().default(""),
    telegramChannel: z.string().min(1).transform((s) => s.replace(/^@|^https:\/\/t\.me\//g, "").replace(/\/$/, "")),
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
    storage: z
      .object({
        data: z.object({ provider: z.enum(["github-json"]) }),
        audio: z.object({ provider: z.enum(["github-releases"]) }),
      })
      .default({ data: { provider: "github-json" }, audio: { provider: "github-releases" } }),
    sheikhs: z.array(sheikhSchema),
    kinds: z.record(z.string(), z.array(z.string())).default({}),
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
