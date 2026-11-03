import { ArrowRight, Car, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
  Button,
} from "@injishi/web-ui";
import { GuideCard } from "@/components/guides/guide-card";
import { ShelfStayCard } from "@/components/home/shelf-stay-card";
import { JsonLd } from "@/components/shared/json-ld";
import { PageHero } from "@/components/shared/page-hero";
import { SectionHeading } from "@/components/shared/section-heading";
import {
  DESTINATIONS,
  destinationFaq,
  destinationPath,
  driveLine,
  findDestination,
  guidesFor,
} from "@/data/destination-pages";
import { databaseListings } from "@/data/discovery";
import { findGuide } from "@/data/guides";
import { EMPTY_INTENT, exploreHref } from "@/lib/search-params";
import { shareMetadata } from "@/lib/share-metadata";
import { LIST_HREF, stayCount } from "@/lib/stay-count";
import { breadcrumbJsonLd, faqPageJsonLd, stayListJsonLd } from "@/lib/structured-data";
import { supportHref } from "@/lib/support-intent";

/**
 * "Where to stay in <district>": one district's live stays, on a page of its
 * own that a search engine can read (`data/destination-pages.ts` says why).
 *
 * Every district page is prerendered and refreshed on the same minute the home
 * page and Explore read the catalogue on (`databaseListings`, revalidate 60),
 * so a property published in Musanze reaches this page without a rebuild. A
 * district with nothing listed still renders, as an honest empty state with
 * the way in for an owner there, because the page is worth having indexed
 * before its first stay arrives.
 */
export const revalidate = 60;

export function generateStaticParams() {
  return DESTINATIONS.map((place) => ({ district: place.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ district: string }>;
}): Promise<Metadata> {
  const { district } = await params;
  const place = findDestination(district);
  if (!place) return {};
  const title = `Where to stay in ${place.name}, Rwanda`;
  const description = `Verified places to stay in ${place.name}: ${place.known.toLowerCase()}. ${driveLine(place)}. Book on Injishi and pay by mobile money, held in escrow.`;
  return {
    title,
    description,
    alternates: { canonical: destinationPath(place.slug) },
    ...shareMetadata({
      title,
      description,
      path: destinationPath(place.slug),
      image: `/assets/${place.image.stem}.jpg`,
      imageAlt: place.image.alt,
    }),
  };
}

export default async function DestinationPage({
  params,
}: {
  params: Promise<{ district: string }>;
}) {
  const { district } = await params;
  const place = findDestination(district);
  if (!place) notFound();

  const stays = (await databaseListings()).filter((stay) => stay.district === place.slug);
  const count = stayCount(stays.length);
  const faq = destinationFaq(place, stays.length);
  const guides = guidesFor(place.slug)
    .map((slug) => findGuide(slug))
    .filter((guide) => guide !== undefined);
  const elsewhere = DESTINATIONS.filter((other) => other.slug !== place.slug);
  const exploreHere = exploreHref({ ...EMPTY_INTENT, districts: [place.slug] });

  return (
    <div className="flex flex-col items-center bg-background">
      <JsonLd
        data={breadcrumbJsonLd([
          { name: "Home", path: "/" },
          { name: "Where to stay", path: "/stays" },
          { name: place.name, path: destinationPath(place.slug) },
        ])}
      />
      {stays.length > 0 ? (
        <JsonLd
          data={stayListJsonLd(
            `Places to stay in ${place.name}`,
            stays.map((stay) => ({
              name: `${stay.nameLead}${stay.nameRest ? ` ${stay.nameRest}` : ""}`,
              slug: stay.slug,
            })),
          )}
        />
      ) : null}
      <JsonLd data={faqPageJsonLd(faq)} />

      <PageHero
        title={`Where to stay in ${place.name}`}
        trail={[
          { label: "Home", href: "/" },
          { label: "Where to stay", href: "/stays" },
          { label: place.name },
        ]}
        image={place.image}
        lede={place.known}
      />

      <section className="section-y container flex w-full flex-col gap-8">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
          <span className="flex items-center gap-1.5">
            <MapPin className="size-4" aria-hidden />
            {place.province}
          </span>
          <span className="flex items-center gap-1.5">
            <Car className="size-4" aria-hidden />
            {driveLine(place)}
          </span>
          <span className="flex flex-wrap gap-1.5">
            {place.bestFor.map((tag) => (
              <span key={tag.label} className="rounded-full bg-surface-secondary px-2.5 py-1 text-xs font-medium text-foreground">
                {tag.label}
              </span>
            ))}
          </span>
        </div>

        <SectionHeading
          lead="Stays in "
          emphasis={place.name}
          lede={count ? `${count}, each verified before it was listed.` : undefined}
          action={count ? { label: "Search with dates", href: exploreHere } : undefined}
        />

        {stays.length > 0 ? (
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {stays.map((stay) => (
              <ShelfStayCard key={stay.slug} listing={stay} />
            ))}
          </div>
        ) : (
          <div className="flex flex-col gap-4 rounded-card bg-card p-6 ring-1 ring-border md:p-8">
            <p className="text-lg font-semibold text-foreground">
              Nothing is listed in {place.name} yet.
            </p>
            <p className="max-w-read text-sm text-muted-foreground">
              Injishi lists a place only after it has passed verification: an RRA TIN check, then an
              officer's online review of its documents. Own a guesthouse, lodge or apartment in {place.name}? It
              could be the first one here.
            </p>
            <div className="flex flex-wrap gap-3">
              <Button asChild>
                <Link href={LIST_HREF}>List your place</Link>
              </Button>
              <Button asChild variant="outline">
                <Link href={supportHref("opening")}>Tell me when stays open here</Link>
              </Button>
            </div>
          </div>
        )}
      </section>

      {guides.length > 0 ? (
        <section className="section-y container flex w-full flex-col gap-8">
          <SectionHeading lead="Read before " emphasis="you go" action={{ label: "All guides", href: "/guides" }} />
          <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
            {guides.map((guide) => (
              <GuideCard key={guide.slug} guide={guide} size="sm" />
            ))}
          </div>
        </section>
      ) : null}

      <section id="faq" className="section-y container w-full">
        <SectionHeading lead={`${place.name}: `} emphasis="questions" className="mb-8" />
        <Accordion type="single" collapsible defaultValue={faq[0]?.question}>
          {faq.map((entry) => (
            <AccordionItem key={entry.question} value={entry.question}>
              <AccordionTrigger className="text-page-fg">{entry.question}</AccordionTrigger>
              <AccordionContent className="max-w-read text-page-fg-70">{entry.answer}</AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </section>

      <section className="section-y container w-full">
        <SectionHeading lead="Elsewhere in " emphasis="Rwanda" className="mb-6" />
        <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
          {elsewhere.map((other) => (
            <li key={other.slug}>
              <Link
                href={destinationPath(other.slug)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-line px-5 py-2.5 text-sm text-page-fg transition-colors duration-travel hover:border-ink"
              >
                {other.name}
                <ArrowRight className="size-4" aria-hidden />
              </Link>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
