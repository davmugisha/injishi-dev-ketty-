import {
  ACCOMMODATION_CLASS_LABEL,
  type AccommodationClass,
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
 * into registration (`hostKindHref`). It used to be a plain `string`
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
 * Where a tile on the chooser goes: straight into registration, with the
 * answer in the query.
 *
 * It went to `/host/start` first, a page that named the choice back and held
 * one button, "Register your business". That button was the only way on, so
 * the page cost a screen and decided nothing. The wizard now takes the kind as
 * answered and opens on the first question it does not yet know
 * (`register/register-steps.ts`), and `/host/start` redirects here for the links
 * that still name it.
 *
 * A signed out visitor is sent to sign in by the register gate, and `/sign-in`
 * hands back the whole path and query, so the kind survives the round trip
 * (`safeRedirect` keeps the search string).
 */
export function hostKindHref(kind: HostKind): string {
  return `/register?kind=${encodeURIComponent(kind)}`;
}

/**
 * Read a `kind` back off the query string.
 *
 * `/host/start` reads it back for the old links that still name that page, so
 * the string is checked against the same list that wrote it rather than
 * trusted: a hand typed `?kind=castle` has to land as
 * if no choice was made, not prefill a class the contract does not have. The
 * whole entry is returned rather than the bare value, so the label travels with
 * it and no reader looks it up twice.
 */
export function findHostKind(
  value: string | null | undefined,
): HostPropertyKind | null {
  if (!value) return null;
  return HOST_PROPERTY_KINDS.find((k) => k.value === value) ?? null;
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
    // Was "Reach guests already searching ... alongside verified stays across
    // Kigali, Musanze, Rubavu and Huye", written for a catalogue that opened
    // empty. Being early is the true offer, so it says that.
    title: "Be among the first listed",
    body: "Injishi opens district by district, Kigali first. Hosts verified now are the stays guests meet first, on a site where every listing has passed the same checks.",
  },
  {
    icon: "payout",
    title: "Keep the whole nightly rate",
    body: "Injishi takes no commission from the host. The rate you set is the rate you are paid, released from escrow once your guest has checked in.",
  },
  {
    icon: "trust",
    // Was "We handle RRA registration and keep your records straight". Injishi
    // checks a TIN; it does not register anyone with the RRA, and EBM is not
    // yet certified (AGENTS.md § EBM).
    title: "Start with the paperwork checked",
    body: "Your RRA TIN and documents are checked when you register, and Injishi is being connected to the RRA's electronic billing so each booking can be declared under your own TIN.",
  },
];

export interface HostStep {
  n: number;
  title: string;
  body: string;
  icon: "register" | "verify" | "photograph" | "live";
}

/**
 * The four things that happen after the chooser.
 *
 * Step one is the only one the host does, and it used to describe a form that
 * does not exist: "where it is, how many rooms, what a guest gets. Ten minutes,
 * no documents yet." Registration asks for none of the rooms. It asks who you
 * are and what business you run, and it opens on an identity check and a TIN,
 * which are documents whatever the copy said. So the step now names what to
 * have to hand, says which part honestly may wait (the certificates: the
 * documents step can be skipped and the officer asks at the visit), and says
 * the fee is paid at the end of it.
 *
 * Step two names the checks the pay screen names (RRA, then the officer), and
 * step four is where the monthly plan begins, the promise the pay screen makes
 * too ("your subscription only starts once you are live").
 */
