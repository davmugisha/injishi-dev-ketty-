import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Button } from "@injishi/web-ui";
import { LifebuoyIcon } from "@/components/icons";
import { PROMO_BAR } from "@/data/promotions";
import { SEARCH_DISTRICTS } from "@/data/search-options";
import { SERVICE_PILLARS } from "@/data/services";
import { DEFAULT_REFINEMENT, EMPTY_INTENT, exploreHref } from "@/lib/search-params";

/**
 * The three interstitials the reference drops inside the result list.
 *
 * Each one draws from a REAL fixture rather than inventing its own copy.
 *
 *  - `BundleBanner` reuses `PROMO_BAR` — the one promotion slot ADR-022
 *    already authored, which is deliberately number-free so nothing here can
 *    expire into a lie the way a fabricated "20% off" would.
 *  - `EditorialCard` reuses `SERVICE_PILLARS` — Injishi's own stated value
 *    propositions (escrow, self check-in), not a made-up advertiser. The
 *    reference's slot is a native ad; ours promotes the platform's own real
 *    guarantee, which is the honest version of the same shape.
 *  - `BrandRail` is a rail of the marketplace's OWN districts, not invented
 *    hotel brands. A named real hotel group has not partnered with Injishi,
 *    and putting its logo in a carousel would be a false claim about that
 *    company; a district rail is the same "browse by group" shape built from
 *    something that is actually true.
 *
 * Each is marked with `data-interstitial="<kind>"` so the checker that proves
 * they render is naming the same three kinds the ledger's gate does.
 */

export function BundleBanner() {
  if (!PROMO_BAR) return null;
  return (
    <section
      data-interstitial="bundle"
      className="flex flex-col items-start gap-3 rounded-card bg-foreground p-6 text-background sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <span className="text-2xs font-bold uppercase tracking-widest text-background/70">
          {PROMO_BAR.tag}
        </span>
        <h3 className="mt-1 text-xl font-bold">{PROMO_BAR.headline}</h3>
        <p className="mt-1 max-w-prose text-sm text-background/80">{PROMO_BAR.body}</p>
      </div>
      <Button asChild variant="inverse" size="sm" className="w-max shrink-0">
        <Link href={PROMO_BAR.href}>{PROMO_BAR.ctaLabel}</Link>
      </Button>
    </section>
  );
}

export function EditorialCard() {
  const t = useTranslations("search");
  const pillar = SERVICE_PILLARS[0];
  if (!pillar) return null;
  return (
    <section
      data-interstitial="editorial"
      className="grid grid-cols-1 overflow-hidden rounded-card bg-card ring-1 ring-border sm:grid-cols-[1fr_1.4fr]"
    >
      <div className="relative aspect-[16/10] sm:aspect-auto">
        <picture className="block h-full w-full">
          <source type="image/avif" srcSet={`/assets/${pillar.image.stem}.avif`} />
          <img
            src={`/assets/${pillar.image.stem}.jpg`}
            alt={pillar.image.alt}
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
          />
        </picture>
      </div>
      <div className="flex flex-col justify-center gap-2 p-6">
        <span className="text-2xs font-bold uppercase tracking-widest text-accent-text">
          {t("whyBookWithUs")}
        </span>
        <h3 className="text-xl font-bold text-foreground">
          {pillar.lead}
          <b>{pillar.emphasis}</b>
        </h3>
        <p className="text-sm text-muted-foreground">{pillar.body}</p>
        <Link
          href={`/how-it-works#${pillar.id}`}
          className="mt-1 flex w-max items-center gap-1.5 text-sm font-bold text-accent-text hover:underline"
        >
          {t("learnMore")}
          <ArrowRight className="size-4" strokeWidth={2.5} aria-hidden />
        </Link>
      </div>
    </section>
  );
}

/**
 * The photograph each district tile uses.
 *
 * Written out rather than templated from the slug. `rwanda-district-<slug>`
 * exists for exactly three of the six districts, so the template that used to
 * build these src attributes 404ed on half the rail — silently, because a
 * broken `<img>` inside a dark gradient just looks like a dark tile. The other
 * three point at real photographs of those places that the asset folder does
 * carry. A district with no entry here is not rendered.
 */
const DISTRICT_IMAGE: Readonly<Record<string, string>> = {
  kigali: "rwanda-district-kigali",
  musanze: "rwanda-district-musanze",
  rubavu: "rwanda-district-rubavu",
  karongi: "karongi-01",
  rusizi: "nyungwe-forest-02",
  nyagatare: "akagera-np-01",
};

export function BrandRail() {
  const t = useTranslations("search");
  const districts = SEARCH_DISTRICTS.filter((d) => DISTRICT_IMAGE[d.slug]);
  if (districts.length === 0) return null;
  return (
    <section data-interstitial="brand" className="flex flex-col gap-3">
      <h3 className="text-lg font-bold text-foreground">{t("exploreByDistrict")}</h3>
      <div className="-mx-1 flex snap-x snap-mandatory gap-3 scrollbar overflow-x-auto px-1 pb-1">
        {districts.map((district) => (
          <Link
            key={district.slug}
            href={exploreHref(
              { ...EMPTY_INTENT, districts: [district.slug] },
              DEFAULT_REFINEMENT,
            )}
            className="group relative h-28 w-44 shrink-0 snap-start overflow-hidden rounded-card"
          >
            <picture className="block h-full w-full">
              <source
                type="image/avif"
                srcSet={`/assets/${DISTRICT_IMAGE[district.slug]}.avif`}
              />
              <img
                src={`/assets/${DISTRICT_IMAGE[district.slug]}.jpg`}
                alt={district.name}
                loading="lazy"
                decoding="async"
                className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
              />
            </picture>
            <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />
            <span className="absolute bottom-2 left-3 text-sm font-bold text-white">
              {district.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}

/**
 * The support promo tile this list used to carry, kept as its own block.
 *
 * `bg-foreground text-background`, not the `bg-ink-700` the tile used before.
 * The public layer imports `@injishi/design-tokens/heroui.css` only, which
 * carries the semantic roles without the numbered ramp utilities — the exact
 * gap `components/stays/listing-card.tsx` documents catching on `bg-ink-900`
 * a card below this one. `bg-ink-700` compiled to nothing here too; this
 * component does not carry the bug forward into a page it was rebuilt for.
 */
export function SupportInterstitial() {
  const t = useTranslations("search");
  return (
    <section
      data-interstitial="support"
      className="flex flex-col justify-center gap-3 rounded-card bg-foreground p-6 text-background"
    >
      <LifebuoyIcon className="size-10" />
      <h3 className="text-xl">
        {t("needHelp")}
      </h3>
      <p className="text-sm text-background/80">
        {t("supportReps")}
      </p>
      <Button asChild variant="inverse" size="sm" className="mt-1 w-max">
        <Link href="/support">{t("startNow")}</Link>
      </Button>
    </section>
  );
}
