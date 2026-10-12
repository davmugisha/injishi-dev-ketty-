import type { Metadata } from "next";
import { fetchPublicProperty, type PublicProperty } from "@/data/public-property";

/**
 * The things every `/property/[slug]` route has to do before it can render.
 *
 * `page.tsx` and `gallery/page.tsx` share one lookup, so a gallery can never
 * keep answering for a property the page has already stopped serving.
 *
 * It lives under `lib/` rather than beside the routes so Next can never mistake
 * it for a route module of its own.
 */

/**
 * The published property the API holds under this slug, or null (ADR-053).
 *
 * The database is the only source. A curated catalogue of fictional stays used
 * to own the page for its own slugs and was removed on 2026-10-08, so a page
 * now shows exactly what the business published and disappears the moment it
 * stops being public.
 *
 * An API that could not be asked is not an answer: this THROWS rather than
 * returning null, so the route renders an error for this request instead of a
 * 404 that would be cached over a live listing until the next revalidation.
 */
export async function resolvePropertyPage(slug: string): Promise<PublicProperty | null> {
  const read = await fetchPublicProperty(slug);
  if (read.status === "found") return read.property;
  if (read.status === "unreachable") {
    throw new Error(`The property read for "${slug}" could not reach the API.`);
  }
  return null;
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
  build: (property: PublicProperty, slug: string) => Metadata,
): Promise<Metadata> {
  const { slug } = await params;
  const property = await resolvePropertyPage(slug);
  if (!property) return {};
  return build(property, slug);
}
