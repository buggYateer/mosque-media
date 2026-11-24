"use client";

import { useEffect } from "react";

/** Registers the service worker in production (offline support + installable app). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV === "production" && "serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => {});
  }, []);
  return null;
}
