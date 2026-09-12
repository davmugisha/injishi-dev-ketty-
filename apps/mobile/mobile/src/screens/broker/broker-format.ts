/**
 * Every sentence the Broker surface builds out of a fixture value, as pure
 * functions from data to a message key.
 *
 * They are here rather than inline in the screens because the same fact is
 * printed in three places and has to read the same way each time: a vacancy is
 * a chip on B21's photo, a fact row on B22 and a reason a reveal is refused; a
 * fee is a line under a card, a row in the unit's terms and a footer on a
 * placement. A screen that formats its own is a screen that will drift from the
 * other two.
 *
 * Keys rather than strings, and `Translate` passed in rather than reached for,
 * so all of this is testable without rendering and the Kinyarwanda column is
 * exercised by the same call.
 */
import { formatMoney } from '@/components';
import type { MessageKey, Translate } from '@/i18n/i18n';
import { formatDay } from '@/data/search';
import {
  INTENT_WINDOW_DAYS,
  daysUntil,
  feeAmount,
  intentExpiresAt,
  placementState,
  type DirectoryUnit,
  type Placement,
  type PlacementEvent,
  type PlacementState,
  type Vacancy,
} from '@/data/broker';
import type { Tone } from '@/components/badge';

/* ------------------------------------------------------------- the vacancy */

/** The chip that sits on a unit's photograph, and its tone. */
export function vacancyChip(v: Vacancy, t: Translate): { label: string; tone: Tone } {
  switch (v.state) {
    case 'now':
      return { label: t('directory.vacantNow'), tone: 'success' };
    case 'from':
      return { label: t('directory.vacantFrom', { day: formatDay(v.day, t) }), tone: 'warning' };
    case 'leased':
      return { label: t('directory.leased'), tone: 'neutral' };
  }
}

/** The same fact as a row in the unit's terms, where there is room for a date. */
export function availableLine(v: Vacancy, t: Translate): string {
  switch (v.state) {
    case 'now':
      return t('unit.availableNow');
    case 'from':
      return t('unit.availableFrom', { day: formatDay(v.day, t) });
    case 'leased':
      return t('unit.availableNever');
  }
}

/* --------------------------------------------------------------- the money */

/**
 * An amount as a SENTENCE — `RWF 320,000`.
 *
 * `MoneyAmount` is the component and stays the only thing that DRAWS money;
 * this exists for the two places a string is the only option: an
 * `accessibilityLabel`, which cannot hold a node, and a message with the figure
 * interpolated into it ("Fee: RWF 100,000 flat"). It matches the component's
 * output exactly — RWF, thousands grouped, no decimals — so the spoken and the
 * drawn figure can never read differently.
 *
 * **Session 11 lifted the rule into `money-amount.tsx`** once six files were
 * found carrying the same three lines. This is the alias this surface reads.
 */
export const moneyText = formatMoney;

/* ----------------------------------------------------------------- the fee */

/**
 * "Fee: 50% of first month" or "Fee: RWF 100,000 flat".
 *
 * The flat case takes the amount already rendered, because money goes through
 * `MoneyAmount` and this returns a sentence — so the caller hands in the
 * formatted figure rather than this file growing a second money formatter.
 */
export function feeLine(u: DirectoryUnit, t: Translate, amount: string): string {
  return u.fee.kind === 'percent'
    ? t('directory.feePercent', { percent: u.fee.percentOfFirstMonth })
    : t('directory.feeFlat', { amount });
}

/** What the fee actually comes to on this unit's rent. */
export function unitFee(u: DirectoryUnit): number {
  return feeAmount(u.fee, u.rent);
}

/* ------------------------------------------------------------ the placement */

const STATE_LABEL: Record<PlacementState, MessageKey> = {
  active: 'placements.stateActive',
  signing: 'placements.stateSigning',
  signed: 'placements.stateSigned',
  expired: 'placements.stateExpired',
};

/**
 * The tone a placement state reads as.
 *
 * Not `StatusBadge`: its table is the platform's status semantics (booking,
 * lease, rent, caution, filing, identity, task, housekeeping, ticket) and a
 * placement is none of those. Adding a tenth domain to a frozen shared
 * component from one session's screen is how that table stops being a
 * contract; Session 11 lifts it if a second surface needs it.
 */
const STATE_TONE: Record<PlacementState, Tone> = {
  active: 'brand',
  signing: 'warning',
  signed: 'success',
  expired: 'neutral',
};

export function placementBadge(
  p: Placement,
  t: Translate,
): { label: string; tone: Tone; state: PlacementState } {
  const state = placementState(p);
  return { label: t(STATE_LABEL[state]), tone: STATE_TONE[state], state };
}

const EVENT_KEY: Record<PlacementEvent, MessageKey> = {
  contact_revealed: 'placements.eventRevealed',
  viewing_booked: 'placements.eventViewing',
  lease_drafted: 'placements.eventDrafted',
  awaiting_landlord: 'placements.eventAwaiting',
  lease_signed: 'placements.eventSigned',
  no_response: 'placements.eventNoResponse',
};

/** "Revealed 2 Jul · viewing booked". The signed line prints its own date. */
export function eventLine(p: Placement, t: Translate): string {
  const day = p.event === 'lease_signed' ? (p.signedAt ?? p.revealedAt) : p.revealedAt;
  return t(EVENT_KEY[p.event], { day: formatDay(day, t) });
}

/** Who was placed, or the fact that nobody has been named yet (FL19 step 1). */
export function placementTitle(p: Placement, t: Translate): string {
  return t('placements.toUnit', {
    client: p.client ?? t('placements.noClient'),
    unit: p.unitLabel,
  });
}

/**
 * The countdown B23 prints under a live intent.
 *
 * Days rather than a ticking clock: an intent runs for a month, and a timer
 * counting seconds off a thirty-day window is precision nobody can use. `null`
 * once the intent has left the clock behind — signed, or already lapsed.
 */
export function intentCountdown(p: Placement, t: Translate): string | null {
  if (placementState(p) !== 'active') return null;
  const days = daysUntil(intentExpiresAt(p));
  if (days <= 0) return t('placements.intentToday');
  if (days === 1) return t('placements.intentTomorrow');
  return t('placements.intentDays', { count: days });
}

/** The same reading in the unit detail's own words, where it has a whole line. */
export function intentLine(p: Placement, t: Translate): string {
  const days = daysUntil(intentExpiresAt(p));
  if (days <= 0) return t('unit.placementLastDay');
  if (days === 1) return t('unit.placementOpenOne');
  return t('unit.placementOpen', { days });
}

/** The window, for copy that explains the rule rather than one placement. */
export const INTENT_DAYS = INTENT_WINDOW_DAYS;

/* ------------------------------------------------------------ the fee state */

export interface FeeFooter {
  label: string;
  tone: Tone;
  /** `false` where the amount is a hope rather than a receipt. */
  earned: boolean;
}

/** What the footer of a placement card says about the money on it. */
export function feeFooter(p: Placement, t: Translate): FeeFooter {
  const state = placementState(p);
  if (state === 'expired') return { label: t('placements.feeLapsed'), tone: 'neutral', earned: false };
  if (p.feeState === 'paid') return { label: t('placements.feeReceived'), tone: 'success', earned: true };
  return { label: t('placements.feeOnSigning'), tone: 'warning', earned: false };
}
