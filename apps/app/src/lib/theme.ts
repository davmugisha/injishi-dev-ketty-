/**
 * next-themes ids are the <html data-theme> values themselves. Its pre-paint script writes the raw id and
 * ignores the `value` map, so any other id ("dark") paints HeroUI's stock blue theme until React hydrates.
 */
export const THEME = { light: "mouve-light", dark: "mouve-dark" } as const;

/** Runs before next-themes reads storage: rewrites ids saved before the rename. */
/** It also marks a dark page `.dark` before paint, where the design tokens keep their dark roles. */
export const THEME_MIGRATION = `try{var t=localStorage.getItem("theme");if(t==="light"||t==="dark")localStorage.setItem("theme","mouve-"+t);if(localStorage.getItem("theme")==="mouve-dark")document.documentElement.classList.add("dark")}catch(e){}`;
