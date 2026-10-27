/**
 * `@injishi/i18n`: where the English and Kinyarwanda message catalogs live
 * (ADR-074, stage 1).
 *
 * A scaffold. Nothing is translated yet, so both catalogs are empty, and no
 * screen reads from them. What is fixed here is only what every later stage
 * leans on: which locales exist, which one is the default, and that a catalog
 * is a flat map of message keys to strings.
 *
 * Money and dates are not this package's. `en-RW` formatting stays in
 * `@injishi/utils`, which is a different question from which language a
 * sentence is written in.
 */

import type { Catalog } from "./catalog.ts";
import { en } from "./catalogs/en.ts";
import { rw } from "./catalogs/rw.ts";

export type { Catalog } from "./catalog.ts";

/** The locales, as BCP 47 language tags: English and Kinyarwanda. */
export const LOCALES = ["en", "rw"] as const;
export type Locale = (typeof LOCALES)[number];

/** What a person reads before they choose. */
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export const catalogs: Readonly<Record<Locale, Catalog>> = { en, rw };
