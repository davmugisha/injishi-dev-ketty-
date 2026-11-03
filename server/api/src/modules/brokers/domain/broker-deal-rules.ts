import type { BrokerDealStatus, BrokerDealTerms } from '@injishi/contracts';

/**
 * The rules of a broker's deal with a hotel (0125, 2026-11-02), as pure
 * functions so each is tested on its own: how the terms are stored, what each
 * side may do from each status, and when a running deal has ended by its date.
 * Dates are Kigali calendar days, `YYYY-MM-DD`.
 */

/** The stored shape of the terms: one row, the columns the kind does not use left null. */
export interface DealTermColumns {
  kind: BrokerDealTerms['kind'];
  percentBp: number | null;
  amountRwf: number | null;
  minRooms: number | null;
}

/** 7.5% is stored as 750 basis points, so no fraction is ever written. */
export function termColumns(terms: BrokerDealTerms): DealTermColumns {
  return terms.kind === 'percent'
    ? { kind: 'percent', percentBp: Math.round(terms.percent * 100), amountRwf: null, minRooms: null }
    : { kind: 'bulk_fixed', percentBp: null, amountRwf: terms.amountRwf, minRooms: terms.minRooms };
}

export function termsFromColumns(row: DealTermColumns): BrokerDealTerms {
  return row.kind === 'percent'
    ? { kind: 'percent', percent: (row.percentBp ?? 0) / 100 }
    : { kind: 'bulk_fixed', amountRwf: row.amountRwf ?? 0, minRooms: row.minRooms ?? 0 };
}

/**
 * The status a reader sees: a running deal whose end date has passed has ended,
 * whatever the row says. Nothing has to run at midnight for that to be true.
 */
export function effectiveStatus(status: BrokerDealStatus, endsOn: string | null, today: string): BrokerDealStatus {
  return status === 'active' && endsOn !== null && endsOn < today ? 'ended' : status;
}

/** A proposal's dates, checked against today: neither may be in the past. */
export function proposalDatesProblem(startsOn: string | null, endsOn: string | null, today: string): string | null {
  if (startsOn !== null && startsOn < today) return 'The start date cannot be in the past.';
  if (endsOn !== null && endsOn <= today) return 'The end date has to be after today.';
  return null;
}

export type DealMove = 'withdraw' | 'decide' | 'end';

/**
 * Whether a move is open from a status, and why not when it is not. The broker
 * withdraws only what the hotel has not answered; the hotel decides only a
 * proposal; either side ends only a running deal.
 */
export function moveProblem(move: DealMove, status: BrokerDealStatus): string | null {
  if (move === 'withdraw') {
    return status === 'proposed' ? null : 'Only a proposal the hotel has not answered can be withdrawn.';
  }
  if (move === 'decide') {
    if (status === 'proposed') return null;
    return status === 'withdrawn' ? 'The broker withdrew this proposal.' : 'This proposal has already been answered.';
  }
  return status === 'active' ? null : 'Only a running deal can be ended.';
}
