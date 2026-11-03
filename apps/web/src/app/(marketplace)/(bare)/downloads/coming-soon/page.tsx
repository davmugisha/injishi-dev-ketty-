import type { Metadata } from "next";
import localFont from "next/font/local";
import { redirect } from "next/navigation";
import { cn } from "@injishi/utils";
import { liveLinkFor } from "@/lib/download-links";
import { figtree, instrumentSans } from "@/lib/fonts";
import styles from "./coming-soon.module.css";

/**
 * `/downloads/coming-soon`: where a download button or a scanned QR code lands
 * while that platform has no app yet (mobile spec 0004, AC-5 to AC-7).
 *
 * The whole screen is the words "Coming soon" on a grainy ground, after the
 * Work Inc "Coming soon" Dribbble shot, and nothing else: no logo, no link, no
 * header or footer (the `(bare)` group). The words step through seven
 * typefaces on a loop; `coming-soon.module.css` holds the frames.
 *
 * A link saved before launch never shows this once its platform is out: with a
 * live `platform`, the page answers with a 307 to that platform's link instead.
 */

// The three faces only this page uses. Declared here and nowhere else, so no
// other page downloads them. Each file is cut down to the glyphs of "Coming
// soon" (C, o, m, i, n, g, s and the space), under 5 KB, OFL 1.1 with its
// licence beside it in `public/shared/fonts/coming-soon/`. Figtree and
// Instrument Sans, the other four frames, are mounted below from
// `lib/fonts.ts`: the root layouts load only Outfit since 2026-11-03.
const instrumentSerif = localFont({
  src: [
    {
      path: "../../../../../../public/shared/fonts/coming-soon/InstrumentSerif-Regular.woff2",
      weight: "400",
      style: "normal",
    },
    {
      path: "../../../../../../public/shared/fonts/coming-soon/InstrumentSerif-Italic.woff2",
      weight: "400",
      style: "italic",
    },
  ],
  display: "swap",
  variable: "--font-instrument-serif",
  fallback: ["Georgia", "serif"],
  adjustFontFallback: false,
});

const spaceMono = localFont({
  src: "../../../../../../public/shared/fonts/coming-soon/SpaceMono-Bold.woff2",
  weight: "700",
  style: "normal",
  display: "swap",
  variable: "--font-space-mono",
  fallback: ["ui-monospace", "monospace"],
  adjustFontFallback: false,
});

const bricolageGrotesque = localFont({
  src: "../../../../../../public/shared/fonts/coming-soon/BricolageGrotesque-ExtraBold.woff2",
  weight: "800",
  style: "normal",
  display: "swap",
  variable: "--font-bricolage-grotesque",
  fallback: ["Arial", "sans-serif"],
  adjustFontFallback: false,
});

export const metadata: Metadata = {
  title: "Coming soon",
  robots: { index: false, follow: false },
};

export default async function ComingSoonPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const platform = (await searchParams).platform;
  // The first value of a repeated `platform`, the same one `/get` reads.
  const live = liveLinkFor(Array.isArray(platform) ? platform[0] : platform);
  if (live) redirect(live);

  return (
    <div
      className={cn(
        figtree.variable,
        instrumentSans.variable,
        instrumentSerif.variable,
        spaceMono.variable,
        bricolageGrotesque.variable,
        "grain grid min-h-dvh place-items-center bg-background px-6 text-center text-accent-text",
      )}
    >
      <h1 className={styles.word}>Coming soon</h1>
    </div>
  );
}
