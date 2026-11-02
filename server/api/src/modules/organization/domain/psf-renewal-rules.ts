import { PSF_RENEWAL_WINDOW_DAYS, defaultPsfMembershipDates } from '@injishi/contracts';

/**
 * When a PSF membership can be renewed, and the year a renewal buys
 * (2026-11-02, the owner's decisions). Dates are Kigali yyyy-mm-dd; an
 * `expiresOn` is the last day the membership is valid.
 *
 * - A current membership opens for renewal 60 days before its end date, and
 *   the new year runs on from the day after it, so renewing early loses nothing.
 * - An ended (lapsed) membership can be renewed any day, and the new year
 *   starts on the day it is paid.
 */
export function psfRenewalTerms(input: { expiresOn: string; ended: boolean; today: string }): {
  open: boolean;
  opensOn: string;
  reason: string | null;
  startsOn: string;
  expiresOn: string;
} {
  const opensOn = addDays(input.expiresOn, -PSF_RENEWAL_WINDOW_DAYS);
  const lapsed = input.ended || input.expiresOn < input.today;
  const startsOn = lapsed ? input.today : addDays(input.expiresOn, 1);
  const open = lapsed || input.today >= opensOn;
  return {
    open,
    opensOn,
    reason: open ? null : `Renewal opens on ${opensOn}, ${PSF_RENEWAL_WINDOW_DAYS} days before the membership ends.`,
    startsOn,
    expiresOn: defaultPsfMembershipDates(startsOn).expiresOn,
  };
}

/** A moment, as the yyyy-mm-dd date it was in Kigali. */
export function kigaliDateOf(at: Date): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Kigali' }).format(at);
}

/** A yyyy-mm-dd date moved by whole days, in calendar terms. */
function addDays(isoDate: string, days: number): string {
  const [y, m, d] = isoDate.split('-').map(Number) as [number, number, number];
  return new Date(Date.UTC(y, m - 1, d + days)).toISOString().slice(0, 10);
}
