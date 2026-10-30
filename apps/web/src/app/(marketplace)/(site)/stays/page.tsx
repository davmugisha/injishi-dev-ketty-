import { ArrowRight, Car } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JsonLd } from "@/components/shared/json-ld";
import { ArtDirectedImage } from "@/components/shared/art-directed-image";
import { PageHero } from "@/components/shared/page-hero";
import { DESTINATIONS, destinationPath, driveLine } from "@/data/destination-pages";
import { databaseListings } from "@/data/discovery";
import { shareMetadata } from "@/lib/share-metadata";
import { OPENING_LINE, stayCount } from "@/lib/stay-count";
import { breadcrumbJsonLd } from "@/lib/structured-data";

/**
 * "Where to stay in Rwanda": every district with a destination page, the way
 * into `/stays/<district>` (`data/destination-pages.ts`).
 *
 * Counts are live, on the same minute the home page reads them, and a district
 * with nothing listed says so in words rather than printing a zero
 * (`lib/stay-count.ts`).
 */
export const revalidate = 60;

const DESCRIPTION =
  "Where to stay in Rwanda, district by district: Kigali, Musanze and the volcanoes, Lake Kivu, Huye and Akagera. Verified places to stay, paid by mobile money.";

export const metadata: Metadata = {
  title: "Where to stay in Rwanda",
  description: DESCRIPTION,
  alternates: { canonical: "/stays" },
  ...shareMetadata({ title: "Where to stay in Rwanda", description: DESCRIPTION, path: "/stays" }),
};

export default async function StaysIndexPage() {
  const all = await databaseListings();
  const countIn = (slug: string) => all.filter((stay) => stay.district === slug).length;

  return (
    <div className="flex flex-col items-center bg-background">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Where to stay", path: "/stays" },
        ])}
      />
      <PageHero
        title="Where to stay in Rwanda"
        trail={[{ label: "Home", href: "/" }, { label: "Where to stay" }]}
        image={{ stem: "rwanda-lake-kivu", alt: "Sunset over Lake Kivu" }}
        lede="Pick a district: what it is known for, how far it is from Kigali, and the verified stays there today."
      />

      <section className="section-y container w-full">
        <ul className="m-0 grid list-none grid-cols-1 gap-6 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {DESTINATIONS.map((place) => (
            <li key={place.slug}>
              <Link
                href={destinationPath(place.slug)}
                className="group flex h-full flex-col overflow-hidden rounded-card bg-card ring-1 ring-border transition-shadow duration-quick hover:shadow-control"
              >
                <span className="relative block aspect-[4/3] overflow-hidden bg-surface-secondary">
                  <ArtDirectedImage
                    stem={place.image.stem}
                    alt={place.image.alt}
                    sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 25vw"
                    width={960}
                    height={720}
                    pictureClassName="block h-full w-full"
                    className="h-full w-full transition-transform duration-travel ease-settle group-hover:scale-105"
                  />
                </span>
                <span className="flex flex-1 flex-col gap-1 p-5">
                  <span className="text-xl font-bold text-foreground">{place.name}</span>
                  <span className="text-sm text-muted-foreground">{place.known}</span>
                  <span className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Car className="size-3.5" aria-hidden />
                    {driveLine(place)}
                  </span>
                  <span className="mt-auto flex items-center justify-between pt-3 text-sm font-semibold text-foreground">
                    {stayCount(countIn(place.slug)) ?? OPENING_LINE}
                    <ArrowRight
                      className="size-4 transition-transform duration-quick group-hover:translate-x-0.5"
                      aria-hidden
                    />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
