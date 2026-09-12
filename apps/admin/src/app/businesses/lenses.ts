/**
 * The lenses a business record carries, and where each one lives.
 *
 * WHY THIS FILE EXISTS. The list used to sit in `lib/data/org-record.ts`
 * alongside `findOrg`, which searched a hand-written fixture array. That module
 * is the console's old world and the screens no longer import it — but the lens
 * list is not fixture data, it is the shape of the route tree, so it moves here
 * next to the routes it names rather than dying with the fixtures.
 *
 * WHAT CHANGED WITH IT. `orgHref` took a legal name and slugged it, because the
 * fixture directory had no id. `AdminOrgRow.id` is a real uuid, so the address
 * of a business is now its id: two businesses may legitimately share a legal
 * name, and a slug would have quietly opened the wrong record.
 *
 * The first lens is the default and lives at the record's own address, so
 * `/businesses/[orgId]` is a real page rather than a redirect. Every other lens
 * is its own segment, because a lens that is not addressable cannot be sent to
 * a colleague (ADR-018, D-c).
 */
export const ORG_LENSES = [
  { key: "profile", label: "Profile" },
  { key: "properties", label: "Properties" },
  { key: "people", label: "People" },
  { key: "money", label: "Money" },
  { key: "subscription", label: "Subscription" },
  { key: "obo-audit", label: "On behalf of" },
  { key: "timeline", label: "Timeline" },
] as const;

export type OrgLens = (typeof ORG_LENSES)[number]["key"];

/** The canonical address of one business. */
export function orgHref(orgId: string): string {
  return `/businesses/${orgId}`;
}
