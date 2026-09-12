import {
  ACCOMMODATION_CLASS_LABEL,
  type AccommodationClass,
  type RegistrantRole,
} from "@injishi/contracts";

/**
 * Content for `/host` — the "List your accommodation" funnel.
 *
 * Shaped after the reference funnel at
 * apps.expediapartnercentral.com/en_US/list, which opens on an accommodation-type
 * chooser rather than a form: the first thing it asks is what kind of place you
 * have, and every later step narrows from that answer. The copy is ours; only
 * the order of the questions is borrowed.
 */

/**
 * What the chooser may offer: any hospitality class, plus `residence` and
 * `bar_restaurant`.
 *
 * Neither extra value is an `AccommodationClass`, and neither may ever be added
 * to one. D24 fixes that enum at eight HOSPITALITY classes and the schema marks
 * `orgs.accommodation_class` "hospitality only".
 *
 * - `residence` is the other org type entirely — it carries a UPI rather than a
 *   TIN, it is classified by `ResidenceClass`, and its occupancy is a lease
 *   rather than a booking.
 * - `bar_restaurant` is a hospitality org in a DIFFERENT RDB entity group. §1 of
 *   the classification already names `restaurant_bar_nightclub` beside
 *   `accommodation`, and `orgs.rdb_entity_group` already stores it, so this tile
 *   needs no new vocabulary — only a tile that sets that group. Putting it in
 *   `AccommodationClass` instead would push a venue with no rooms into the
 *   search filter rail and into every "what shape is the stay" list, which is
 *   the one thing it is not.
 *
 * The union is widened HERE, at the one screen that asks all three questions in
 * one card, so the contract keeps saying the true thing.
 */
export type HostKind = AccommodationClass | "residence" | "bar_restaurant";

export interface HostPropertyKind {
  value: HostKind;
  label: string;
  blurb: string;
}

/**
 * The chooser that opens the funnel.
 *
 * Seven values are `AccommodationClass`, the same vocabulary the registration
 * wizard offers and the API stores, so a choice here carries straight through
 * to `/host/start` and on into registration. It used to be a plain `string`
 * that happened to look like the search options, which is how `guesthouse`
 * survived here after the real model had renamed it `guest_house` — a rename
 * that produced a missing icon and no error (ADR-011 call 7).
 *
 * `other` is the eighth class and is deliberately absent: the card asks a
 * question, and "Other" is not an answer a host arrives with. The registration
 * wizard still offers it, with the free-text escape D24 requires.
 *
 * The blurbs are ours. The labels are not: the seven classes derive from
 * `ACCOMMODATION_CLASS_LABEL`, so this card and the filter rail always say the
 * same word for the same class. `residence` and `bar_restaurant` have no entry
 * there — correctly, neither is a class — so their labels are named below.
 */
const RESIDENCE_LABEL = "Residence";
const BAR_RESTAURANT_LABEL = "Bar & Restaurant";

const CHOOSER: ReadonlyArray<{ value: HostKind; blurb: string }> = [
  { value: "hotel", blurb: "Serviced rooms, front desk" },
  { value: "motel", blurb: "Roadside rooms, drive-up" },
  { value: "tented_camp", blurb: "Canvas on a fixed site" },
  { value: "guest_house", blurb: "Rooms in your own home" },
  { value: "apartment", blurb: "A flat with its own key" },
  { value: "lodge", blurb: "Built for stays, with grounds" },
  { value: "villa", blurb: "A whole house, one party" },
  { value: "bar_restaurant", blurb: "Food and drink, no rooms" },
  { value: "residence", blurb: "Let on a lease, not nightly" },
];

export const HOST_PROPERTY_KINDS: HostPropertyKind[] = CHOOSER.map(
  ({ value, blurb }) => ({
    value,
    label:
      value === "residence"
        ? RESIDENCE_LABEL
        : value === "bar_restaurant"
          ? BAR_RESTAURANT_LABEL
          : ACCOMMODATION_CLASS_LABEL[value],
    blurb,
  }),
);

/**
 * Read a `kind` back off the query string.
 *
 * The chooser writes `?kind=` and two later screens read it, so the string is
 * checked against the same list that wrote it rather than trusted: a hand typed
 * `/register?kind=castle` has to land as if no choice was made, not prefill a
 * class the contract does not have. The whole entry is returned rather than the
 * bare value, so the label travels with it and neither reader looks it up twice.
 */
export function findHostKind(
  value: string | null | undefined,
): HostPropertyKind | null {
  if (!value) return null;
  return HOST_PROPERTY_KINDS.find((k) => k.value === value) ?? null;
}

/**
 * What registration a chosen kind opens (D23, D24).
 *
 * This is the whole join between the `/host` funnel and `/register`, and none
 * of it is a preference. `businessTypeFor` in `@injishi/contracts` sends `host`
 * to the hospitality fee and domain and `landlord` to the residence one, and
 * `residence` is precisely the kind that carries a UPI rather than a TIN — so a
 * residence can only open a landlord registration and the seven classes can
 * only open host ones. `accommodationClass` is null for a residence because the
 * residence branch of the wizard never asks that question.
 *
 * `bar_restaurant` is a HOST too — it pays the hospitality fee and carries a
 * TIN, exactly like a hotel. What it does not carry is an accommodation class,
 * so this returns null and `registrationForKind` (which owns the wire shape)
 * supplies the `other` + free-text pair the database `check` requires.
 *
 * The role this returns is PRE-SELECTED, never skipped. D23 asks the role first
 * because it picks the whole path and its price, and an answer given on another
 * page is still worth showing to the person who gave it.
 */
