/**
 * Maps site.config.json colors/design to the CSS variables used by Tailwind + shadcn/ui.
 * Light mode uses the mosque's colors; dark mode keeps neutral dark surfaces and a
 * lighter version of the primary color for contrast.
 */
import type { SiteConfig } from "./config";

const RADIUS = { sharp: "0.25rem", soft: "0.75rem", round: "1.375rem" } as const;

function rgb(h: string) {
  return [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
}

/** Readable text color (white or near-black) on top of a background color. */
function onColor(h: string) {
  const [r, g, b] = rgb(h).map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return lum > 0.45 ? "#111111" : "#ffffff";
}

const mix = (a: string, b: string, pct: number) => `color-mix(in oklch, ${a} ${pct}%, ${b})`;

export function themeCss(config: SiteConfig): string {
  const { primary, highlight, background, tones } = config.colors;
  const light: Record<string, string> = {
    "--background": background,
    "--foreground": "#1c1c1c",
    "--card": "#ffffff",
    "--card-foreground": "#1c1c1c",
    "--popover": "#ffffff",
    "--popover-foreground": "#1c1c1c",
    "--primary": primary,
    "--primary-foreground": onColor(primary),
    "--secondary": mix(primary, "#ffffff", 10),
    "--secondary-foreground": mix(primary, "#000000", 80),
    "--muted": mix(background, "#000000", 96),
    "--muted-foreground": "#6b6b6b",
    "--accent": mix(primary, "#ffffff", 12),
    "--accent-foreground": mix(primary, "#000000", 85),
    "--highlight": highlight,
    "--highlight-foreground": onColor(highlight),
    "--border": "#e4e4e0",
    "--input": "#e4e4e0",
    "--ring": primary,
    "--radius": RADIUS[config.design.corners],
    "--header": config.design.header === "colored" ? primary : "#ffffff",
    "--header-foreground": config.design.header === "colored" ? onColor(primary) : "#1c1c1c",
  };
  const dark: Record<string, string> = {
    "--background": "#121314",
    "--foreground": "#ececec",
    "--card": "#1b1c1e",
    "--card-foreground": "#ececec",
    "--popover": "#1b1c1e",
    "--popover-foreground": "#ececec",
    "--primary": mix(primary, "#ffffff", 70),
    "--primary-foreground": "#111111",
    "--secondary": mix(primary, "#1b1c1e", 25),
    "--secondary-foreground": "#ececec",
    "--muted": "#232427",
    "--muted-foreground": "#a3a3a3",
    "--accent": mix(primary, "#1b1c1e", 25),
    "--accent-foreground": "#ececec",
    "--border": "#2e2f33",
    "--input": "#2e2f33",
    "--ring": mix(primary, "#ffffff", 70),
    "--header": "#1b1c1e",
    "--header-foreground": "#ececec",
  };
  tones.forEach((t, i) => {
    light[`--tone-${i + 1}`] = t;
  });
  const block = (sel: string, vars: Record<string, string>) =>
    `${sel}{${Object.entries(vars)
      .map(([k, v]) => `${k}:${v}`)
      .join(";")}}`;
  return block(":root", light) + block(".dark", dark);
}

/** CSS class for a sheikh's cover color (tone-1 … tone-N, wrapping around). */
export function toneOf(config: SiteConfig, sheikhKey: string): number {
  const s = config.sheikhs.find((x) => x.key === sheikhKey);
  const n = config.colors.tones.length;
  return (((s?.tone ?? 1) - 1) % n) + 1;
}
