"use client";

import { Link2, MessageCircle, Send, Share2 } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { routing } from "@/i18n/routing";
import { cn } from "@/lib/utils";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "./ui/dropdown-menu";

/** Full URL of a page in the current language (the default language has no prefix). */
export function useAbsoluteUrl() {
  const locale = useLocale();
  return (path: string) => {
    const prefix = locale === routing.defaultLocale ? "" : `/${locale}`;
    return location.origin + (prefix + (path === "/" ? "" : path) || "/");
  };
}

export function ShareButton({ path, title, variant = "button", className }: { path: string; title: string; variant?: "button" | "icon"; className?: string }) {
  const t = useTranslations("common");
  const abs = useAbsoluteUrl();
  const canNative = typeof navigator !== "undefined" && "share" in navigator;

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
    toast(t("copied"));
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        aria-label={t("share")}
        className={cn(
          variant === "icon"
            ? "grid size-10 shrink-0 place-items-center rounded-full hover:bg-muted"
            : "inline-flex h-10 items-center gap-2 rounded-lg border bg-card px-3.5 text-sm font-semibold hover:bg-muted",
          className,
        )}
      >
        <Share2 className="size-5 text-primary" />
        {variant === "button" ? <span className="max-sm:hidden">{t("share")}</span> : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent className="min-w-44">
        <DropdownMenuItem onClick={copy}>
          <Link2 className="text-primary" />
          {t("copyLink")}
        </DropdownMenuItem>
        {canNative ? (
          <DropdownMenuItem onClick={() => navigator.share({ title, url: abs(path) }).catch(() => {})}>
            <Share2 className="text-primary" />
            {t("shareVia")}
          </DropdownMenuItem>
        ) : (
          <>
            <DropdownMenuItem render={<a href={`https://wa.me/?text=${encodeURIComponent(`${title}\n${typeof location !== "undefined" ? abs(path) : ""}`)}`} target="_blank" rel="noopener" />}>
              <MessageCircle className="text-primary" />
              {t("whatsapp")}
            </DropdownMenuItem>
            <DropdownMenuItem
              render={<a href={`https://t.me/share/url?url=${encodeURIComponent(typeof location !== "undefined" ? abs(path) : "")}&text=${encodeURIComponent(title)}`} target="_blank" rel="noopener" />}
            >
              <Send className="text-primary rtl:-scale-x-100" />
              {t("telegram")}
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
