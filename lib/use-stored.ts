"use client";

/**
 * A value saved on this device (localStorage) as React state.
 * Uses useSyncExternalStore so server HTML and the first client render match,
 * and every component reading the same key updates together.
 */
import { useCallback, useSyncExternalStore } from "react";

const EVENT = "stored-change";

export function readStored(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function writeStored(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {}
  window.dispatchEvent(new CustomEvent(EVENT, { detail: key }));
}

function subscribe(cb: () => void) {
  window.addEventListener("storage", cb);
  window.addEventListener(EVENT, cb);
  return () => {
    window.removeEventListener("storage", cb);
    window.removeEventListener(EVENT, cb);
  };
}

export function useStored(key: string, fallback: string): [string, (v: string) => void] {
  const value = useSyncExternalStore(
    subscribe,
    () => readStored(key) ?? fallback,
    () => fallback,
  );
  const set = useCallback((v: string) => writeStored(key, v), [key]);
  return [value, set];
}
