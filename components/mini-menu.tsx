"use client";

/**
 * A small accessible dropdown menu for the public pages (share, language, sort, speed).
 * Much lighter than a full menu library, which matters for the first page load.
 * Keyboard: Enter/Space opens, ↑/↓ move, Escape closes; clicking outside closes.
 */
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

export type MiniItem = { key: string; label: ReactNode; checked?: boolean; href?: string; onSelect?: () => void; lang?: string };

export function MiniMenu({
  trigger,
  label,
  items,
  triggerClass,
  align = "start",
  side = "bottom",
  className,
}: {
  trigger: ReactNode;
  label: string;
  items: MiniItem[];
  triggerClass?: string;
  align?: "start" | "end" | "center";
  side?: "bottom" | "top";
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: Event) => {
      if (!root.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        root.current?.querySelector<HTMLButtonElement>("[aria-haspopup]")?.focus();
      }
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        const els = [...(root.current?.querySelectorAll<HTMLElement>("[role^=menuitem]") ?? [])];
        const i = els.indexOf(document.activeElement as HTMLElement);
        els[(i + (e.key === "ArrowDown" ? 1 : -1) + els.length) % els.length]?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    window.addEventListener("scroll", () => setOpen(false), { once: true, passive: true });
    root.current?.querySelector<HTMLElement>("[role^=menuitem]")?.focus();
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  const itemCls = "flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-start text-sm outline-none hover:bg-accent focus:bg-accent";
  return (
    <div ref={root} className="relative">
      <button type="button" aria-haspopup="menu" aria-expanded={open} aria-controls={id} aria-label={label} title={label} className={triggerClass} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open ? (
        <div
          id={id}
          role="menu"
          aria-label={label}
          className={cn(
            "absolute z-50 min-w-40 rounded-lg border bg-popover p-1 text-popover-foreground shadow-lg",
            side === "bottom" ? "top-full mt-1.5" : "bottom-full mb-1.5",
            align === "start" ? "start-0" : align === "end" ? "end-0" : "start-1/2 -translate-x-1/2 rtl:translate-x-1/2",
            className,
          )}
        >
          {items.map((it) => {
            const role = it.checked === undefined ? "menuitem" : "menuitemradio";
            const content = (
              <>
                {it.checked !== undefined ? <span className="w-4 text-primary">{it.checked ? "✓" : ""}</span> : null}
                {it.label}
              </>
            );
            return it.href ? (
              <a key={it.key} role={role} href={it.href} target="_blank" rel="noopener" lang={it.lang} className={itemCls} onClick={() => setOpen(false)}>
                {content}
              </a>
            ) : (
              <button
                key={it.key}
                type="button"
                role={role}
                aria-checked={it.checked}
                lang={it.lang}
                className={itemCls}
                onClick={() => {
                  setOpen(false);
                  it.onSelect?.();
                }}
              >
                {content}
              </button>
            );
          })}
        </div>
      ) : null}
    </div>
  );
}

/** Tiny toast for the public pages (the dashboard uses the full one). */
export function showToast(msg: string) {
  let el = document.getElementById("mini-toast");
  if (!el) {
    el = document.createElement("div");
    el.id = "mini-toast";
    el.setAttribute("role", "status");
    el.className =
      "fixed bottom-6 left-1/2 z-[70] -translate-x-1/2 rounded-lg bg-foreground px-4 py-2.5 font-semibold text-background opacity-0 shadow-lg transition-opacity duration-200 [.has-player_&]:bottom-52 md:[.has-player_&]:bottom-36";
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.style.opacity = "1";
  clearTimeout((showToast as unknown as { t?: ReturnType<typeof setTimeout> }).t);
  (showToast as unknown as { t?: ReturnType<typeof setTimeout> }).t = setTimeout(() => (el!.style.opacity = "0"), 2200);
}
