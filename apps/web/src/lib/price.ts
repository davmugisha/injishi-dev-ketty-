/**
 * Rate formatting.
 *
 * The cards used to split a rate into its leading digits and its trailing
 * thousands — 8050 rendered as a large "8" beside a small "050 RWF". That
 * worked while every fixture sat between 8,000 and 175,000 RWF. Real Rwandan
 * inventory runs from about 66,000 RWF for a Kigali guesthouse to 4,894,000
 * for a gorilla-trekking lodge, where the same trick prints "4894" beside
 * "000 RWF". So rates are formatted whole, with separators.
 *
 * Ten of the thirty properties publish no rate at all — mostly lodges that
 * quote per itinerary — hence the null handling rather than a zero.
 */

const RWF = new Intl.NumberFormat("en-RW", { maximumFractionDigits: 0 });

/**
 * The two things a card says when a property publishes no rate.
 *
 * Ten of the thirty properties quote per itinerary rather than per night, so
 * this copy is on screen as often as a price is. It was inlined at six call
 * sites across five files and had already drifted once — `formatRate` spelled
 * the first one "Rate on request" while every card said "On request".
 */
export const NO_RATE = "On request";
export const NO_RATE_BASIS = "Booked on enquiry";

/** "196,000" — the number alone, for pairing with a separate RWF label. */
export function formatRateNumber(amountRwf: number | null): string | null {
  return amountRwf === null ? null : RWF.format(amountRwf);
}

/**
 * Shorten the basis for the tight card footprint.
 *
 * "per person, per night" has to survive the trim: a per-person lodge rate and
 * a per-room hotel rate differ by more than an order of magnitude, so dropping
 * the distinction to save space would make the two look comparable when they
 * are not.
 */
export function shortBasis(basis: string): string {
  if (/person/i.test(basis)) return "per person / night";
  if (/^each$/i.test(basis.trim())) return "each";
  if (/apartment/i.test(basis)) return "per apartment / night";
  if (/^per night$/i.test(basis.trim())) return "per night, whole place";
  return "per room / night";
}
