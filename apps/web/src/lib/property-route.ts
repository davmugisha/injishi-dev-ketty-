import type { Metadata } from "next";
import type { PropertyDetail } from "@/data/properties";
import { catalogueStaticParams, findCatalogueProperty } from "@/data/catalogue";

/**
 * The two things every `/property/[slug]` route has to do before it can render.
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
 * Every property slug, for `generateStaticParams`.
 *
 * The WHOLE catalogue, real and sample. It read the real half only, and the
 * explore list now draws from both, so a sample card would have linked to a
 * page Next never generated.
 */
export function propertyStaticParams(): { slug: string }[] {
  return catalogueStaticParams();
}

/**
 * Resolve the slug and build that property's metadata.
 *
 * An unknown slug returns `{}` — the same empty metadata both routes returned
 * before — and leaves the 404 to the page itself, which is the only place that
 * can call `notFound()`.
 */
export async function propertyMetadata(
  params: Promise<{ slug: string }>,
  build: (property: PropertyDetail) => Metadata,
): Promise<Metadata> {
  const { slug } = await params;
  const property = findCatalogueProperty(slug);
  if (!property) return {};
  return build(property);
}
