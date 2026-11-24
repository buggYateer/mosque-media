"use client";

import { ThemeProvider as NextThemes } from "next-themes";
import type { ReactNode } from "react";

// The theme script only has to run once, in the server HTML (before first paint).
// When the layout is drawn again in the browser (e.g. switching language), mark it as data
// so React 19 doesn't warn "Encountered a script tag while rendering React component".
const scriptProps = typeof window === "undefined" ? undefined : ({ type: "application/json", suppressHydrationWarning: true } as const);

export function ThemeProvider({ children }: { children: ReactNode }) {
  return (
    <NextThemes attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange scriptProps={scriptProps}>
      {children}
    </NextThemes>
  );
}
