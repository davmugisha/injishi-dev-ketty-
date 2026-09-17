import Link from "next/link";
import { ArrowBoxIcon } from "@/components/icons/marks";
import { SectionHeading } from "@/components/shared/section-heading";
import { STAY_CATEGORIES } from "@/data/home-curations";
import { EMPTY_INTENT, exploreHref, DEFAULT_REFINEMENT } from "@/lib/search-params";

/**
 * "Browse by category" — band 05 of ADR-022. Pure navigation: six fixed
 * accommodation types, each tile a filtered link into explore. No price and
 * no rating on purpose; there is nothing to compare here, only somewhere to
 * go.
 *
 * A type with no inventory yet (motel, guest house) still gets its tile: the
 * link lands on explore's empty state, which is the honest answer, and the
 * tile disappearing the day inventory arrives backwards would be the bug.
 *
 * Below `lg` the six tiles become a snap strip, the same treatment
 * `ExploreByDistrict` gives its three.
 */
export function BrowseByCategory() {
  return (
    <section className="section-y container flex flex-col gap-8">
      {/* One weight, no bold segment: the owner asked for this band's opener
          to read evenly rather than splitting "Browse" from "by category".
          `lead` alone renders the documented Headline role (Spectral 400), so
          there is no local override here. Its peer bands still pass
          `emphasis`, so this heading is deliberately the odd one out. */}
      <SectionHeading
        lead="Browse by category"
        action={{ label: "All stays", href: "/explore" }}
      />

      <div className="-mx-1 flex snap-x snap-mandatory gap-4 scrollbar overflow-x-auto px-1 pb-2 lg:mx-0 lg:grid lg:grid-cols-6 lg:gap-4 lg:overflow-visible lg:px-0 lg:pb-0">
        {STAY_CATEGORIES.map((category) => (
          <Link
            key={category.kind}
            href={exploreHref(EMPTY_INTENT, {
              ...DEFAULT_REFINEMENT,
              // A list of one. The rail's type control became multi-select
              // when /explore was rebuilt, and a category tile is still the
              // single question it always was.
              kinds: [category.kind],
            })}
            className="group relative flex shrink-0 basis-[38%] snap-start overflow-hidden rounded-card sm:basis-[30%] lg:shrink lg:basis-auto"
          >
            {/* The ratio lives on this wrapper, not on the <img>. A <picture>
                is an inline box: given `h-full` with no sized parent it
                collapses to nothing and takes the photograph with it, which
                is exactly how these tiles shipped empty. */}
            <div className="aspect-[4/5] w-full overflow-hidden">
              <picture className="block h-full w-full">
                <source
                  type="image/avif"
                  sizes="(max-width: 1024px) 38vw, 16vw"
                  srcSet={`/assets/${category.image.stem}.avif`}
                />
                <img
                  src={`/assets/${category.image.stem}.jpg`}
                  sizes="(max-width: 1024px) 38vw, 16vw"
                  width={430}
                  height={540}
                  alt={category.image.alt}
                  loading="lazy"
                  decoding="async"
                  className="h-full w-full object-cover object-center transition-transform duration-travel group-hover:scale-105"
                />
              </picture>
            </div>

            <div className="absolute inset-0 flex flex-col justify-end">
              {/* Shared caption scrim — see `scrim-caption` in globals.css. */}
              <div className="scrim-caption photo-caption relative p-4">
                <div
                  aria-hidden
                  className="scrim-caption-fade pointer-events-none absolute inset-x-0 bottom-full h-16"
                />
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-base font-bold text-white lg:text-lg">
                    {category.label}
                  </h3>
                  <ArrowBoxIcon className="size-4 shrink-0 text-white transition-transform duration-travel group-hover:-translate-y-1 group-hover:translate-x-1" />
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
