import type { DateRange } from "react-day-picker";
import { formatDateRange, formatDayMonth, pluralize } from "@injishi/utils";
import type { Destination } from "@/data/destinations";
import {
  DEFAULT_GUESTS,
  EMPTY_INTENT,
  exploreHref,
  fromParamDate,
  toParamDate,
  type FlexDays,
  type GuestCounts,
  type StayIntent,
} from "@/lib/search-params";

/**
 * The hero search's FORM state, and the words it renders.
 *
 * This is not the URL. `search-params.ts` owns the URL and is the only module
 * that writes one; this one holds what the three panels need while they are
 * open, which is a different shape for two reasons. The picker works in `Date`
 * objects in local time, and the destination field needs the whole
 * `Destination` record to tell an alias ("Gisenyi") from the district slug it
 * resolves to.
 *
 * `toIntent` is the single edge between the two. Everything above it is
 * objects; everything below it is strings.
 */

/** Re-exported so a panel imports one module rather than two. */
export {
  billableGuests,
  DEFAULT_GUESTS,
  FLEX_DAYS,
  GUEST_AGES,
  GUEST_LIMITS,
  type FlexDays,
  type GuestCounts,
  type GuestField,
} from "@/lib/search-params";

export interface StaySearch {
  /** Set once a suggestion is chosen; free text otherwise. */
  destination: Destination | null;
  query: string;
  checkIn: Date | null;
  checkOut: Date | null;
  flexDays: FlexDays;
  /**
   * The party, or null while nobody has said one.
   *
   * Null is not a party of nobody, it is an UNANSWERED question, and the
   * distinction is the whole point: a visitor who has just landed has not said
   * who is coming, so the WHO field must not read "2 guests" at them. It reads
   * a placeholder, in the same voice as "Anywhere in Rwanda" and "Any week",
   * and the other two fields could already say that because both of their
   * shapes have an empty value and `GuestCounts` had none.
   *
   * Nothing BELOW `toIntent` sees the null: an untouched search submits
   * `DEFAULT_GUESTS`, so the stays returned and the URL written are exactly
   * what they were. This is a change to what the field claims, not to what a
   * search does.
   */
  guests: GuestCounts | null;
}

export const EMPTY_SEARCH: StaySearch = {
  destination: null,
  query: "",
  checkIn: null,
  checkOut: null,
  flexDays: 0,
  guests: null,
};

/**
 * The WHO field's empty state, on every surface that renders that field.
 *
 * The other two hero placeholders are declarative ("Anywhere in Rwanda", "Any
 * week") because both of those fields have a real empty reading: anywhere, any
 * week. A party does not — "any guests" is not a thing a guest means — so this
 * one is the affordance instead, which is also what the reference prints. It
 * lives here rather than in the pill because the pill IMPORTS the sheet, so a
 * constant in either one would be a cycle, and because two surfaces wording
 * the same empty state differently is the drift this module exists to stop.
 */
export const GUESTS_PLACEHOLDER = "Add guests";

/** The party a search will go out with — the default until one is chosen. */
export function partyOf(search: StaySearch): GuestCounts {
  return search.guests ?? DEFAULT_GUESTS;
}

/**
 * "2 guests", or null while the field is untouched.
 *
 * Same shape `dateSummary` returns, deliberately, so both fields render their
 * placeholder the same way at every call site: `summary ?? "the placeholder"`.
 */
export function searchGuestSummary(search: StaySearch): string | null {
  return search.guests ? guestSummary(search.guests) : null;
}

/**
 * Form state to URL state.
 *
 * A district or a landmark filters by slug. Its label would match no listing's
 * free text, so it must not also go out as `q`; a stay suggestion is the other
 * way round and carries its own name.
 */
export function toIntent(search: StaySearch): StayIntent {
  const { destination, query, checkIn, checkOut, flexDays } = search;
  const guests = partyOf(search);
  const term = destination?.label ?? query.trim();
  const isPlace = destination !== null && destination.kind !== "stay";
  const iso = toParamDate(checkIn);

  return {
    query: isPlace ? "" : term,
    districts: destination?.district ? [destination.district] : [],
    checkIn: iso,
    // The URL never carries half a range, so neither does the thing that
    // builds it. `search-params` enforces the same rule on the way back in.
    checkOut: iso ? toParamDate(checkOut) : null,
    flex: flexDays,
    guests,
  };
}

/**
 * URL state back to form state, for a surface that opens on a shared link.
 *
 * The party comes back non-null on purpose: a URL always resolves one (a
 * missing `adults` means the default, which is what every kept link has always
 * meant), so a form built from a link is ANSWERED rather than unasked. The null
 * belongs to a field nobody has been to yet.
 */
export function fromIntent(intent: StayIntent = EMPTY_INTENT): StaySearch {
  return {
    destination: null,
    query: intent.query,
    checkIn: fromParamDate(intent.checkIn),
    checkOut: fromParamDate(intent.checkOut),
    flexDays: intent.flex,
    guests: intent.guests,
  };
}

/**
 * The picker speaks react-day-picker's range; this form holds two nullable
 * dates. One shim, so the two call sites that mount the picker do not each
 * write their own and disagree about what an open half-range means.
 */
export function toDateRange(search: StaySearch): DateRange | undefined {
  return search.checkIn
    ? { from: search.checkIn, to: search.checkOut ?? undefined }
    : undefined;
}

export function withDateRange(
  search: StaySearch,
  range: DateRange | undefined,
): StaySearch {
  return { ...search, checkIn: range?.from ?? null, checkOut: range?.to ?? null };
}

/** The same range straight off the URL half, with no round trip through the form. */
export function intentDateRange(intent: StayIntent): DateRange | undefined {
  const from = fromParamDate(intent.checkIn);
  if (!from) return undefined;
  return { from, to: fromParamDate(intent.checkOut) ?? undefined };
}

/** The /explore URL for a search. The one caller of `exploreHref` on this path. */
export function searchHref(search: StaySearch): string {
  return exploreHref(toIntent(search));
}

/**
 * "2 guests", "3 guests, 1 infant", "2 guests, pets".
 *
 * Infants and pets are appended rather than folded into the count because they
 * change which properties qualify, not how many beds are needed.
 */
export function guestSummary(guests: GuestCounts): string {
  const parts = [pluralize(guests.adults + guests.children, "guest")];
  if (guests.infants > 0) parts.push(pluralize(guests.infants, "infant"));
  if (guests.pets) parts.push("pets");
  return parts.join(", ");
}

/** "12 - 18 Mar", "12 Mar plus or minus 3 days", or null when nothing is picked. */
export function dateSummary(
  checkIn: Date | null,
  checkOut: Date | null,
  flexDays: FlexDays,
): string | null {
  if (!checkIn) return null;
  const flex = flexDays > 0 ? ` ± ${pluralize(flexDays, "day")}` : "";
  // Half-open range: the check-in date alone, until a check-out is picked.
  if (!checkOut) return `${formatDayMonth(checkIn)}${flex}`;
  return `${formatDateRange(checkIn, checkOut)}${flex}`;
}

/** The same summary from the wire form, for a surface that reads the URL. */
export function intentDateSummary(intent: StayIntent): string | null {
  return dateSummary(
    fromParamDate(intent.checkIn),
    fromParamDate(intent.checkOut),
    intent.flex,
  );
}

/** Midnight today, for disabling the past in the picker. */
export function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}
