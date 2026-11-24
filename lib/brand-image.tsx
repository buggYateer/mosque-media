/**
 * Generated brand images (app icons, share image) from site.config.json:
 * the mosque logo from assets/ if there is one, otherwise the first letter of its name.
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { ImageResponse } from "next/og";
import { initialOf } from "@/components/logo";
import { config } from "./config";

const root = process.cwd();
const fontFile = join(root, "lib", "generated", "brand-font.bin");
const font = existsSync(fontFile) ? readFileSync(fontFile) : null;
const logoPng = join(root, "public", "brand", "logo.png");
const logoSvg = join(root, "public", "brand", "logo.svg");
const logo = existsSync(logoPng)
  ? `data:image/png;base64,${readFileSync(logoPng).toString("base64")}`
  : existsSync(logoSvg)
    ? `data:image/svg+xml;base64,${readFileSync(logoSvg).toString("base64")}`
    : null;

const RADIUS = { sharp: 0.1, soft: 0.22, round: 0.45 } as const;

/** The image renderer shapes Arabic letters but does not reorder right-to-left words, so we do it. */
const visualOrder = (s: string) => (/[֐-ࣿ]/.test(s) ? s.split(/\s+/).reverse().join(" ") : s);
const fonts = font ? [{ name: "brand", data: font, weight: 700 as const }] : [];

/** Square icon. `bleed` = full square background (maskable / Apple), `pad` = logo size ratio. */
export function iconImage(size: number, { bleed = false, pad = 0.72 } = {}) {
  const r = bleed ? 0 : Math.round(size * RADIUS[config.design.corners] * 0.5);
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: config.colors.primary, borderRadius: r }}>
        {logo ? (
          // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
          <img src={logo} width={size * pad} height={size * pad} style={{ objectFit: "contain" }} />
        ) : font ? (
          <span style={{ color: "#fff", fontSize: size * pad * 0.7, fontFamily: "brand", lineHeight: 1 }}>{initialOf(config.name)}</span>
        ) : null}
      </div>
    ),
    { width: size, height: size, fonts },
  );
}

/** 1200×630 share image: logo/letter + mosque name. */
export function shareImage() {
  return new ImageResponse(
    (
      <div style={{ width: "100%", height: "100%", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 36, background: config.colors.primary }}>
        <div style={{ width: 220, height: 220, borderRadius: 48, background: "rgba(255,255,255,0.14)", display: "flex", alignItems: "center", justifyContent: "center" }}>
          {logo ? (
            // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
            <img src={logo} width={170} height={170} style={{ objectFit: "contain" }} />
          ) : font ? (
            <span style={{ color: "#fff", fontSize: 140, fontFamily: "brand", lineHeight: 1 }}>{initialOf(config.name)}</span>
          ) : null}
        </div>
        {font ? <span style={{ color: "#fff", fontSize: 76, fontFamily: "brand" }}>{visualOrder(config.name)}</span> : null}
        <div style={{ width: 160, height: 10, borderRadius: 5, background: config.colors.highlight }} />
      </div>
    ),
    { width: 1200, height: 630, fonts },
  );
}
