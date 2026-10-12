import { AccommodationClass } from "@injishi/contracts";
import { toISODate, withQuery } from "@injishi/utils";
import { BUDGET_BANDS, type BudgetBandId } from "@/data/search-options";

/**
 * The one search-state contract.
 *
 * Five surfaces used to write and read the guest's search: the hero pill, the
 * header overlay, the explore filter rail, the property booking widget and the
 * checkout review. They agreed on three parameter names out of fourteen. A
 * guest who said "Kigali, 12 to 15 March, two adults and a child" on the home
 * page was asked for the dates a second time on the property page, and the
 * party was flattened to one number by the time they reached checkout.
 *
 * This module is the only place a public URL is written or read. Nothing
 * outside it may build a query string by hand.
 *
 * TWO halves, kept apart on purpose:
 *
 *  - INTENT is what the guest said. It survives every hop of the funnel,
 *    `/` to `/explore` to `/property/[slug]` to `/book`. Losing it is the bug
 *    this module exists to close.
 *  - REFINEMENT is how they narrowed a list. It is meaningful on `/explore`
 *    alone and is deliberately dropped at the property boundary, because
 *    "sorted by price, page 3" says nothing about the stay now in hand.
 *
 * The parameter vocabulary, in full. There is no other:
 *
 * | param           | half       | shape                       |
 * |-----------------|------------|-----------------------------|
 * | `q`             | intent     | free text                   |
 * | `district`      | intent     | comma separated slugs       |
 * | `checkIn`       | intent     | `YYYY-MM-DD`                |
 * | `checkOut`      | intent     | `YYYY-MM-DD`, after checkIn |
 * | `flex`          | intent     | one of `FLEX_DAYS`          |
 * | `adults`        | intent     | integer, omitted at default |
 * | `children`      | intent     | integer, omitted at zero    |
 * | `infants`       | intent     | integer, omitted at zero    |
 * | `pets`          | intent     | `1`, omitted when false     |
 * | `basis`         | refinement | `nightly` or `total`        |
 * | `min`           | refinement | integer RWF                 |
 * | `max`           | refinement | integer RWF                 |
 * | `kind`          | refinement | comma separated classes     |
 * | `class`         | refinement | comma separated star ints   |
 * | `rating`        | refinement | integer score floor         |
 * | `amenity`       | refinement | comma separated facet ids   |
 * | `room`          | refinement | comma separated facet ids   |
 * | `exp`           | refinement | comma separated facet ids   |
 * | `view`          | refinement | comma separated facet ids   |
 * | `act`           | refinement | comma separated facet ids   |
 * | `pay`           | refinement | comma separated facet ids   |
 * | `cancel`        | refinement | comma separated facet ids   |
 * | `meal`          | refinement | comma separated facet ids   |
 * | `access`        | refinement | comma separated facet ids   |
 * | `popular`       | refinement | comma separated facet ids   |
 * | `bedrooms`      | refinement | integer                     |
 * | `name`          | refinement | free text, property name    |
 * | `stay`          | refinement | `all`, `hotels` or `homes`  |
 * | `available`     | refinement | `1`, omitted when false     |
 * | `compare`       | refinement | `1`, omitted when false     |
 * | `cmp`           | refinement | comma separated slugs, ≤ 5  |
 * | `sort`          | refinement | an `ExploreSort`            |
 * | `page`          | refinement | integer, omitted at 1       |
 * | `property`      | checkout   | a property slug             |
 * | `nonRefundable` | checkout   | `1`, omitted when false     |
 *
 * Booleans are always `name=1` and are absent when false. A value equal to its
 * default is never written, so a bare `/explore` stays a bare `/explore`.
 *
 * EVERY LIST PARAMETER IS COMMA SEPARATED AND ORDER INSENSITIVE ON READ, and
 * is written in the vocabulary's own declaration order rather than in click
 * order. Two guests who tick the same three amenities in different orders must
 * land on the same URL, or an otherwise-identical view has two addresses and
 * neither the cache nor a shared link can tell they are one thing.
 *
 * `cmp` is the one exception. It is not a filter but the guest's comparison,
 * and its order is the order of the columns they built, so it is written in
 * pick order. Same picks in a different order is a genuinely different view.
 *
 * RETIRED, and why. `guests` was a second spelling of the party that the
 * `adults` and `children` pair already carries, and two spellings of one fact
 * is how they drift. It is still READ, so a link somebody kept still opens on
 * the right occupancy; it is never written. `beds` filtered nothing: it read
 * `listing.bedrooms`, the same field `bedrooms` reads, and the fixtures carry
 * no bed count at all. `budget` was three fixed bands and the rebuilt rail
 * offers a continuous range instead; it is still READ and mapped onto `min`
 * and `max`, so a kept link still opens on the band it named, and it is never
 * written.
 */

