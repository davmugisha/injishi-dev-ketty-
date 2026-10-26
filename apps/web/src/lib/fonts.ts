import localFont from "next/font/local";

/**
 * The brand faces, self-hosted.
 *
 * Two families, as the saved HeroUI Pro design system "Injishi" sets them
 * (ADR-068, re-synced 2026-10-26 at `updatedAt` 1792979018879): Figtree for
 * body and UI text, Instrument Sans for headings. They replace Inter, which the
 * 2026-10-07 save set for both. The variable names are the ones the design
 * system's export reads (`--font-figtree`, `--font-instrument-sans`) and the
 * ones `apps/app` mounts, so a theme block written for either app reads both.
 *
 * Each face is ONE file, and that is deliberate: Google's css2 endpoint splits
 * a face into a `latin` and a `latin-ext` file joined by `unicode-range`, and
 * `next/font/local` has no way to express a per-src unicode-range — its `src`
 * array items carry `path`, `weight` and `style` only. Two subsets would have
 * had to become two `localFont()` calls and two families.
 *
 *  - `Figtree-Variable.woff2` is the upstream single-axis (wght 300-900)
 *    variable face, the same 27 KB file this app shipped before ADR-068
 *    (restored byte for byte from git).
 *  - `InstrumentSans-Variable.woff2` is the upstream
 *    `InstrumentSans[wdth,wght].ttf` from google/fonts (repository commit
 *    7fa22308 of Instrument/instrument-sans), compressed to WOFF2 unsubset:
 *    88 KB, wght 400-700, and a width axis nothing here moves off 100.
 *
 * Both are SIL OFL 1.1; the licence texts sit beside the files. No binary is
 * duplicated into `src/`: these point at the .woff2 files in
 * `public/shared/fonts/`.
 */

export const figtree = localFont({
  src: "../../public/shared/fonts/Figtree-Variable.woff2",
  weight: "300 900",
  style: "normal",
  display: "swap",
  variable: "--font-figtree",
  fallback: ["Arial", "sans-serif"],
  adjustFontFallback: false,
});

export const instrumentSans = localFont({
  src: "../../public/shared/fonts/InstrumentSans-Variable.woff2",
  weight: "400 700",
  style: "normal",
  display: "swap",
  variable: "--font-instrument-sans",
  fallback: ["Arial", "sans-serif"],
  adjustFontFallback: false,
});
