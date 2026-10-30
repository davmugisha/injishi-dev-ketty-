import {
  ACCOMMODATION_CLASS_LABEL,
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
 * `bar_restaurant` is in BOTH lists. It is a hospitality business like a hotel,
 * priced and gated the same way, and it differs only in its RDB entity group:
 * §1 of the classification names `restaurant_bar_nightclub` beside
 * `accommodation`, and `orgs.rdb_entity_group` has stored both since the first
 * migration. So the tile needs no new vocabulary anywhere — see
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
  label: string;
  blurb: string;
  /** Which of the three groups the tile sits in on the card. */
  group: "stay" | "venue" | "lease";
}

const RESIDENCE_LABEL = "Residence";
const BROKER_LABEL = "Broker";
const BAR_RESTAURANT_LABEL = "Bar & Restaurant";
const COFFEE_SHOP_LABEL = "Coffee Shop";

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
 * The eight labels come from `ACCOMMODATION_CLASS_LABEL`, never retyped, so
 * this card and the search rail always say the same word for the same class.
 */
const ENTRIES: ReadonlyArray<{
  value: RegistrationKind;
  blurb: string;
  group: "stay" | "venue" | "lease";
}> = [
  { value: "hotel", blurb: "Serviced rooms, front desk", group: "stay" },
  { value: "motel", blurb: "Roadside rooms, drive-up", group: "stay" },
  { value: "tented_camp", blurb: "Canvas on a fixed site", group: "stay" },
  { value: "guest_house", blurb: "Rooms in your own home", group: "stay" },
  { value: "apartment", blurb: "A flat with its own key", group: "stay" },
  { value: "lodge", blurb: "Built for stays, with grounds", group: "stay" },
  { value: "villa", blurb: "A whole house, one party", group: "stay" },
  { value: "other", blurb: "Something else — you tell us", group: "stay" },
  {
    value: "bar_restaurant",
    blurb: "Food and drink, no rooms",
    group: "venue",
  },
  { value: "coffee_shop", blurb: "Coffee and a bite, no rooms", group: "venue" },
  { value: "residence", blurb: "Let on a lease, not nightly", group: "lease" },
];

/**
 * A broker is outside the register (ADR-075 AC-1): it keeps its own short form
 * (`POST /registrations/broker`) and is never a tile on the chooser. The value
 * stays known, so `/register?kind=broker` still opens that form.
 */
const BROKER_ENTRY = { value: "broker" as const, blurb: "You place tenants for owners", group: "lease" as const };

function entryOf({ value, blurb, group }: { value: RegistrationKind; blurb: string; group: "stay" | "venue" | "lease" }): RegistrationKindEntry {
  return {
    value,
    label:
      value === "residence"
        ? RESIDENCE_LABEL
        : value === "broker"
          ? BROKER_LABEL
          : value === "bar_restaurant"
            ? BAR_RESTAURANT_LABEL
            : value === "coffee_shop"
              ? COFFEE_SHOP_LABEL
              : ACCOMMODATION_CLASS_LABEL[value],
    blurb,
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

