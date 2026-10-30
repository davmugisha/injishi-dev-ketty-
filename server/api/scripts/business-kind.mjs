/**
 * The business kind an org row carries (ADR-075 D-h), from the domain and the
 * accommodation class a seed writes.
 *
 * Migration 0075 made `orgs.business_kind` NOT NULL and backfilled every
 * existing row with this same rule: a residence is `residence`; a stay is its
 * accommodation class, with the four retired classes mapped to the kind that
 * replaced them. A seed that inserts an org must name the kind too, or Postgres
 * refuses the row, which is how `seed-sample.mjs` came to stop at its fifth
 * step on every fresh database.
 */

const RETIRED_CLASS_KIND = {
  town_hotel: 'hotel',
  vacation_hotel_resort: 'hotel',
  serviced_apartment: 'apartment',
  cottage: 'lodge',
};

export function businessKindFor({ domain, accommodationClass }) {
  if (domain === 'residence') return 'residence';
  if (!accommodationClass) {
    throw new Error('A hospitality org needs an accommodation class to name its business kind.');
  }
  return RETIRED_CLASS_KIND[accommodationClass] ?? accommodationClass;
}
