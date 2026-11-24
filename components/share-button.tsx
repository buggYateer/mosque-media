"use client";

import { Link2, MessageCircle, Send, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { MiniMenu, showToast } from "./mini-menu";

/** Full URL of a page in the current language (the default language has no prefix). */
export function useAbsoluteUrl() {
  const locale = useLocale();
  return (path: string) => {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    return (typeof location === "undefined" ? "" : location.origin) + (prefix + (path === "/" ? "" : path) || "/");
  };
}

export function ShareButton({ path, title, variant = "button", className }: { path: string; title: string; variant?: "button" | "icon"; className?: string }) {
  const t = useTranslations("common");
  const abs = useAbsoluteUrl();
  const canNative = useSyncExternalStore(
    () => () => {},
    () => "share" in navigator,
    () => false,
  );

  const copy = async () => {
    const url = abs(path);
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = url;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      ta.remove();
    }
    showToast(t("copied"));
  };

  return (
    <MiniMenu
      label={t("share")}
      align="end"
      triggerClass={cn(
        variant === "icon" ? "grid size-10 shrink-0 place-items-center rounded-full hover:bg-muted" : "inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-3.5 text-sm font-semibold hover:bg-muted",
        className,
      )}
      trigger={
        <>
          <Share2 className="size-5 text-primary" />
          {variant === "button" ? <span className="max-sm:hidden">{t("share")}</span> : null}
        </>
      }
      items={[
        { key: "copy", label: <><Link2 className="size-4 text-primary" />{t("copyLink")}</>, onSelect: copy },
        ...(canNative
          ? [{ key: "native", label: <><Share2 className="size-4 text-primary" />{t("shareVia")}</>, onSelect: () => void navigator.share({ title, url: abs(path) }).catch(() => {}) }]
          : [
              { key: "wa", label: <><MessageCircle className="size-4 text-primary" />{t("whatsapp")}</>, href: `https://wa.me/?text=${encodeURIComponent(`${title}\n${abs(path)}`)}` },
              { key: "tg", label: <><Send className="size-4 text-primary rtl:-scale-x-100" />{t("telegram")}</>, href: `https://t.me/share/url?url=${encodeURIComponent(abs(path))}&text=${encodeURIComponent(title)}` },
            ]),
      ]}
    />
  );
}
