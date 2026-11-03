/**
 * Two names the demo package gives the types below (`BoardId` and `IconName`, in `@injishi/data`). A product
 * never imports that package (ADR-074, Import rules), so here each is the string it is at run time, and the app,
 * which owns the screen registry and the icon set, resolves it. The demo fixtures' narrower types still assign to
 * these, so the compiler keeps checking the two agree.
 */

/** A screen of the app, by the registry's name for it. The app turns it into a link. */
export type BoardId = string;

/** An icon, by name. */
export type IconName = string;

/** A status colour, by the theme's name for it. The fixture areas that declare it agree on this union. */
export type Tone = "accent" | "success" | "warning" | "danger" | "default" | "info";
