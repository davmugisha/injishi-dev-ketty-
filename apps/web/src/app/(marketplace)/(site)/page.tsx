import type { Metadata } from "next";
import { HomeGuides } from "@/components/home/home-guides";
import { HomeHero } from "@/components/home/home-hero";
import { OpeningBand } from "@/components/home/opening-band";
import { Reveal } from "@/components/home/reveal";
import { JsonLd } from "@/components/shared/json-ld";
import { ContinueBrowsing } from "@/components/stays/recently-viewed";
import { databaseListings } from "@/data/discovery";
import { toRecentStay } from "@/data/recent-stay";
import { shareMetadata } from "@/lib/share-metadata";
import { organizationJsonLd, websiteJsonLd } from "@/lib/structured-data";

/** The title and description come from the root layout; this adds the address. */
export const metadata: Metadata = {
  alternates: { canonical: "/" },
  ...shareMetadata({
    title: "Stay anywhere in Rwanda | Injishi",
    description:
      "Book verified guesthouses, lodges and serviced apartments across Rwanda. Pay by mobile money, held in escrow, with support from search to arrival.",
    path: "/",
  }),
};

/**
 * The landing page: the hero and its search, the stays the visitor last
 * opened, and something to read.
 *
 * The stays are the live inventory — the published properties read from the
 * API exactly as Explore reads them (`data/discovery.ts`).
 */
export default async function HomePage() {
  const all = await databaseListings();

  return (
    <div className="flex flex-col overflow-x-hidden">
      <JsonLd data={organizationJsonLd()} />
      <JsonLd data={websiteJsonLd()} />
      <HomeHero />
      {/* Nothing public yet: say so straight under the hero. It goes the
          moment one property is published. */}
      {all.length === 0 ? <OpeningBand /> : null}
      {/* Empty, and so absent, until the visitor has opened a stay. */}
      <ContinueBrowsing stays={all.map(toRecentStay)} />
      <Reveal>
        <HomeGuides />
      </Reveal>
    </div>
  );
}