/** Anything with a `get`. Covers `URLSearchParams` and Next's readonly one alike. */
export interface ParamsLike {
  get(name: string): string | null;
}

type QueryValues = Record<string, string | number | boolean | null | undefined>;

/* ------------------------------------------------------------------ party */

/** The plus-or-minus window the hero offers on either side of the dates. */
export const FLEX_DAYS = [0, 1, 2, 3, 7] as const;
export type FlexDays = (typeof FLEX_DAYS)[number];

export interface GuestCounts {
  adults: number;
  children: number;
  infants: number;
  pets: boolean;
}

export const DEFAULT_GUESTS: GuestCounts = {
  adults: 2,
  children: 0,
  infants: 0,
  pets: false,
};

export const GUEST_LIMITS = {
  adults: { min: 1, max: 16 },
  children: { min: 0, max: 10 },
  infants: { min: 0, max: 5 },
} as const;

export type GuestField = keyof typeof GUEST_LIMITS;

/**
 * What each guest word means, in one place.
 *
 * The search stepper said an adult was 18 and over and a child 2 to 17; the
 * booking card said an adult was 13 and over and a child 2 to 12. So a party
 * of two adults and a fifteen-year-old filtered the catalogue as three people
 * in two rooms and then priced as three adults, and neither screen was wrong
 * about anything except the other one. The two steppers stay separate (one is
 * bounded by a property's capacity and the other is not); the vocabulary does
 * not.
 */
export const GUEST_AGES: Readonly<Record<GuestField, string>> = {
  adults: "Ages 18 and older",
  children: "Ages 2 to 17",
  infants: "Under 2",
};

/** Infants do not count against occupancy, matching the reference. */
export function billableGuests(guests: GuestCounts): number {
  return guests.adults + guests.children;
}

/* ----------------------------------------------------------------- intent */

export interface StayIntent {
  query: string;
  districts: string[];
  /** `YYYY-MM-DD`, or null. */
  checkIn: string | null;
  /** `YYYY-MM-DD` strictly after `checkIn`, or null. Never one without the other. */
  checkOut: string | null;
  flex: FlexDays;
  guests: GuestCounts;
}

/**
 * An intent that carries a closed date range.
 *
 * `bookHref` and `parseBooking` speak this rather than `StayIntent`, so the
 * type system refuses a checkout URL that cannot be priced. The old widget
 * built its link from a template string and had to test the two dates by hand
 * at the call site; a missed test there is a `/book` page that renders "we
 * could not read that booking" to a guest who did everything right.
 */
export interface DatedIntent extends StayIntent {
  checkIn: string;
  checkOut: string;
}

export const EMPTY_INTENT: StayIntent = {
  query: "",
  districts: [],
  checkIn: null,
  checkOut: null,
  flex: 0,
  guests: DEFAULT_GUESTS,
};

export function isDated(intent: StayIntent): intent is DatedIntent {
  return intent.checkIn !== null && intent.checkOut !== null;
}

export function parseIntent(params: ParamsLike): StayIntent {
  const checkIn = readISODate(params.get("checkIn"));
  const checkOut = readISODate(params.get("checkOut"));

  return {
    query: params.get("q")?.trim() ?? "",
    districts: readList(params.get("district")),
    checkIn,
    // A checkout with no check-in, or one that does not follow it, is not a
    // range. Dropping the half that cannot stand alone means no consumer has
    // to re-check the pair, and `isDated` can be trusted everywhere.
    checkOut:
      checkIn !== null && checkOut !== null && checkOut > checkIn ? checkOut : null,
    flex: readFlex(params.get("flex")),
    guests: readGuests(params),
  };
}

