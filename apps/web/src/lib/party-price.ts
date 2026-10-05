import { computeBreakdown } from "@injishi/contracts";
import { nightsBetween, pluralize } from "@injishi/utils";
import { formatRateNumber } from "@/lib/price";
import { billableGuests, fromParamDate, type StayIntent } from "@/lib/search-params";

/**
 * What THIS party pays, from a stay's rate and the search on screen.
 *
 * Every Injishi booking is charged per person (owner decision, 2026-09-15,
 * restated 2026-10-02): `rate × billable guests × nights`, plus the guest
 * service fee, by `computeBreakdown` in `@injishi/contracts`, which is the
 * server's own arithmetic. So the figure here and the checkout's cannot
 * disagree.
 *
 * It replaced a card line that read "≈ X RWF total" and was one night for
 * ONE person plus VAT: it ignored the party in the search bar (two guests by
 * default) and the nights, so a couple saw half of what they would pay.
 *
 * A rate quoted per room or per apartment (sample listings only; none of
 * them is bookable) is not multiplied by guests; it gets the nights alone.
 */

export function isPerPerson(basis: string): boolean {
  return /person|guest/i.test(basis);
}

export type PartyPrice = {
  /** "2 guests · 3 nights", "2 guests", "3 nights". */
  label: string;
  /** "1,470,000 RWF". */
  amount: string;
  /** What the amount includes, said plainly. */
  note: string;
};

export function partyPrice(
  nightlyRateRwf: number | null,
  basis: string,
  intent: StayIntent,
): PartyPrice | null {
  if (nightlyRateRwf === null) return null;
  const perPerson = isPerPerson(basis);
  const guests = billableGuests(intent.guests);
  const checkIn = fromParamDate(intent.checkIn);
  const checkOut = fromParamDate(intent.checkOut);
  const nights = checkIn && checkOut ? nightsBetween(checkIn, checkOut) : 0;

  if (perPerson) {
    if (nights > 0) {
      const { grossRwf } = computeBreakdown({
        nightlyRateRwf,
        nights,
        guests,
        nonRefundable: false,
      });
      return {
        label: `${pluralize(guests, "guest")} · ${pluralize(nights, "night")}`,
        amount: `${formatRateNumber(grossRwf)} RWF`,
        note: "total incl. service fee",
      };
    }
    if (guests <= 1) return null; // "per person / night" already says it all.
    return {
      label: pluralize(guests, "guest"),
      amount: `${formatRateNumber(nightlyRateRwf * guests)} RWF`,
      note: "a night for the party",
    };
  }

  if (nights > 0) {
    return {
      label: pluralize(nights, "night"),
      amount: `${formatRateNumber(nightlyRateRwf * nights)} RWF`,
      note: "before fees",
    };
  }
  return null;
}
