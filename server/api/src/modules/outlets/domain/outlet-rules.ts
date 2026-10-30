import {
  OutletRelationshipType,
  type OutletRelationshipType as Relationship,
} from '@injishi/contracts';

/**
 * THE PURE RULES BEHIND AN OUTLET WRITE (ADR-050 D-h to D-l).
 *
 * Kept free of a database and a clock so each one can be tested on its own:
 * which arrangements a kind may carry, whose TIN signs a sale, and the public
 * address a standalone outlet is minted.
 */

/** `outlets.allowed_relationships`, keyed by outlet kind with `*` as the fallback. */
export type RelationshipPolicy = Record<string, Relationship[]>;

/** What an absent or unreadable config row means: only the hotel may run anything. */
export const FAIL_CLOSED_POLICY: RelationshipPolicy = { '*': ['hotel_operated'] };

/**
 * Read the config row's value into a policy.
 *
 * An unreadable value FAILS CLOSED rather than open (D-i): a typo in the row
 * must never let a spa be leased to a stranger. A key whose list holds an
 * unknown arrangement keeps only the ones it can name, and a key left with none
 * is dropped, so it falls through to `*`.
 */
export function readRelationshipPolicy(value: unknown): RelationshipPolicy {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return FAIL_CLOSED_POLICY;
  }
  const policy: RelationshipPolicy = {};
  for (const [kind, list] of Object.entries(value as Record<string, unknown>)) {
    if (!Array.isArray(list)) continue;
    const known = list.filter(
      (v): v is Relationship => OutletRelationshipType.safeParse(v).success,
    );
    if (known.length > 0) policy[kind] = [...new Set(known)];
  }
  return Object.keys(policy).length > 0 ? policy : FAIL_CLOSED_POLICY;
}

/** `value[kind] ?? value['*']`, and `hotel_operated` alone when neither exists. */
export function allowedRelationshipsFor(
  policy: RelationshipPolicy,
  outletKind: string,
): Relationship[] {
  return policy[outletKind] ?? policy['*'] ?? FAIL_CLOSED_POLICY['*'];
}

/**
 * Whose TIN signs a sale made at this outlet (D-j).
 *
 * `hotel_operated`: the property's org, or the workspace's own org for an
 * outlet with no property. Anything else: the operator party's org. Null when
 * the input cannot name one, which the caller refuses rather than guesses.
 */
export function taxEntityFor(input: {
  relationshipType: Relationship;
  propertyOrgId: string | null;
  workspaceOrgId: string | null;
  operatorOrgId: string | null;
}): string | null {
  if (input.relationshipType === 'hotel_operated') {
    return input.propertyOrgId ?? input.workspaceOrgId;
  }
  return input.operatorOrgId;
}

/**
 * A url safe base for a standalone outlet's public address (D-l).
 *
 * Accents fold to their letter, anything else that is not a letter or digit
 * becomes one hyphen. Never empty, because a slug of `""` is a page at the
 * directory root.
 */
export function slugBase(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60)
    .replace(/-+$/g, '');
  return slug.length > 0 ? slug : 'outlet';
}

/** `base`, else `base-2`, `base-3`, … the first one not already taken. */
export function firstFreeSlug(base: string, taken: ReadonlySet<string>): string {
  if (!taken.has(base)) return base;
  for (let n = 2; ; n += 1) {
    const candidate = `${base}-${n}`;
    if (!taken.has(candidate)) return candidate;
  }
}

const KIND_LABEL: Record<string, string> = {
  room_service: 'room service',
  gift_shop: 'gift shop',
  business_center: 'business centre',
};

/** `gift_shop` → `gift shop`, for a refusal a person reads. */
export function kindLabel(kind: string): string {
  return KIND_LABEL[kind] ?? kind.replace(/_/g, ' ');
}

/** `leased_tenant` → `leased tenant`. */
export function relationshipLabel(relationship: Relationship): string {
  return relationship.replace(/_/g, ' ');
}

/** The sentence a disallowed pair is refused with (AC-14). */
export function disallowedPairSentence(
  outletKind: string,
  relationship: Relationship,
  allowed: readonly Relationship[],
): string {
  const kind = kindLabel(outletKind);
  const list = allowed.map(relationshipLabel).join(', ');
  return `A ${kind} outlet cannot be ${relationshipLabel(relationship)}. It may be: ${list}.`;
}
