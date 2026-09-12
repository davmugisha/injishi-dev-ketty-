import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { PROMO_BAR } from "@/data/promotions";

/**
 * The promotion bar — band 01 of ADR-022.
 *
 * A full-bleed ink strip carrying one offer, directly under the hero. It reads
 * from `PROMO_BAR` rather than from hard-coded copy, so the day the Promotions
 * module lands this component changes its import and nothing else.
 *
 * No live promotion means the band does not render. Never a fallback, never an
 * empty frame: a marketing band with nothing to say should be absent.
 */
export function PromoBar() {
  const promo = PROMO_BAR;
  if (!promo) return null;

  return (
    <section className="bg-ink py-5">
      <div className="container flex flex-wrap items-center gap-x-6 gap-y-4">
        <span className="rounded-full bg-accent/20 px-3 py-1.5 text-2xs font-bold uppercase tracking-widest text-accent text-accent-text">
          {promo.tag}
        </span>

        <div className="flex min-w-[260px] flex-1 flex-col gap-1">
          <p className="font-display text-xl font-bold leading-tight text-white">
            {promo.headline}
          </p>
          <p className="text-sm text-white/70">{promo.body}</p>
        </div>

        <Link
          href={promo.href}
          className="flex shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full bg-accent px-5 py-3 text-xs font-bold uppercase tracking-widest text-accent-foreground transition-all duration-300 hover:bg-accent-hover"
        >
          {promo.ctaLabel}
          <ArrowRight className="size-3.5" strokeWidth={2} aria-hidden />
        </Link>
      </div>
    </section>
  );
}
