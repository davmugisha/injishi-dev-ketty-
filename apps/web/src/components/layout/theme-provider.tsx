"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import { TooltipProvider } from "@injishi/ui";

/**
 * The public layer's theme mechanism.
 *
 * It replaces the prototype's `injishi-web-theme.js`, which delegated a click
 * listener on `document` because the header could be swapped out from under it
 * at runtime. Nothing is swapped any more, so the toggle is an ordinary button
 * reading this context.
 *
 * **The three settings below are load-bearing, not defaults.** The four
 * signed-in route groups use a different mechanism entirely: `ThemeBoot`, a
 * pre-paint inline script that reads `localStorage["injishi-theme"]`.
 * next-themes and ThemeBoot must resolve an ABSENT key to the same face, or a
 * guest who signs in changes theme by crossing a route group. ADR-006 call 2c
 * claimed the two already shared a key. They did not. These three lines are
 * what make that claim true (ADR-013 call 2), and changing any of them
 * re-opens the bug:
 *
 *   storageKey    the key ThemeBoot reads
 *   defaultTheme  "light", which is ThemeBoot's fallback for an absent key
 *   enableSystem  OFF, because ThemeBoot no longer consults the OS either
 *
 * Light is now the product default rather than the OS preference. Both halves
 * changed together and `tests/theme-invariant.test.mjs` pins both: switching
 * one back re-opens exactly the disagreement the pair was written to close.
 * Dark is still one click away and still sticky — the toggles write the key,
 * and a stored `"dark"` wins here and in ThemeBoot alike.
 *
 * One invariant travels with them: **nothing may call `setTheme("system")`.**
 * That writes the literal string `"system"` into the key, and ThemeBoot reads
 * anything other than `"dark"` as light — silently overriding the OS
 * preference it was meant to follow. The toggles compute
 * `resolvedTheme === "dark" ? "light" : "dark"` instead, and
 * `tests/theme-invariant.test.mjs` fails the build on a regression.
 */
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <NextThemesProvider
      attribute="class"
      storageKey="injishi-theme"
      defaultTheme="light"
      enableSystem={false}
      disableTransitionOnChange
    >
      {/* React Aria owns the tooltip warmup timer globally now, so the old
          `delayDuration` has no home. Per-tooltip timing is `delay` on the
          Tooltip itself. */}
      <TooltipProvider>{children}</TooltipProvider>
    </NextThemesProvider>
  );
}
