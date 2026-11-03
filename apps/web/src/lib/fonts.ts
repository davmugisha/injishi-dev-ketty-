import localFont from "next/font/local";

/**
 * The brand face, self-hosted.
 *
 * One family, Outfit, for body and headings, as the saved HeroUI Pro design
 * system "Injishi.hs" sets them (ADR-068, synced 2026-11-03 at `updatedAt`
 * 1793682439460). It replaces Figtree (body) and Instrument Sans (headings),
 * which the earlier design system "Injishi" set. The variable name,
 * `--font-outfit`, is the one `apps/app` mounts too, so a theme block written
 * for either app reads both.
 *
 * The face is ONE file, and that is deliberate: Google's css2 endpoint splits
 * a face into a `latin` and a `latin-ext` file joined by `unicode-range`, and
 * `next/font/local` has no way to express a per-src unicode-range — its `src`
 * array items carry `path`, `weight` and `style` only. Two subsets would have
 * had to become two `localFont()` calls and two families.
 *
 *  - `Outfit-Variable.woff2` is the upstream `Outfit[wght].ttf` from
 *    google/fonts (commit 5f246070 of `ofl/outfit`), compressed to WOFF2
 *    unsubset: 45 KB, wght 100-900.
 *
 * Figtree and Instrument Sans stay declared for `/downloads/coming-soon` alone,
 * whose frames step through several typefaces and name both; that page mounts
 * them itself, so no other page downloads them.
 *
 * All three are SIL OFL 1.1; the licence texts sit beside the files. No binary
 * is duplicated into `src/`: these point at the .woff2 files in
 * `public/shared/fonts/`.
 */

export const outfit = localFont({
  src: "../../public/shared/fonts/Outfit-Variable.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
  variable: "--font-outfit",
  fallback: ["Arial", "sans-serif"],
  adjustFontFallback: false,
});

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
