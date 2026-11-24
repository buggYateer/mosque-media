"use client";

/**
 * Telegram links don't leave the site straight away: a small menu offers
 * «Open in Telegram» or «Copy Telegram link» (same as the original site).
 * One capture-phase listener handles every t.me link on the page, wherever it is.
 * Skipped: share links (t.me/share/url), links inside menus, and ctrl/⌘/shift clicks.
 */
import { Link2, Send } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useRef, useState } from "react";
import { showToast } from "./mini-menu";

type Open = { href: string; post: boolean; top: number; left: number };

export function TelegramConfirm({ channel }: { channel: string }) {
  const t = useTranslations("common");
  const [menu, setMenu] = useState<Open | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      const a = (e.target as HTMLElement).closest<HTMLAnchorElement>('a[href^="https://t.me/"]');
      if (!a || a.closest("[role=menu], [data-tg-menu]") || a.href.includes("/share/url") || e.ctrlKey || e.metaKey || e.shiftKey) return;
      e.preventDefault();
      e.stopPropagation();
      const r = a.getBoundingClientRect();
      const w = 240,
        h = 150;
      const post = new RegExp(`^https://t\\.me/${channel}/\\d+`, "i").test(a.href);
      setMenu({
        href: a.href,
        post,
        top: r.top - h - 8 > 8 ? r.top - h - 8 : r.bottom + 8,
        left: Math.max(8, Math.min(r.left + r.width / 2 - w / 2, innerWidth - w - 8)),
      });
    };
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [channel]);

  useEffect(() => {
    if (!menu) return;
    const close = (e: Event) => !box.current?.contains(e.target as Node) && setMenu(null);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMenu(null);
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", esc);
    window.addEventListener("scroll", () => setMenu(null), { once: true, passive: true });
    box.current?.querySelector<HTMLElement>("[role=menuitem]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", esc);
    };
  }, [menu]);

  if (!menu) return null;
  const item = "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-start text-sm outline-none hover:bg-accent focus:bg-accent";
  return (
    <div
      ref={box}
      data-tg-menu
      role="menu"
      aria-label={menu.post ? t("tgMenu.post") : t("tgMenu.channel")}
      className="fixed z-[60] w-60 rounded-xl border border-t-[3px] border-t-[#2aabee] bg-popover p-1.5 text-popover-foreground shadow-xl"
      style={{ top: menu.top, left: menu.left }}
    >
      <div className="mb-1 flex items-center gap-2.5 border-b px-2 pt-1 pb-2">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-[#2aabee] text-white">
          <Send className="size-4 rtl:-scale-x-100" />
        </span>
        <b className="text-[13.5px] leading-snug">{menu.post ? t("tgMenu.post") : t("tgMenu.channel")}</b>
      </div>
      <a role="menuitem" href={menu.href} target="_blank" rel="noopener" className={`${item} font-bold text-[#1d8fd1] dark:text-[#5cc3f5]`} onClick={() => setMenu(null)}>
        <Send className="size-4 rtl:-scale-x-100" />
        {t("tgMenu.open")}
      </a>
      <button
        role="menuitem"
        type="button"
        className={item}
        onClick={async () => {
          try {
            await navigator.clipboard.writeText(menu.href);
          } catch {}
          setMenu(null);
          showToast(t("copied"));
        }}
      >
        <Link2 className="size-4 text-primary" />
        {t("tgMenu.copy")}
      </button>
    </div>
  );
}
