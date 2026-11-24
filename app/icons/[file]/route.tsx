import { iconImage } from "@/lib/brand-image";

const SIZES: Record<string, { size: number; bleed?: boolean; pad?: number }> = {
  "icon-192.png": { size: 192 },
  "icon-512.png": { size: 512 },
  "maskable-512.png": { size: 512, bleed: true, pad: 0.5 },
  "apple-180.png": { size: 180, bleed: true, pad: 0.62 },
  "favicon-32.png": { size: 32, pad: 0.8 },
};

export function generateStaticParams() {
  return Object.keys(SIZES).map((file) => ({ file }));
}

/** App icons, generated at build time from the mosque's logo/colors (site.config.json + assets/). */
export async function GET(_req: Request, { params }: RouteContext<"/icons/[file]">) {
  const s = SIZES[(await params).file];
  if (!s) return new Response("Not found", { status: 404 });
  return iconImage(s.size, s);
}
