import {
  AccommodationClass,
  BUSINESS_KIND_NOUN,
  type BusinessKind,
  type RdbEntityGroup,
  type RegistrantRole,
} from "@injishi/contracts";

/**
 * The ONE question the registration wizard opens with (ADR-026, AC-1 and AC-2).
 *
 * This replaces two questions that were the same question. The wizard used to
 * ask "what are you registering?" (host, landlord, broker) and then, two steps
 * later, "what kind of place is it?" (the eight accommodation classes) — while
 * `/host` had already asked the second one on the way in. Three asks, one
 * answer, and two of them were derivable from the third: a Villa is a host
 * registering a hospitality business, and nothing else.
 *
 * So the union below is the real answer space. Ten tiles, and the role, the
 * domain and the accommodation class all fall out of whichever one is pressed.
 * `registrationForKind` is the whole derivation and it is the only place that
 * mapping exists.
 *
 * It is a superset of `HostKind` (`data/host.ts`, which the `/host` chooser
 * owns) rather than the same type, and deliberately:
 *
 * - `other` is here and absent from `/host`. That card asks a host what they
 *   have and "Other" is not something anyone arrives with; this one is the
 *   registration form, where D24 requires the free-text escape.
 * - `broker` is here and absent from `/host`. A broker lists no accommodation,
 *   so the listing funnel has nothing to say to them — but the registration
 *   funnel is where they start, and the old wizard offered a Broker card that
 *   refused every press.
 *
 * `bar_restaurant` and `coffee_shop` are in BOTH lists. Each is a hospitality
 * business like a hotel, priced and gated the same way, and differs only in its
 * RDB entity group: §1 of the classification names `restaurant_bar_nightclub`
 * beside `accommodation`, and `orgs.rdb_entity_group` has stored both since the
 * first migration. So the tiles need no new vocabulary anywhere — see
 * `registrationForKind`, which is where the group is set.
 */
export type RegistrationKind =
  | AccommodationClass
  | "residence"
  | "broker"
  | "bar_restaurant"
  | "coffee_shop";

interface RegistrationKindEntry {
  value: RegistrationKind;
  /** The catalog key for the tile's title, under `register.kinds.items.<value>`. */
  labelKey: string;
  /** The catalog key for the tile's one line, under `register.kinds.items.<value>`. */
  blurbKey: string;
  /** Which of the three groups the tile sits in on the card. */
  group: "stay" | "venue" | "lease";
}

/**
 * The tiles, in the order they are shown.
 *
 * Grouped rather than listed flat, because the three groups are answering
 * different questions. The first eight are "what shape is the place" — one
 * hospitality business, priced and gated as one. The ninth is the same kind of
 * business serving a table rather than a bed, which is a different answer to
 * "what do guests buy" and so a group of its own rather than a ninth building.
 * The last two are "on what terms" — a residence let on a lease, and a person
 * who places tenants in someone else's. Mixing them into one eleven-up grid is
 * what made the old role question feel necessary.
 *
 * WHAT A TILE SAYS IS A CATALOG KEY, not a string. The label and the one line
 * under it live in `@injishi/i18n` under `register.kinds.items.<value>`, so the
 * same eleven answers exist in English, French and Kinyarwanda and a tile
 * cannot drift from the word the rest of the product uses for that class.
 */
const ENTRIES: ReadonlyArray<{
  value: RegistrationKind;
  group: "stay" | "venue" | "lease";
}> = [
  // The same order as the `/host` chooser (`data/host.ts`), so a host who goes
  // back finds the tiles where they left them.
  { value: "hotel", group: "stay" },
  { value: "motel", group: "stay" },
  { value: "guest_house", group: "stay" },
  { value: "lodge", group: "stay" },
  { value: "apartment", group: "stay" },
  { value: "villa", group: "stay" },
  { value: "tented_camp", group: "stay" },
  { value: "other", group: "stay" },
  { value: "bar_restaurant", group: "venue" },
  { value: "coffee_shop", group: "venue" },
  { value: "residence", group: "lease" },
];

