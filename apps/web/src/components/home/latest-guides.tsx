import { GuideCard } from "@/components/guides/guide-card";
import { SectionHeading } from "@/components/shared/section-heading";
import { GUIDES } from "@/data/guides";

/**
 * "Latest from Blog".
 *
 * Three across at desktop on a 3fr/2fr/1fr grid, so the lead guide reads
 * first; a horizontal snap strip below `lg`.
 */
export function LatestGuides() {
  const [lead, second, third, ...rest] = GUIDES;

  return (
    <section className="section-y flex w-full flex-col">
      <div className="container">
        <div className="flex w-full flex-col">
          <SectionHeading
            lead="Latest from Blog"
            action={{ label: "All guides", href: "/guides" }}
            className="mb-8"
          />

          {/* Ratios narrow as the columns narrow, so all three images land the
              same height and the captions share one baseline. */}
          <div className="hidden grid-cols-[3fr_2fr_1fr] gap-6 lg:grid">
            {lead ? (
              <GuideCard guide={lead} size="lg" imageAspect="aspect-[16/9]" />
            ) : null}
            {second ? (
              <GuideCard guide={second} size="md" imageAspect="aspect-[6/5]" />
            ) : null}
            {third ? (
              <GuideCard guide={third} size="sm" imageAspect="aspect-[3/5]" />
            ) : null}
          </div>

          <div className="scrollbar-none -mx-4 flex snap-x snap-mandatory gap-4 overflow-x-auto px-4 lg:hidden">
            {[lead, second, third, ...rest]
              .filter((guide) => guide !== undefined)
              .map((guide) => (
                <GuideCard
                  key={guide.slug}
                  guide={guide}
                  size="md"
                  className="w-[80%] shrink-0 snap-start"
                />
              ))}
          </div>
        </div>
      </div>
    </section>
  );
}
