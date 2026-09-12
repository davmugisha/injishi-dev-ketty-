/**
 * The theme, as the whole origin remembers it (ADR-037 call 5).
 *
 * `apps/web` keeps the theme in `localStorage["injishi-theme"]` and stamps
 * `.dark` on <html> before first paint. This app is served as a zone under
 * web's origin, so it reads and writes the SAME key: a person who chose dark on
 * /trips finds dark on /w/<id>/today, and the other way round.
 *
 * Three facts travel with the key and must stay equal to web's
 * (`components/app/theme-boot.tsx`, `components/layout/theme-provider.tsx`):
 * an explicit "dark" wins, anything else is light, and the operating system is
 * not consulted. `.light` is stamped as well as `.dark`, because this app's
 * `pms-tokens.css` declares its own roles under `.light` and `.dark` and an
 * unstamped document would have neither.
 */

export const THEME_KEY = "injishi-theme";

export type Theme = "light" | "dark";

/** What the boot script left on <html>. Light on the server, where there is no document. */
export function readTheme(): Theme {
  if (typeof document === "undefined") return "light";
  return document.documentElement.classList.contains("dark") ? "dark" : "light";
}

/** Stamp the class, the attribute and the key. Never throws: a private window still gets this page view. */
export function applyTheme(theme: Theme): void {
  const root = document.documentElement;
  const dark = theme === "dark";
  root.classList.toggle("dark", dark);
  root.classList.toggle("light", !dark);
  root.setAttribute("data-theme", dark ? "dark" : "light");
  try {
    localStorage.setItem(THEME_KEY, dark ? "dark" : "light");
  } catch {
    // Storage refused. The class is on the document, so this view is right.
  }
}

/**
 * Runs before React, inline, from the root layout. The same resolution as
 * web's ThemeBoot with `.light` added; keep the two in step.
 */
export const THEME_BOOT =
  `try{var s=localStorage.getItem('${THEME_KEY}');` +
  `var d=s==='dark';var r=document.documentElement;` +
  `r.classList.toggle('dark',d);r.classList.toggle('light',!d);` +
  `r.setAttribute('data-theme',d?'dark':'light')}catch(e){}`;
