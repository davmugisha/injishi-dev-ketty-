import type { Metadata } from "next";
import type { PropertyDetail } from "@/data/properties";
import { catalogueStaticParams, findCatalogueProperty } from "@/data/catalogue";
import { fetchPublicProperty, type PublicProperty } from "@/data/public-property";

/**
 * The things every `/property/[slug]` route has to do before it can render.
 *
 * `page.tsx` and `gallery/page.tsx` were carrying identical bodies for both:
 * the same static-params map and the same "await the params, look the slug up,
 * give up quietly if it is unknown" preamble. Two copies of a lookup is how a
 * gallery keeps answering for a property the page has already stopped serving.
 *
 * It lives under `lib/` rather than beside the routes so Next can never mistake
 * it for a route module of its own.
 */

/**
 * What a property page shows, and where it came from.
 *
 * `database` is a published property the API holds, rendered from its database
 * fields only. `catalogue` is the curated directory record, whether or not the
 * API also sells rooms under its slug (the booking widget asks). The two are different shapes on purpose:
 * a database property has no rating, no highlights and no curated amenity list,
 * and giving it the catalogue's shape would invite a page to fill those in.
 */
export type PropertyPageSource =
  | { kind: "database"; property: PublicProperty }
  | { kind: "catalogue"; property: PropertyDetail };

/**
 * The catalogue record where one exists, then the API, then nothing (ADR-053,
 * owner ruling of 2026-09-13, amended the same day).
 *
 * **The amendment.** The ruling read the API first, so a slug with both a
 * curated record and a published database property rendered from database
 * fields only. Every one of the 52 catalogue slugs is exactly that pair once
 * `seed-demo-catalogue.mjs` writes its slugs, and the database half of each is a
 * photoless demo row whose description opens `DEMO SAMPLE DATA`. Reading the API
 * first would have swapped every curated page for that. So the curated record
 * owns the PAGE, and the API still owns whether the stay can be SOLD: the
 * booking widget asks it for the rooms behind the same slug, so a suspended or
 * unpublished property keeps its directory page and loses its checkout.
 *
 * A database property that does not exist in the catalogue still gets a page
 * of its own, and still disappears the moment it stops being public.
 *
 * An API that could not be asked is not an answer. Without a catalogue record
 * this THROWS rather than returning null, so the route renders an error for
 * this request instead of a 404 that would be cached over a live listing until
 * the next revalidation.
 */
export async function resolvePropertyPage(slug: string): Promise<PropertyPageSource | null> {
  const curated = findCatalogueProperty(slug);
  if (curated) return { kind: "catalogue", property: curated };

  const read = await fetchPublicProperty(slug);
  if (read.status === "found") return { kind: "database", property: read.property };

  if (read.status === "unreachable") {
    throw new Error(`The property read for "${slug}" could not reach the API.`);
  }
  return null;
}

/**
 * Every CATALOGUE slug, for a route that renders catalogue data only.
 *
 * The menu route is the one caller: its dining data exists for curated
 * properties and for nothing the API holds. The property page and its gallery
 * do not prerender from this list: a slug with no curated record reads the API,
 * and a page built at build time would keep a suspended property's page until
 * the next deploy.
 */
export function propertyStaticParams(): { slug: string }[] {
  return catalogueStaticParams();
}

/**
 * Resolve the slug and build that page's metadata.
 *
 * An unknown slug returns `{}` and leaves the 404 to the page itself, which is
 * the only place that can call `notFound()`. The read is the same fetch the page
 * makes, so Next serves both from one request.
 */
export async function propertyMetadata(
  params: Promise<{ slug: string }>,
  build: (source: PropertyPageSource, slug: string) => Metadata,
): Promise<Metadata> {
  const { slug } = await params;
  const source = await resolvePropertyPage(slug);
  if (!source) return {};
  return build(source, slug);
}
