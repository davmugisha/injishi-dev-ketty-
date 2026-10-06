/**
 * The small formatting decisions the Property detail page and its two sheets
 * both make. Pure functions taking `t`, so a test can assert a sentence in
 * either catalogue without rendering anything.
 */
import type { BookingMode, CancellationTier } from '@injishi/contracts';
import type { MessageKey, Translate } from '@/i18n/i18n';
import type { RoomCard } from '@/data/property-detail';
import { formatMoney } from '@/components';

/**
 * `RWF 145,000`, as a STRING.
 *
 * `MoneyAmount` renders the canonical form (design brief §8.6: currency prefix,
 * comma groups, no decimals for RWF) but it renders it as three `Text` nodes,
 * and a spoken label needs one string. A `Pressable` with an
 * `accessibilityLabel` collapses its children, so a room card that did not put
 * the price into its own label would be a card whose price a screen reader
 * never reads.
 *
 * **Session 11 lifted the rule into `money-amount.tsx`.** Six files had written
 * this same three-line formatter — this one, `broker-format.ts`, three host
 * screens and the component itself — so `formatMoney` is now the one
 * implementation and this is the alias the call sites here already read.
 */
export const moneyText = formatMoney;

/** The booking-mode label. F-B03 owns the two values. */
export function modeKey(mode: BookingMode | null): MessageKey {
  return mode === 'instant_book' ? 'listing.mode.instant_book' : 'listing.mode.request_to_book';
}

/** The tier's name, and `none` for a room that has not been chosen yet. */
export function tierKey(tier: CancellationTier | null): MessageKey {
  return tier ? (`listing.tier.${tier}` as MessageKey) : 'listing.tier.none';
}

/** The tier in a sentence. F-B11 owns the five tiers; the copy follows it. */
export function tierBodyKey(tier: CancellationTier | null): MessageKey {
  return tier ? (`listing.tierBody.${tier}` as MessageKey) : 'listing.tierBody.none';
}

/**
 * What the room card says about availability.
 *
 * Four bands rather than one number, because "3 rooms left" and "last one" ask
 * for different decisions and a bare count makes the reader do the comparison.
 * Zero is a state, not an absence — see `RoomExtras.remaining`.
 */
export function remainingLabel(remaining: number, t: Translate): string {
  if (remaining <= 0) return t('listing.remainingNone');
  if (remaining === 1) return t('listing.remainingLast');
  if (remaining <= 3) return t('listing.remainingFew', { count: remaining });
  return t('listing.remainingMany', { count: remaining });
}

/** `1 night` or `3 nights`, in the reader's catalogue. */
export function nightsLabel(nights: number, t: Translate): string {
  return nights === 1 ? t('calendar.oneNight') : t('calendar.nights', { count: nights });
}

/** `1 guest` or `2 guests`: billable guests, the count a stay is priced by. */
export function guestsLabel(guests: number, t: Translate): string {
  return guests === 1 ? t('search.oneGuest') : t('search.guestCount', { count: guests });
}

/**
 * `RWF 145,000 × 2 guests × 3 nights`, the line under an accommodation total.
 *
 * The rate is per guest per night (owner decision 2026-09-15) and
 * `computeBreakdown` multiplies by both, so the line names both. A line that
 * left the guests out printed half the figure beside it for the default party
 * of two (mobile audit 2026-10-05, GB-08, GK-14). One function, so the policy
 * sheet and the two booking steps cannot word it three ways.
 */
export function rateLine(rate: number, guests: number, nights: number, t: Translate): string {
  return t('listing.rateLine', {
    rate: moneyText(rate),
    guests: guestsLabel(guests, t),
    nights: nightsLabel(nights, t),
  });
}

/** One sentence a screen reader hears for a whole room card. */
export function roomSpokenLabel(room: RoomCard, t: Translate): string {
  const rate = room.summary.nightlyRateRwf;
  return t('listing.a11yRoom', {
    name: room.summary.name,
    sleeps: t('listing.sleeps', { count: room.summary.capacity ?? 0 }),
    beds: t(room.beds),
    rate: rate === null ? '' : moneyText(rate),
    availability: remainingLabel(room.remaining, t),
  });
}

/**
 * Why the booking CTA is disabled, or `null` when it is not.
 *
 * The design brief's rule is that consequences are printed under the button
 * rather than discovered later, so a disabled CTA always has a sentence beside
 * it. The order is the order the guest can act on: a property that takes no
 * bookings at all first, then one with nothing left, then the two choices.
 */
export function blockedReasonKey(args: {
  active: boolean;
  soldOut: boolean;
  hasDates: boolean;
  hasRoom: boolean;
}): MessageKey | null {
  if (!args.active) return 'listing.blockedInactive';
  if (args.soldOut) return 'listing.blockedSoldOut';
  if (!args.hasDates && !args.hasRoom) return 'listing.blockedBoth';
  if (!args.hasDates) return 'listing.blockedDates';
  if (!args.hasRoom) return 'listing.blockedRoom';
  return null;
}
