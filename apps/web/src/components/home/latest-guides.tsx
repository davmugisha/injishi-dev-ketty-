import { GuideCard } from "@/components/guides/guide-card";
import { MoreGuidesTile } from "@/components/guides/more-guides-tile";
import { SectionHeading } from "@/components/shared/section-heading";
import { GUIDES } from "@/data/guides";

/**
 * "Latest from Blog".
 *
 * Two guides and the "More" tile across at desktop on a 3fr/2fr/1fr grid, so
 * the lead guide reads first; a horizontal snap strip below `lg`.
 *
 * The third column used to be a third guide. The capture puts the "More" tile
 * there instead, and the ratios are why: at 1fr the slot is a third the width
 * of the lead, so a headline set in it wraps to four lines under a portrait
 * crop of a landscape photograph. The tile carries one word at that width.
 *
 * The captions sit INSIDE the frames (`caption="overlay"`). Three unequal
 * columns put three captions below the frames on three different baselines,
 * which is the thing the unequal ratios were chosen to avoid in the first
 * place; over the scrim they land on the one line all three cards share.
 */
export function LatestGuides() {
  const [lead, second, ...rest] = GUIDES;

  return (
    <section className="section-y flex w-full flex-col">
      <div className="container">
        <div className="flex w-full flex-col">
          <SectionHeading
            lead="Latest from Blog"
            action={{ label: "All guides", href: "/guides" }}
            className="mb-8"
          />

          {/* Ratios narrow as the columns narrow, so both images land the same
              height and the tile beside them stretches to it. */}
          <div className="hidden grid-cols-[3fr_2fr_1fr] gap-6 lg:grid">
            {lead ? (
              <GuideCard
                guide={lead}
                size="lg"
                imageAspect="aspect-[16/9]"
                caption="overlay"
              />
            ) : null}
            {second ? (
              <GuideCard
                guide={second}
                size="md"
                imageAspect="aspect-[6/5]"
                caption="overlay"
              />
            ) : null}
            <MoreGuidesTile />
          </div>

          <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 lg:hidden">
            {[lead, second, ...rest]
              .filter((guide) => guide !== undefined)
              .map((guide) => (
                <GuideCard
                  key={guide.slug}
                  guide={guide}
                  size="md"
                  imageAspect="aspect-[6/5]"
                  caption="overlay"
                  className="w-[80%] shrink-0 snap-start"
                />
              ))}
            {/* Half a card wide, so it reads as the end of the strip rather
                than as a seventh guide that failed to load its photograph. */}
            <MoreGuidesTile className="w-[40%] shrink-0 snap-start" />
          </div>
        </div>
      </div>
    </section>
  );
}
