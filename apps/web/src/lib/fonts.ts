import localFont from "next/font/local";

/**
 * Brand faces, self-hosted, for the public layer.
 *
 * Figtree carries body and UI text; Spectral carries display headings.
 * Figtree replaced Fredoka when the HeroUI theme moved to the teal palette
 * (ADR-025) — the theme block names `--font-figtree`, so that is the variable
 * this file emits and the one every `--font-sans` reads.
 *
 * `Figtree-Variable.woff2` is the upstream single-axis (wght 300-900) variable
 * face, converted from the project's own `Figtree[wght].ttf` rather than taken
 * from a Google Fonts subset URL. That is deliberate: the css2 endpoint splits
 * the face into a `latin` and a `latin-ext` file joined by `unicode-range`, and
 * `next/font/local` has no way to express a per-src unicode-range — its `src`
 * array items carry `path`, `weight` and `style` only. Two subsets would
 * therefore have had to become two `localFont()` calls and two families. The
 * full face is one file and one request, at 27 KB against Fredoka's 70 KB.
 *
 * The wght range widened from Fredoka's 300-700 to 300-900. Nothing is required
 * to use 800 or 900; the axis simply is not clamped any more.
 *
 * No binary is duplicated into `src/`: these point at the .woff2 files
 * already sitting in `public/shared/fonts/`, which the four app route groups
 * reach through `public/shared/css/injishi-fonts.css` (ADR-010 call 6a).
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

export const spectral = localFont({
  src: [
    {
      path: "../../public/shared/fonts/Spectral-Medium.woff2",
      weight: "500",
      style: "normal",
    },
    {
      path: "../../public/shared/fonts/Spectral-Bold.woff2",
      weight: "700",
      style: "normal",
    },
    {
      path: "../../public/shared/fonts/Spectral-BoldItalic.woff2",
      weight: "700",
      style: "italic",
    },
    {
      path: "../../public/shared/fonts/Spectral-ExtraBold.woff2",
      weight: "800",
      style: "normal",
    },
    {
      path: "../../public/shared/fonts/Spectral-ExtraBoldItalic.woff2",
      weight: "800",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--font-spectral",
  fallback: ["Georgia", "serif"],
});