export function serialiseIntent(intent: StayIntent): QueryValues {
  const { guests } = intent;
  return {
    q: intent.query.trim() || undefined,
    district: intent.districts.join(",") || undefined,
    checkIn: intent.checkIn ?? undefined,
    checkOut: intent.checkOut ?? undefined,
    flex: intent.flex > 0 ? intent.flex : undefined,
    adults: guests.adults === DEFAULT_GUESTS.adults ? undefined : guests.adults,
    children: guests.children > 0 ? guests.children : undefined,
    infants: guests.infants > 0 ? guests.infants : undefined,
    pets: guests.pets ? 1 : undefined,
  };
}

/** True once the guest has said anything at all. Drives the "clear" affordance. */
export function hasIntent(intent: StayIntent): boolean {
  return (
    intent.query.trim() !== "" ||
    intent.districts.length > 0 ||
    intent.checkIn !== null ||
    billableGuests(intent.guests) !== billableGuests(DEFAULT_GUESTS)
  );
}

/* ------------------------------------------------------------- refinement */

/**
 * The order the results are listed in.
 *
 * `recommended` is the default and is deliberately NOT a hidden ranking. The
 * reference prints "How our sort order works" beside its own default because a
 * marketplace that ranks by anything other than the guest's stated preference
 * owes them an explanation. Ours is stated in `SORT_EXPLAINER` and is honest:
 * it is score first, then price, and paid placement does not move a stay up
 * it. The moment that stops being true, that string has to change with it.
 */
export type ExploreSort =
  | "recommended"
  | "price_asc"
  | "price_desc"
  | "rating_desc"
  | "bedrooms_asc"
  | "bedrooms_desc";

export const SORT_OPTIONS: { value: ExploreSort; label: string }[] = [
  { value: "recommended", label: "Recommended for you" },
  { value: "price_asc", label: "Price: low to high" },
  { value: "price_desc", label: "Price: high to low" },
  { value: "rating_desc", label: "Guest rating: high to low" },
  { value: "bedrooms_asc", label: "Bedrooms: few to many" },
  { value: "bedrooms_desc", label: "Bedrooms: many to few" },
];

export const SORT_EXPLAINER =
  "Recommended orders stays by guest score first, then by nightly rate.";

/**
 * The three stay-type tabs above the list.
 *
 * A VIEW over the accommodation classes, not a second vocabulary: `hotels` is
 * the classes a hotelier registers under and `homes` is the ones a private
 * host does. The mapping is in `lib/filter-listings.ts` beside the filter that
 * applies it, so there is one place to correct if the class list changes.
 */
export type StayType = "all" | "hotels" | "homes";

export const STAY_TYPES: { value: StayType; label: string }[] = [
  { value: "all", label: "All stays" },
  { value: "hotels", label: "Hotels" },
  { value: "homes", label: "Homes" },
];

/**
 * How the guest narrowed the list.
 *
 * Every list field is a MULTI select, which is the substantive change from the
 * three single-choice pills this replaced. A guest looking for a pool and a
 * restaurant wants both, and a rail that answers "pick one" is not a filter
 * rail. Single-choice survives only where the question really is exclusive: a
 * minimum score, a minimum bedroom count, a sort order, a page.
 */
export interface ExploreRefinement {
  /** Inclusive RWF bounds, on the nightly rate. Null is open on that side. */
  minRwf: number | null;
  maxRwf: number | null;
  kinds: AccommodationClass[];
  /** Star classes: 5, 4, 3, 2. */
  classes: number[];
  /** A minimum guest score out of 10, or null. */
  rating: number | null;
  amenities: string[];
  roomAmenities: string[];
  experience: string[];
  views: string[];
  activities: string[];
  meals: string[];
  popular: string[];
  bedrooms: number | null;
  /** Free text matched against the property name only, not the address. */
  name: string;
  stayType: StayType;
  /** The rail's compare tray. A view preference, not a filter. */
  compare: boolean;
  /** The stays picked for comparison, in pick order. At most `MAX_PICKS`. */
  picks: string[];
  sort: ExploreSort;
  page: number;
}