export const HOST_STEPS: HostStep[] = [
  {
    n: 1,
    icon: "register",
    title: "Register your business",
    body: "Your ID, your RRA TIN (or the UPI of a home you let) and the address. About ten minutes online. Certificates can wait for the visit, and the one time registration fee is paid at the end.",
  },
  {
    n: 2,
    icon: "verify",
    title: "We verify it",
    body: "We check your TIN with RRA, then a district officer visits to confirm the place, the address and your documents.",
  },
  {
    n: 3,
    icon: "photograph",
    title: "We photograph it",
    body: "A photographer shoots the accommodation at our cost. The images are yours to keep whether or not you list.",
  },
  {
    n: 4,
    icon: "live",
    title: "You go live",
    body: "Your listing opens to guests with escrow-backed payment switched on. Your monthly plan starts here, not before.",
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
          "Yes. Nothing about Injishi is exclusive: list wherever else you like, and you keep control of your own calendar and rates.",
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
        // This answer used to be "Nothing ... no commission and no listing
        // fee", on the same site as a registration flow that bills a one time
        // fee. Two charges exist and commission is not one of them; the answer
        // names both, and `HOST_CHARGES` below says the same thing at length.
        question: "What does Injishi charge the host?",
        answer:
          "Two things, and no commission. A one time registration fee when you register your business: you see the amount on the last step, before you pay. Then a monthly plan, which starts only once your listing is live. The rate you set for a stay is the rate you are paid.",
      },
      {
        question: "When am I paid?",
        answer:
          // "Within three working days of release" was a promise nothing backs:
          // no payout runs yet, and no provider is contracted.
          "The guest's payment is held in escrow and paid out to you after they check in. We confirm how and when payouts reach you, by mobile money or bank, before your listing goes live.",
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
          "We check your TIN with the RRA when you register, and every booking comes with a receipt. Certified e-invoicing through the RRA's EBM is being connected; until it is live, keep declaring your sales the way you do today.",
      },
      {
        question: "What documents do you need from me?",
        // It said "after the verification visit, not before", while the form
        // checks an ID and a TIN on its first two steps. What may truly wait
        // is the certificates, and that is what it now says.
        answer:
          "To register: your National ID or passport, and your 9 digit RRA TIN, or the UPI of the property if you let a home on a lease. Certificates and licences are optional when you register. Attach them as you go, or show them to the officer at the verification visit.",
      },
      {
        question: "Who is liable if something goes wrong during a stay?",
        answer:
          "You remain the operator of your accommodation. Injishi handles the booking, the payment and the dispute process, and will tell you plainly where that line sits before you list.",
      },
    ],
  },
];

export interface HostCharge {
  icon: "fee" | "plan" | "commission";
  title: string;
  body: string;
}

/**
 * What Injishi charges a host, said once and plainly.
 *
 * This block was the proof block, and before that a quote from a host who did
 * not exist. What it kept was the one claim that is ours to make, the 0%
 * commission, under the heading "What Injishi takes from hosts". Read alone,
 * that heading and that figure say a host pays nothing, on a site whose
 * registration bills a fee. The business model is three facts and all three
 * belong here: a one time fee to register, a monthly plan once live, and no
 * commission on a booking.
 *
 * NO FIGURES, ON PURPOSE. The registration fee is a row in the API's
 * effective dated `registration_fees` table, keyed by business type, and the
 * owner ruled on 2026-09-21 that no screen before the pay step names it (the
 * pay step does, since 2026-09-27). The plans are `subscription_plans` rows
 * with no public read at all. So this says when each charge falls and where
 * the amount is shown, and quotes neither. `data/registration-fees.ts` holds
 * invented amounts for a demo with no API and must never be quoted.
 */
export const HOST_CHARGES: {
  lede: string;
  items: HostCharge[];
  stat: { value: string; label: string };
} = {
  lede: "Two charges, each at a moment you can see coming, and nothing taken from a booking.",
  items: [
    {
      icon: "fee",
      title: "A one time registration fee",
      body: "Paid once, on the last step of registering your business. The amount is on that screen, before you pay, and correcting and resubmitting is never charged again.",
    },
    {
      icon: "plan",
      title: "A monthly plan",
      body: "Starts only once your listing is live. No month is billed while your registration is in review.",
    },
    {
      icon: "commission",
      title: "No commission",
      body: "A guest pays the rate you set, the payment is held in escrow until they check in, and what lands in your account is the number you listed, less only what your bank or mobile money provider charges to move it.",
    },
  ],
  stat: { value: "0%", label: "commission on your bookings" },
};
