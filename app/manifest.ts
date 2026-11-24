import type { MetadataRoute } from "next";
import { config, RTL_LOCALES } from "@/lib/config";

/** Install-as-app (PWA) settings, from site.config.json. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: config.name,
    short_name: config.shortName,
    description: config.description,
    lang: config.i18n.default,
    dir: RTL_LOCALES.includes(config.i18n.default) ? "rtl" : "ltr",
    start_url: "/?source=app",
    scope: "/",
    display: "standalone",
    background_color: config.colors.background,
    theme_color: config.design.header === "colored" ? config.colors.primary : "#ffffff",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
