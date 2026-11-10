/**
 * `@injishi/i18n`: where the English, French and Kinyarwanda message catalogs
 * live.
 *
 * What is fixed here is what every consumer leans on: which locales exist,
 * which one is the default, that every catalog has English's shape, and how a
 * locale maps to the BCP 47 tag the number and date formatters want. The
 * catalogs themselves live in `catalogs/`, one file per locale, and are
 * authored as ICU MessageFormat.
 *
 * Money and dates are not this package's. `formatLocale` only says which
 * locale a formatter should be built for; `en-RW`, `fr-RW` and `rw-RW` all
 * print the Rwandan franc, the Rwandan day-first date and the same grouping.
 */

import type { Catalog, Shape } from "./catalog.ts";
import { en } from "./catalogs/en.ts";
import { fr } from "./catalogs/fr.ts";
import { rw } from "./catalogs/rw.ts";

export type { Catalog, Shape } from "./catalog.ts";

/** One locale's catalog, in English's shape. */
export type Messages = Shape<typeof en>;

/** The locales, as BCP 47 language tags: English, French and Kinyarwanda. */
export const LOCALES = ["en", "fr", "rw"] as const;
export type Locale = (typeof LOCALES)[number];

/** What a person reads before they choose. */
export const DEFAULT_LOCALE: Locale = "en";

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

/** Every locale's catalog, by locale. */
export const catalogs: Readonly<Record<Locale, Messages>> = { en, fr, rw };

/**
 * The tag to hand `Intl` and React Aria.
 *
 * The language is the choice; the region is where the money and the calendar
 * are. `rw-RW` is deliberate: Kinyarwanda's own CLDR plural rules, with
 * Rwanda's dates and franc.
 */
const FORMAT_LOCALE: Readonly<Record<Locale, string>> = {
  en: "en-RW",
  fr: "fr-RW",
  rw: "rw-RW",
};

export function formatLocale(locale: Locale): string {
  return FORMAT_LOCALE[locale];
}

/** Every key in a catalog, dot-separated, in a stable order. */
export function catalogKeys(catalog: Catalog, prefix = ""): string[] {
  return Object.keys(catalog)
    .sort()
    .flatMap((key) => {
      const value = catalog[key];
      const path = prefix ? `${prefix}.${key}` : key;
      return typeof value === "string" ? [path] : catalogKeys(value, path);
    });
}
