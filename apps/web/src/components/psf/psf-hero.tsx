import Link from "next/link";
import { ArrowDown, ArrowRight } from "lucide-react";
import { Button } from "@injishi/ui";

import { PsfHeroVisual } from "./psf-hero-visual";
import styles from "./psf-hero.module.css";
import { TrackForm } from "./track-form";

/** When a piece of the hero arrives, after the first. */
const delay = (ms: number) => ({ "--delay": `${ms}ms` }) as React.CSSProperties;

/**
 * The PSF page's hero (2026-10-20), after the owner's reference: a big serif
 * promise on the left (PSF's mark is in the header since the page got its own
 * chrome, 2026-10-23), and on the right a photograph of Kigali
 * cut to a soft blob, with PSF's leaves (from its logo) floating around, where
 * the reference had planes.
 *
 * The photo is the site's own licensed set (credited on /legal/photo-credits).
 * A photograph of a PSF member, from PSF, would take its place. The motion is
 * in `psf-hero.module.css` and `psf-hero-visual.tsx`, and stops for a visitor
 * who asks for less.
 */
export function PsfHero({ registerHref }: { registerHref: string }) {
  return (
    <section className="overflow-hidden border-b border-border">
      <div className="container grid grid-cols-1 items-center gap-12 py-12 lg:grid-cols-2 lg:gap-8 lg:py-16">
        <div className="relative z-10">
          <h1 style={delay(120)} className={`${styles.rise} text-balance font-serif text-5xl font-bold leading-[1.05] tracking-tight text-page-fg sm:text-6xl`}>
            Register your business with PSF
          </h1>
          <p style={delay(240)} className={`${styles.rise} mt-6 max-w-[38ch] text-lg text-page-fg-70`}>Fill in one form and pay by mobile money. We text you a docID to follow your application, and PSF replies within a week.</p>
          <div style={delay(360)} className={`${styles.rise} mt-8 flex flex-wrap items-center gap-5`}>
            <Button asChild size="lg" variant="primary">
              <Link href={registerHref}>
                Register your business <ArrowRight size={18} aria-hidden />
              </Link>
            </Button>
            <a href="#how" className="group inline-flex items-center gap-3 text-sm font-medium text-page-fg">
              <span className="flex size-11 items-center justify-center rounded-full bg-accent-brand/15 text-accent-text transition-colors group-hover:bg-accent-brand group-hover:text-accent-brand-foreground">
                <ArrowDown size={18} aria-hidden />
              </span>
              How it works
            </a>
          </div>
          <div style={delay(480)} className={`${styles.rise} mt-8 max-w-form`}>
            <TrackForm />
          </div>
        </div>

        <PsfHeroVisual photo="/assets/kigali-convention-centre-02-960.webp" alt="The Kigali Convention Centre" />
      </div>
    </section>
  );
}