/**
 * A broker is outside the register (ADR-075 AC-1): it keeps its own short form
 * (`POST /registrations/broker`) and is never a tile on the chooser. The value
 * stays known, so `/register?kind=broker` still opens that form.
 */
const BROKER_ENTRY = { value: "broker" as const, group: "lease" as const };

function entryOf({
  value,
  group,
}: {
  value: RegistrationKind;
  group: "stay" | "venue" | "lease";
}): RegistrationKindEntry {
  return {
    value,
    labelKey: `kinds.items.${value}.label`,
    blurbKey: `kinds.items.${value}.blurb`,
    group,
  };
}

/** The chooser's tiles: Stay, Food and drink, Lease (ADR-075 AC-1). */
export const REGISTRATION_KINDS: RegistrationKindEntry[] = ENTRIES.map(entryOf);

const KNOWN_KINDS: RegistrationKindEntry[] = [...REGISTRATION_KINDS, entryOf(BROKER_ENTRY)];

/**
 * A kind as it reads mid sentence, with its article: "a coffee shop", "an
 * apartment", and "a business" for a kind with no noun of its own (Other). The
 * noun is `BUSINESS_KIND_NOUN`'s, the same word the heading says, so "a Apartment"
 * and "a Other" from a Title Case tile label cannot come back.
 */
export function kindInSentence(kind: BusinessKind | null): string {
  const noun = (kind ? BUSINESS_KIND_NOUN[kind] : null) ?? "business";
  return `${/^[aeiou]/i.test(noun) ? "an" : "a"} ${noun}`;
}

/** Read a kind back off the query string, checked against the list above. */
export function findRegistrationKind(
  value: string | null | undefined,
): RegistrationKindEntry | null {
  if (!value) return null;
  return KNOWN_KINDS.find((k) => k.value === value) ?? null;
}

/**
 * What a chosen tile means (D23, D24) — the whole derivation, in one place.
 *
 * `businessTypeFor` in `@injishi/contracts` sends `host` to the hospitality fee
 * and domain and `landlord` to the residence one, and a residence is precisely
 * the kind that carries a UPI rather than a TIN. So a residence can only open a
 * landlord registration and the eight classes can only open host ones. That is
 * a rule the database enforces, not a preference, which is why nothing else in
 * the wizard is allowed to decide it.
 *
 * `accommodationClass` is null for a residence and for a broker, because
 * neither branch is ever asked that question.
 */
export function registrationForKind(kind: RegistrationKind): {
  role: RegistrantRole;
  /** What the org carries (ADR-075 D-h); a stay's kind is its class. */
  businessKind: BusinessKind;
  accommodationClass: AccommodationClass | null;
  /** Only meaningful on a hospitality registration; null on the other two. */
  entityGroup: RdbEntityGroup | null;
  /** The free text that must accompany `other`, when the tile already knows it. */
  accommodationClassOther: string | null;
} {
  if (kind === "broker")
    return {
      role: "broker",
      businessKind: "broker",
      accommodationClass: null,
      entityGroup: null,
      accommodationClassOther: null,
    };
  if (kind === "residence")
    return {
      role: "landlord",
      businessKind: "residence",
      accommodationClass: null,
      entityGroup: null,
      accommodationClassOther: null,
    };
  // A venue (Bar & Restaurant, Coffee Shop) is a hospitality org in the
  // `restaurant_bar_nightclub` entity group with a kind and NO accommodation
  // class (ADR-075 D-h, AC-31). It used to be `other` plus the free text
  // "Bar & Restaurant", because the org had nowhere else to say what it was.
  if (kind === "bar_restaurant" || kind === "coffee_shop")
    return {
      role: "host",
      businessKind: kind,
      accommodationClass: null,
      entityGroup: "restaurant_bar_nightclub",
      accommodationClassOther: null,
    };
  return {
    role: "host",
    businessKind: kind,
    accommodationClass: kind,
    entityGroup: "accommodation",
    accommodationClassOther: null,
  };
}