/** How many stays the compare view holds side by side. */
export const MAX_PICKS = 5;
const SLUG_PATTERN = /^[a-z0-9][a-z0-9-]{0,120}$/;

export const DEFAULT_REFINEMENT: ExploreRefinement = {
  minRwf: null,
  maxRwf: null,
  kinds: [],
  classes: [],
  rating: null,
  amenities: [],
  roomAmenities: [],
  experience: [],
  views: [],
  activities: [],
  meals: [],
  popular: [],
  bedrooms: null,
  name: "",
  stayType: "all",
  compare: false,
  picks: [],
  sort: "recommended",
  page: 1,
};

/**
 * The list fields, paired with the parameter each is written to.
 *
 * A table rather than twenty hand-written read/write pairs. Twenty pairs is
 * twenty chances to read `view` and write `views`, and that class of typo
 * produces a filter that applies on this render and vanishes on reload —
 * which is the single hardest kind of bug to see, because everything looks
 * right until you press F5.
 */
const LIST_FIELDS = [
  ["kinds", "kind"],
  ["amenities", "amenity"],
  ["roomAmenities", "room"],
  ["experience", "exp"],
  ["views", "view"],
  ["activities", "act"],
  ["meals", "meal"],
  ["popular", "popular"],
] as const satisfies ReadonlyArray<readonly [keyof ExploreRefinement, string]>;

export function parseRefinement(params: ParamsLike): ExploreRefinement {
  const refinement: ExploreRefinement = { ...DEFAULT_REFINEMENT };

  for (const [field, param] of LIST_FIELDS) {
    // Sorted and de-duplicated on the way in, so `amenity=Bar,Pool` and
    // `amenity=Pool,Bar,Bar` are one state rather than three.
    const values = [...new Set(readList(params.get(param)))].sort();
    (refinement[field] as string[]) = values;
  }

  refinement.classes = [...new Set(readList(params.get("class")).map(Number))]
    .filter((n) => Number.isInteger(n) && n >= 1 && n <= 5)
    .sort((a, b) => b - a);

  refinement.minRwf = readMoney(params.get("min"));
  refinement.maxRwf = readMoney(params.get("max"));

  // `budget` is the retired three-band control. Read, never written, and it
  // loses to an explicit range: a link carrying both was edited by hand and
  // the more specific of the two is the safer reading.
  const legacyBand = BUDGET_BANDS.find((band) => band.id === params.get("budget"));
  if (legacyBand) {
    if (refinement.minRwf === null) refinement.minRwf = legacyBand.min || null;
    if (refinement.maxRwf === null) refinement.maxRwf = legacyBand.max;
  }

  // A reversed pair is a link somebody edited; swapping it is friendlier than
  // returning nothing, and returning nothing looks exactly like a broken page.
  if (
    refinement.minRwf !== null &&
    refinement.maxRwf !== null &&
    refinement.minRwf > refinement.maxRwf
  ) {
    [refinement.minRwf, refinement.maxRwf] = [refinement.maxRwf, refinement.minRwf];
  }

  const rating = readCount(params.get("rating"));
  refinement.rating = rating !== null && rating >= 1 && rating <= 10 ? rating : null;

  refinement.bedrooms = readCount(params.get("bedrooms"));
  refinement.name = params.get("name")?.trim() ?? "";

  const stay = params.get("stay");
  refinement.stayType = STAY_TYPES.some((type) => type.value === stay)
    ? (stay as StayType)
    : "all";

  refinement.compare = params.get("compare") === "1";
  refinement.picks = [
    ...new Set(
      (params.get("cmp") ?? "")
        .split(",")
        .map((slug) => slug.trim())
        .filter((slug) => SLUG_PATTERN.test(slug)),
    ),
  ].slice(0, MAX_PICKS);

  const sort = params.get("sort");
  refinement.sort = SORT_OPTIONS.some((option) => option.value === sort)
    ? (sort as ExploreSort)
    : DEFAULT_REFINEMENT.sort;

  refinement.page = readCount(params.get("page")) ?? 1;

  return refinement;
}

