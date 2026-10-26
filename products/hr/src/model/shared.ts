/**
 * Three names the demo package gives the types below (`BoardId`, `IconName` and `StockKey`, in
 * `@injishi/data`). A product never imports that package (ADR-074, Import rules), so here each is the string
 * it is at run time, and the app, which owns the screen registry, the icon set and the photos, resolves it.
 * The demo fixtures' narrower types still assign to these, so the compiler keeps checking the two agree.
 */

/** A screen of the app, by the registry's name for it. The app turns it into a link. */
export type BoardId = string;

/** An icon, by name. */
export type IconName = string;

/** A stock photo, by key; the app draws it. */
export type StockKey = string;

/** A status colour, by the theme's name for it. */
export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";

/**
 * The person a screen is for, as far as a view prints them. The app's persona carries more; a view needs
 * only these, so any persona the app passes in fits.
 */
export interface Persona {
  name: string;
  firstName: string;
  initials: string;
  role: string;
}
