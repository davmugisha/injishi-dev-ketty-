import Link from "next/link";
import { ArrowBoxIcon, InjishiGlyph } from "@/components/icons/marks";
import { DISTRICT_CARDS } from "@/data/stays";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";

/**
 * "Explore by district".
 *
 * A snap strip below `md` so all three districts stay reachable on a phone;
 * an even 3-up grid from `md`, where they fit at once.
 *
 * The tiles are photographic cards — caption over image, inside a scrim — so
 * they take `rounded-card`, the same radius as the listing and featured cards,
 * rather than a smaller one chosen for their smaller footprint.
 */
export function ExploreByDistrict() {
  return (
    <section className="section-y container-left-padding container-right-padding flex items-start gap-6 max-lg:flex-col lg:items-center lg:gap-25">
      <div className="flex shrink-0 flex-col gap-2 max-lg:w-full">
        <div className="flex items-center justify-between">
          <div className="flex gap-2 max-lg:items-center lg:flex-col">
            <InjishiGlyph className="shrink-0 text-accent" width={48} height={43} />
            <h2 className="flex text-2xl leading-[1.2] text-page-fg max-lg:flex-col lg:gap-1.5 lg:text-display-sm">
              Explore <b className="font-bold">by district</b>
            </h2>
          </div>

          <Link
            href="/explore"
            aria-label="Discover Rwanda"
            className="group flex w-max items-center gap-1.5 text-sm text-page-fg lg:hidden"
          >
            <span className="underline">Discover Rwanda</span>
            <ArrowBoxIcon className="transition-all duration-travel group-hover:-translate-y-1 group-hover:translate-x-1" />
          </Link>
        </div>

        <p className="max-w-tile text-sm text-page-fg-70 lg:text-base">
          Discover the most beautiful districts across Rwanda
        </p>

        {/* Brand green on ink reads against both the light and dark page
            background, so this needs no dark: variant. */}
        <Link
          href="/explore"
          className="mt-8 hidden w-max items-center justify-center rounded-full bg-accent px-9 py-4 text-lg font-medium text-accent-foreground transition-all duration-travel hover:bg-accent-hover lg:flex"
        >
          Discover Rwanda
        </Link>
      </div>

      <div className="w-full min-w-0 flex-1">
        <div className="-mx-1 flex snap-x snap-mandatory gap-4 scrollbar overflow-x-auto px-1 pb-2 md:mx-0 md:grid md:grid-cols-3 md:gap-5 md:overflow-visible md:px-0 md:pb-0">
          {DISTRICT_CARDS.map((district) => (
            <Link
              key={district.slug}
              href={`/explore?district=${district.slug}`}
              className="group relative flex shrink-0 basis-[62%] snap-start overflow-hidden rounded-card md:shrink md:basis-auto"
            >
              {/* The ratio lives on this frame, not on the <img>. The image
                  names its rendered width through `sizes`, so on a phone the
                  browser picks a candidate narrower than the card, and a bare
                  <picture> renders at exactly that width: the photograph
                  stopped short of the card's right edge and the scrim showed
                  as a band beside it. Sized frame, block picture, image that
                  fills it — the same shape `BrowseByCategory` records. */}
              <div className="aspect-[250/330] w-full overflow-hidden">
                <ArtDirectedImage
                  stem={`rwanda-district-${district.slug}`}
                  alt={district.alt}
                  sizes="(max-width: 768px) 45vw, 30vw"
                  width={900}
                  height={1188}
                  pictureClassName="block h-full w-full"
                  className="h-full w-full object-center transition-transform duration-travel group-hover:scale-105"
                />
              </div>

              <div className="absolute inset-0 flex flex-col justify-end">
                {/* Shared caption scrim — see `scrim-caption` in globals.css. */}
                <div className="scrim-caption photo-caption relative p-4 md:p-6">
                  <div
                    aria-hidden
                    className="scrim-caption-fade pointer-events-none absolute inset-x-0 bottom-full h-16"
                  />

                  <div className="flex flex-col lg:gap-1">
                    <h3 className="text-lg font-bold text-white md:text-2xl">
                      {district.name}
                    </h3>
                    <div className="flex items-center gap-2.5">
                      <p className="text-xs text-white md:text-sm">
                        Included{" "}
                        <span className="font-bold underline">
                          {district.listings} listings
                        </span>
                      </p>
                      <ArrowBoxIcon className="shrink-0 text-white transition-transform duration-travel group-hover:-translate-y-1 group-hover:translate-x-1" />
                    </div>
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
