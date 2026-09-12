import Link from "next/link";
import { PROMO_PAIR } from "@/data/promotions";

/**
 * The promotion pair — band 03 of ADR-022.
 *
 * Two slots off the same fixture the bar reads. A slot set to `null` collapses
 * and the other widens to fill the row; both empty and the band is absent
 * entirely. That is the rule the module will inherit, so it is worth having
 * the layout obey it before the module exists.
 */
export function PromoPair() {
  const promos = PROMO_PAIR.filter((promo) => promo !== null);
  if (promos.length === 0) return null;

  return (
    <section className="container pb-14 lg:pb-20">
      <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
        {promos.map((promo) => (
          <div
            key={promo.headline}
            className="flex flex-col items-start gap-3.5 rounded-card border border-border bg-canvas p-8 lg:p-9"
          >
            <span className="rounded-full bg-accent/15 px-3 py-1.5 text-2xs font-bold uppercase tracking-widest text-accent-text bg-accent/10">
              {promo.tag}
            </span>

            <h3 className="font-display text-2xl font-bold leading-[1.2] text-page-fg">
              {promo.headline}
            </h3>

            <p className="max-w-form text-sm text-page-fg-70">{promo.body}</p>

            <Link
              href={promo.href}
              className="mt-1 rounded-full border border-ink px-6 py-2.5 text-sm font-medium text-page-fg transition-all duration-300 hover:bg-ink hover:text-white"
            >
              {promo.ctaLabel}
            </Link>
          </div>
        ))}
      </div>
    </section>
  );
}
