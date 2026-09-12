import {
  ACCOMMODATION_CLASS_LABEL,
  AccommodationClass,
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
  | "bar_restaurant";

export interface RegistrationKindEntry {
  value: RegistrationKind;
  label: string;
  blurb: string;
  /** Which of the three groups the tile sits in on the card. */
  group: "stay" | "venue" | "lease";
}

const RESIDENCE_LABEL = "Residence";
const BROKER_LABEL = "Broker";
const BAR_RESTAURANT_LABEL = "Bar & Restaurant";

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
  { value: "residence", blurb: "Let on a lease, not nightly", group: "lease" },
  { value: "broker", blurb: "You place tenants for owners", group: "lease" },
];

export const REGISTRATION_KINDS: RegistrationKindEntry[] = ENTRIES.map(
  ({ value, blurb, group }) => ({
    value,
    label:
      value === "residence"
        ? RESIDENCE_LABEL
        : value === "broker"
          ? BROKER_LABEL
          : value === "bar_restaurant"
            ? BAR_RESTAURANT_LABEL
            : ACCOMMODATION_CLASS_LABEL[value],
    blurb,
    group,
  }),
);

/** Read a kind back off the query string, checked against the list above. */
export function findRegistrationKind(
  value: string | null | undefined,
): RegistrationKindEntry | null {
  if (!value) return null;
  return REGISTRATION_KINDS.find((k) => k.value === value) ?? null;
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
  accommodationClass: AccommodationClass | null;
  /** Only meaningful on a hospitality registration; null on the other two. */
  entityGroup: RdbEntityGroup | null;
  /** The free text that must accompany `other`, when the tile already knows it. */
  accommodationClassOther: string | null;
} {
  if (kind === "broker")
    return {
      role: "broker",
      accommodationClass: null,
      entityGroup: null,
      accommodationClassOther: null,
    };
  if (kind === "residence")
    return {
      role: "landlord",
      accommodationClass: null,
      entityGroup: null,
      accommodationClassOther: null,
    };
  // A bar & restaurant is a hospitality org in the `restaurant_bar_nightclub`
  // entity group. The group is the classification that actually describes it;
  // `accommodation_class` is still `not null` for every hospitality org (the
  // `orgs_domain_shape` check), and RDB has no accommodation class for a venue
  // with no rooms, so `other` plus the name is the honest pair — the same escape
  // D24 built for a place that does not fit the eight. It is filled in HERE
  // rather than typed by the registrant, because this tile already knows it.
  if (kind === "bar_restaurant")
    return {
      role: "host",
      accommodationClass: "other",
      entityGroup: "restaurant_bar_nightclub",
      accommodationClassOther: BAR_RESTAURANT_LABEL,
    };
  return {
    role: "host",
    accommodationClass: kind,
    entityGroup: "accommodation",
    accommodationClassOther: null,
  };
}

/**
 * The one sentence that says what this kind of registration involves.
 *
 * Shown under the confirmed tile on step 1, so a person who carried an answer
 * in from `/host` still learns what they are about to be asked — the old
 * summary said only the label back, which reads as a receipt rather than as a
 * step.
 */
export function whatWeAskFor(kind: RegistrationKind): string {
  switch (kind) {
    case "broker":
      return "We need your National ID and your contact details. There is no fee and no waiting.";
    case "residence":
      return "We need the UPI of the property, your address, and any documents you hold.";
    case "bar_restaurant":
      return "We need your 9 digit RRA TIN, your address, and any licences you hold for serving food or drink.";
    default:
      return "We need your 9 digit RRA TIN, your address, and any certificates you hold.";
  }
}
