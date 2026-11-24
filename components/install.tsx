"use client";

/**
 * "Install as an app" (PWA): Android/desktop use the browser's install prompt,
 * iPhone gets instructions (Safari has no prompt). The home-page bar shows once
 * until it is dismissed or the app is installed.
 */
import { Smartphone, X } from "lucide-react";
import { useTranslations } from "next-intl";
import { useSyncExternalStore } from "react";
import { useStored, writeStored } from "@/lib/use-stored";

type PromptEvent = Event & { prompt: () => void; userChoice: Promise<{ outcome: string }> };

let deferred: PromptEvent | null = null;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
if (typeof window !== "undefined") {
  addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as PromptEvent;
    notify();
  });
  addEventListener("appinstalled", () => {
    deferred = null;
    writeStored("installDismissed", "true");
    notify();
  });
}

const isIOS = () => typeof navigator !== "undefined" && /iphone|ipad|ipod/i.test(navigator.userAgent) && !("MSStream" in window);
const standalone = () => typeof window !== "undefined" && (matchMedia("(display-mode: standalone)").matches || (navigator as Navigator & { standalone?: boolean }).standalone === true);

export function useInstall() {
  const t = useTranslations("pwa");
  const can = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => !standalone() && (!!deferred || isIOS()),
    () => false,
  );
  const run = async () => {
    if (deferred) {
      deferred.prompt();
      const r = await deferred.userChoice;
      if (r.outcome === "accepted") writeStored("installDismissed", "true");
      deferred = null;
      notify();
    } else if (isIOS()) alert(t("ios"));
  };
  return { can, run };
}

export function InstallBar() {
  const t = useTranslations("pwa");
  const { can, run } = useInstall();
  const [dismissed, setDismissed] = useStored("installDismissed", "false");
  if (!can || dismissed === "true") return null;
  return (
    <div className="mb-4 flex items-center gap-3 rounded-xl bg-accent px-4 py-2.5">
      <Smartphone className="size-6 shrink-0 text-primary" />
      <div className="flex flex-1 flex-col leading-snug">
        <b>{t("title")}</b>
        <small className="text-muted-foreground">{t("sub")}</small>
      </div>
      <button className="rounded-lg bg-primary px-3.5 py-1.5 font-bold text-primary-foreground" onClick={run}>
        {t("install")}
      </button>
      <button
        className="grid size-8 place-items-center text-muted-foreground"
        aria-label="✕"
        onClick={() => setDismissed("true")}
      >
        <X className="size-5" />
      </button>
    </div>
  );
}