export function registrationForHostKind(kind: HostKind): {
  role: RegistrantRole;
  accommodationClass: AccommodationClass | null;
} {
  if (kind === "residence") return { role: "landlord", accommodationClass: null };
  if (kind === "bar_restaurant") return { role: "host", accommodationClass: null };
  return { role: "host", accommodationClass: kind };
}

export interface HostBenefit {
  title: string;
  body: string;
  icon: "reach" | "payout" | "trust";
}

/** Three reasons, in the order a host actually weighs them: will anyone come,
 *  will I be paid, and can I trust the platform. */
export const HOST_BENEFITS: HostBenefit[] = [
  {
    icon: "reach",
    title: "Reach guests already searching",
    body: "Your listing sits alongside verified stays across Kigali, Musanze, Rubavu and Huye, in front of guests who came to Injishi to book a real place, not to browse.",
  },
  {
    icon: "payout",
    title: "Keep the whole nightly rate",
    body: "Injishi takes no commission from the host. The rate you set is the rate you are paid, released from escrow once your guest has checked in.",
  },
  {
    icon: "trust",
    title: "Arrive already compliant",
    body: "We handle RRA registration and keep your records straight, so the paperwork behind a listing is done before your first booking rather than after it.",
  },
];

export interface HostStep {
  n: number;
  title: string;
  body: string;
}

/** The four things that happen after the chooser. Kept concrete: each step is
 *  a thing Injishi does, not a thing the host has to prepare. */
export const HOST_STEPS: HostStep[] = [
  {
    n: 1,
    title: "Tell us about your place",
    body: "Where it is, how many rooms, what a guest gets. Ten minutes, no documents yet.",
  },
  {
    n: 2,
    title: "We verify it",
    body: "Someone from our team visits, checks the place matches the description, and confirms the address and ownership.",
  },
  {
    n: 3,
    title: "We photograph it",
    body: "A photographer shoots the accommodation at our cost. The images are yours to keep whether or not you list.",
  },
  {
    n: 4,
    title: "You go live",
    body: "Your listing opens to guests with escrow-backed payment and self check-in already switched on.",
  },
];

export interface HostFaqGroup {
  id: string;
  label: string;
  entries: { question: string; answer: string }[];
}

/** Grouped the way the reference groups its FAQ — by the thing you are worried
 *  about, not by topic taxonomy. */
export const HOST_FAQ: HostFaqGroup[] = [
  {
    id: "listing",
    label: "Listing",
    entries: [
      {
        question: "I already list on another site. Can I list here too?",
        answer:
          "Yes. Nothing about Injishi is exclusive. Most of our hosts list in more than one place, and you keep control of your own calendar and rates.",
      },
      {
        question: "What kind of accommodation can I list?",
        answer:
          "Hotels, motels, tented camps, guest houses, apartments, lodges and villas anywhere in Rwanda. Bars and restaurants register here too, and so do residences let on a lease, on the same verification. If you can show you are entitled to run or let the place, it qualifies.",
      },
      {
        question: "How long until my listing is live?",
        answer:
          "Usually under two weeks. The verification visit is the part that takes scheduling; photography and going live follow within a few days of it.",
      },
      {
        question: "Do I have to accept every booking?",
        answer:
          "No. You set your own availability, minimum stay and house rules, and you can close dates at any time without penalty.",
      },
    ],
  },
  {
    id: "payouts",
    label: "Payouts",
    entries: [
      {
        question: "What does Injishi charge the host?",
        answer:
          "Nothing. We take no commission from the host and no listing fee. The rate you set is the rate you are paid.",
      },
      {
        question: "When am I paid?",
        answer:
          "The guest's payment is held in escrow and released to you after check-in. Funds reach your account within three working days of release.",
      },
      {
        question: "What happens if a guest disputes a stay?",
        answer:
          "Our team reviews it before any money moves. Because the payment is still in escrow, neither side is chasing the other for a refund.",
      },
    ],
  },
  {
    id: "compliance",
    label: "Compliance",
    entries: [
      {
        question: "Do you handle RRA registration?",
        answer:
          "Yes. We register the accommodation and keep the records a compliant let requires, so the paperwork is in place before your first guest arrives.",
      },
      {
        question: "What documents do you need from me?",
        answer:
          "Proof of identity and proof that you own or are entitled to let the accommodation. We ask for these after the verification visit, not before.",
      },
      {
        question: "Who is liable if something goes wrong during a stay?",
        answer:
          "You remain the operator of your accommodation. Injishi handles the booking, the payment and the dispute process, and will tell you plainly where that line sits before you list.",
      },
    ],
  },
];

/**
 * The proof block.
 *
 * This carried a quote from "Claudine U., Guesthouse host, Musanze" about the
 * booking she took in her first month. She does not exist, and Injishi has no
 * hosts yet to quote — which the component's own note had already ruled out
 * when it said DESIGN.md forbids inventing proof.
 *
 * What is left is the part that is ours to state: the commission we take, and
 * what that means for a payout. When there are real hosts, their words replace
 * this body copy.
 */
export const HOST_PROOF = {
  body: "We take no commission. A guest pays the rate you set, the payment is held in escrow until they check in, and what lands in your account is the number you listed, less only what your bank or mobile money provider charges to move it.",
  stat: { value: "0%", label: "commission taken from hosts" },
};
