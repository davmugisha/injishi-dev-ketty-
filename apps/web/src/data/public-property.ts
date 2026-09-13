import { PropertyDetail } from "@injishi/contracts";
import { unstable_cache } from "next/cache";
import { API_URL } from "@/lib/api";

/**
 * A published database property, read by the SERVER for its public page
 * (ADR-053, owner ruling of 2026-09-13, amended the same day).
 *
 * `/property/[slug]` renders a curated catalogue record where one exists and asks
 * this only when none does (see `resolvePropertyPage`). The question has three
 * answers rather than two on purpose:
 *
 * - `found`: the API holds a public property at this slug. The page renders it
 *   from these database fields and nothing else.
 * - `absent`: the API answered and holds no public property here: never
 *   published, unpublished, or its business suspended. The catalogue may still
 *   hold a record for the slug.
 * - `unreachable`: we could not ask. Kept apart from `absent` for the reason
 *   `lib/api.ts` keeps `failed` apart from a refusal: reading an outage as "this
 *   property does not exist" would put a 404 over a live listing.
 *
 * The photographs are the API's photo route URLs, which never expire, so a
 * cached answer cannot hold a dead image, and the route itself refuses the
 * moment the property stops being public.
 */
export type PublicProperty = PropertyDetail;

export type PublicPropertyRead =
  | { status: "found"; property: PublicProperty }
  | { status: "absent" }
  | { status: "unreachable" };

/**
 * How long an answer is served before it is asked again.
 *
 * The ceiling, give or take one request, on how long a suspended or unpublished
 * property keeps its page. The routes mirror it as their own `revalidate`
 * literal, because Next reads that export statically.
 */
export const PUBLIC_PROPERTY_REVALIDATE_SECONDS = 30;

/** A read the page is still waiting on after this long is treated as unreachable. */
const READ_TIMEOUT_MS = 8_000;

/**
 * The cached question.
 *
 * `unstable_cache` around a plain fetch, and NOT \`fetch(url, { next: { revalidate
 * } })\`, which is what this was first written with and what failed its own
 * check. Next's fetch cache stores a response only when its status is 200, so
 * once a property's read turned into a 404 the background revalidation threw
 * the 404 away and the stale 200 was served again on every request: a suspended
 * property kept its page indefinitely. Caching the RESULT instead means
 * `absent` replaces `found` like any other answer.
 *
 * An unreadable answer throws rather than returning, and a thrown revalidation
 * is not stored. So during an API outage the last good answer keeps being
 * served, and a first read with nothing cached reports `unreachable`.
 */
const readPublicProperty = unstable_cache(
  async (slug: string): Promise<Exclude<PublicPropertyRead, { status: "unreachable" }>> => {
    const res = await fetch(
      `${API_URL}/api/v1/properties/slug/${encodeURIComponent(slug)}`,
      { cache: "no-store", signal: AbortSignal.timeout(READ_TIMEOUT_MS) },
    );
    if (res.status === 404) return { status: "absent" };
    if (!res.ok) throw new Error(`property read answered ${res.status}`);
    // Parsed, not cast: an answer that does not match the contract is one we
    // could not read, and rendering it would put whatever it held on the page.
    const parsed = PropertyDetail.safeParse(await res.json());
    if (!parsed.success) throw new Error("property read did not match the contract");
    return { status: "found", property: parsed.data };
  },
  ["public-property-by-slug"],
  { revalidate: PUBLIC_PROPERTY_REVALIDATE_SECONDS },
);

export async function fetchPublicProperty(slug: string): Promise<PublicPropertyRead> {
  try {
    return await readPublicProperty(slug);
  } catch {
    return { status: "unreachable" };
  }
}
