import localFont from "next/font/local";

/**
 * The brand face, self-hosted, for the public layer.
 *
 * Inter carries everything: body, UI text and display headings. The saved
 * HeroUI Pro design system "Injishi" sets Inter for both its heading and body
 * font, and ADR-068 makes that design system the source, so Inter replaced
 * Figtree. The theme block names `--font-inter`, so that is the variable this
 * file emits and the one every `--font-sans` reads.
 *
 * `Inter-Variable.woff2` is cut from the upstream `InterVariable.woff2` of
 * rsms/inter v4.1 (SIL OFL 1.1), not taken from a Google Fonts subset URL. That
 * is deliberate: the css2 endpoint splits the face into a `latin` and a
 * `latin-ext` file joined by `unicode-range`, and `next/font/local` has no way
 * to express a per-src unicode-range — its `src` array items carry `path`,
 * `weight` and `style` only. Two subsets would therefore have had to become two
 * `localFont()` calls and two families. So the one file is subset instead:
 * Basic Latin through Latin Extended-B with the combining marks, punctuation,
 * currency, arrows and number forms; the `opsz` axis pinned at text size 14;
 * `wght` kept at 300-900; stylistic sets and character variants dropped, every
 * feature the product reads (`tnum`, `case`, `frac`, `zero`, kerning) kept.
 * That is 110 KB against the upstream file's 352 KB. Figtree was 27 KB; the
 * difference is the cost of the face the design system chose.
 *
 * No binary is duplicated into `src/`: these point at the .woff2 files
 * already sitting in `public/shared/fonts/`, which the four app route groups
 * reach through `public/shared/css/injishi-fonts.css` (ADR-010 call 6a).
 */

export const inter = localFont({
  src: "../../public/shared/fonts/Inter-Variable.woff2",
  weight: "300 900",
  style: "normal",
  display: "swap",
  variable: "--font-inter",
  fallback: ["Arial", "sans-serif"],
  adjustFontFallback: false,
});