export function serialiseRefinement(refinement: ExploreRefinement): QueryValues {
  const out: QueryValues = {
    min: refinement.minRwf ?? undefined,
    max: refinement.maxRwf ?? undefined,
    class: refinement.classes.length ? [...refinement.classes].sort((a, b) => b - a).join(",") : undefined,
    rating: refinement.rating ?? undefined,
    bedrooms: refinement.bedrooms ?? undefined,
    name: refinement.name.trim() || undefined,
    stay: refinement.stayType === "all" ? undefined : refinement.stayType,
    compare: refinement.compare ? 1 : undefined,
    // Pick order, not sorted: see the `cmp` note in the header.
    cmp: refinement.picks.length ? refinement.picks.slice(0, MAX_PICKS).join(",") : undefined,
    sort: refinement.sort === DEFAULT_REFINEMENT.sort ? undefined : refinement.sort,
    page: refinement.page > 1 ? refinement.page : undefined,
  };

  for (const [field, param] of LIST_FIELDS) {
    const values = refinement[field] as string[];
    // Sorted on the way out too. Click order is not state.
    out[param] = values.length ? [...new Set(values)].sort().join(",") : undefined;
  }

  return out;
}

/** True once the guest has narrowed anything. Drives the "clear all" affordance. */
export function hasRefinement(refinement: ExploreRefinement): boolean {
  if (refinement.minRwf !== null || refinement.maxRwf !== null) return true;
  if (refinement.classes.length > 0) return true;
  if (refinement.rating !== null) return true;
  if (refinement.bedrooms !== null) return true;
  if (refinement.name.trim() !== "") return true;
  if (refinement.stayType !== "all") return true;
  return LIST_FIELDS.some(([field]) => (refinement[field] as string[]).length > 0);
}

/** How many facets are ticked, for the mobile sheet's badge. */
export function refinementCount(refinement: ExploreRefinement): number {
  let count = LIST_FIELDS.reduce(
    (total, [field]) => total + (refinement[field] as string[]).length,
    0,
  );
  count += refinement.classes.length;
  if (refinement.minRwf !== null || refinement.maxRwf !== null) count += 1;
  if (refinement.rating !== null) count += 1;
  if (refinement.bedrooms !== null) count += 1;
  if (refinement.name.trim() !== "") count += 1;
  return count;
}

/** Add or remove one value from a list field, returning the whole field. */
export function toggleFacet(current: string[], value: string): string[] {
  return current.includes(value)
    ? current.filter((entry) => entry !== value)
    : [...current, value].sort();
}

