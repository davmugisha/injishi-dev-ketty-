"use client";

import { useEffect } from "react";

/**
 * Owns the dark-mode toggle for every surface (marketing + authenticated app).
 * Replaces public/shared/js/injishi-web-theme.js.
 *
 * Still delegated on `document` rather than an onClick, because the toggle
 * button is rendered in several places that are deliberately Server Components
 * — <SiteHeader/> ships it twice (desktop + mobile) and the capture-derived
 * pages carry their own. Making each of those a Client Component to attach one
 * handler would push a lot of static markup into the client bundle for nothing.
 * One delegated listener costs a single listener and keeps the pages static.
 *
 * What changes versus the old script: it is typed, bundled with the app instead
 * of fetched as a separate request, and React unmounts the listener for us — so
 * the `window.__injishiWebTheme` re-entry guard the script needed is gone.
 *
 * The initial theme is resolved pre-paint by <ThemeBoot/>; this only handles
 * changes, so the two never disagree about the starting value.
 */
const STORAGE_KEY = "injishi-theme";

export default function ThemeToggle() {
  useEffect(() => {
    function onClick(e: MouseEvent) {
      const target = e.target as HTMLElement | null;
      if (!target?.closest("[data-theme-toggle]")) return;

      const root = document.documentElement;
      const dark = !root.classList.contains("dark");
      root.classList.toggle("dark", dark);
      root.setAttribute("data-theme", dark ? "dark" : "light");
      try {
        localStorage.setItem(STORAGE_KEY, dark ? "dark" : "light");
      } catch {
        // Safari private mode and friends — the toggle still works for this
        // page view, it just will not be remembered.
      }
    }

    document.addEventListener("click", onClick);
    return () => document.removeEventListener("click", onClick);
  }, []);

  return null;
}