function readMoney(raw: string | null): number | null {
  if (raw === null) return null;
  const parsed = Number.parseInt(raw.replace(/[^\d]/g, ""), 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

/* ------------------------------------------------------------------ hrefs */

export function exploreHref(
  intent: StayIntent,
  refinement: ExploreRefinement = DEFAULT_REFINEMENT,
): string {
  return withQuery("/explore", {
    ...serialiseIntent(intent),
    ...serialiseRefinement(refinement),
  });
}

/**
 * The property page for a stay, carrying the intent and nothing else.
 *
 * Refinement stays behind on purpose. The sort order and the page number are
 * facts about a list, and the guest has left the list.
 */
export function propertyHref(slug: string, intent: StayIntent): string {
  return withQuery(`/property/${slug}`, serialiseIntent(intent));
}

/**
 * The checkout url.
 *
 * ## Why this carries ONE id now, not a pair
 *
 * It used to carry `propertyId` AND `roomType`, both or neither, because the
 * checkout looked the property up separately and needed a key for each. That
 * made the link able to name a room and a property that disagree: a
 * hand-edited url priced one property's room against another's page, and the
 * only thing stopping it was a client-side check that both ids belonged
 * together.
 *
 * `GET /api/v1/bookable/:roomTypeId` joins the property to the room type on the
 * server, so there is no pair left to disagree. The room type id is the whole
 * key.
 *
 * The slug still travels, and is now presentation only: it names the page the
 * guest came from so the back link works before the room has loaded. It is
 * never used to look anything up.
 */
export function bookHref(
  slug: string,
  intent: DatedIntent,
  options: {
    nonRefundable: boolean;
    /** The room being sold. Absent means this stay has no bookable room. */
    roomTypeId?: string | null;
  },
): string {
  return withQuery("/book", {
    property: slug,
    ...serialiseIntent(intent),
    nonRefundable: options.nonRefundable ? 1 : undefined,
    roomType: options.roomTypeId ?? undefined,
  });
}

/* --------------------------------------------------------------- checkout */

export interface BookingSelection {
  propertySlug: string;
  intent: DatedIntent;
  nights: number;
  nonRefundable: boolean;
  /**
   * The room being sold, when this stay has one.
   *
   * Null means the link names no room, which the checkout says plainly instead
   * of offering a button that cannot work. Everything else about the room and
   * its property — the rate, the capacity, the name, the slug — is read from
   * the API against this id and is never taken from the url.
   */
  roomTypeId: string | null;
}

/** Read what the booking widget put in the URL, or null when it is not a booking. */
export function parseBooking(params: ParamsLike): BookingSelection | null {
  const propertySlug = params.get("property");
  if (!propertySlug) return null;

  const intent = parseIntent(params);
  if (!isDated(intent)) return null;

  return {
    propertySlug,
    intent,
    nights: nightsBetweenISO(intent.checkIn, intent.checkOut),
    nonRefundable: params.get("nonRefundable") === "1",
    roomTypeId: params.get("roomType"),
  };
}

/**
 * A quote is stale once its check-in has passed.
 *
 * `ui-rules.md` locks price and refund tier at booking time, so the answer is
 * never "quietly reprice it". The guest is sent back to pick dates and gets a
 * fresh quote at whatever the rate is then.
 */
export function isExpired(
  intent: DatedIntent,
  todayISO: string = todayInKigali(),
): boolean {
  return intent.checkIn < todayISO;
}

/**
 * Today, in the property timezone.
 *
 * Hospitality dates are property-local (`ui-rules.md` § Money and Dates), and
 * every property in the catalogue is in Rwanda, so one zone covers all of
 * them. Reading the browser's own midnight would expire a booking several
 * hours early for a guest sitting east of Kigali.
 */
export function todayInKigali(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Kigali",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export function nightsBetweenISO(checkIn: string, checkOut: string): number {
  const from = Date.parse(`${checkIn}T00:00:00Z`);
  const to = Date.parse(`${checkOut}T00:00:00Z`);
  return Math.round((to - from) / 86_400_000);
}

/** `Date` to the wire form, and back. The picker works in local time; the URL does not. */
export function toParamDate(date: Date | null | undefined): string | null {
  return date ? toISODate(date) : null;
}

export function fromParamDate(iso: string | null): Date | null {
  if (!iso) return null;
  const [year, month, day] = iso.split("-").map(Number);
  // Constructed in LOCAL time, not parsed as UTC: react-day-picker compares
  // against a locally-built midnight, and a UTC one lands on the previous day
  // for every viewer west of Greenwich.
  return new Date(year, month - 1, day);
}

/* ---------------------------------------------------------------- readers */

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

function readISODate(raw: string | null): string | null {
  if (!raw || !ISO_DATE.test(raw)) return null;
  return Number.isNaN(Date.parse(`${raw}T00:00:00Z`)) ? null : raw;
}

function readList(raw: string | null): string[] {
  return (
    raw
      ?.split(",")
      .map((part) => part.trim())
      .filter(Boolean) ?? []
  );
}

function readCount(raw: string | null): number | null {
  if (raw === null) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function readFlex(raw: string | null): FlexDays {
  const parsed = Number.parseInt(raw ?? "", 10);
  return (FLEX_DAYS as readonly number[]).includes(parsed) ? (parsed as FlexDays) : 0;
}

function readGuests(params: ParamsLike): GuestCounts {
  // `guests` was the old single-number party. Never written now; still read so
  // a link somebody kept opens on the right occupancy rather than on two.
  const legacy = readCount(params.get("guests"));

  return {
    adults: clamp(
      readCount(params.get("adults")) ?? legacy ?? DEFAULT_GUESTS.adults,
      "adults",
    ),
    children: clamp(readCount(params.get("children")) ?? 0, "children"),
    infants: clamp(readCount(params.get("infants")) ?? 0, "infants"),
    pets: params.get("pets") === "1",
  };
}

function clamp(value: number, field: GuestField): number {
  const { min, max } = GUEST_LIMITS[field];
  return Math.min(Math.max(value, min), max);
}
