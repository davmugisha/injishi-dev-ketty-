import type { EbmDate, EbmTime } from '@injishi/contracts';

import { PROPERTY_TIME_ZONE } from '../../booking/domain/pricing';

/**
 * The clock an EBM receipt is stamped with.
 *
 * Clause 7.24.2 prescribes `Date: dd/mm/yyyy  Time: hh:mm:ss` and says nothing
 * about a zone, because the machine it describes sits in a shop in Rwanda and
 * has no other zone to be in. Ours runs wherever the container runs, so the
 * zone has to be chosen deliberately: a receipt for a Kigali hotel that reads
 * 23:40 on the 4th because the server thinks in UTC is a receipt that disagrees
 * with the guest's own evening, and with the tax day it belongs to.
 *
 * `PROPERTY_TIME_ZONE` is imported rather than restated. `booking/domain/
 * pricing.ts` owns that fact — it is the same constant that decides which day a
 * check-in falls on — and a second copy here is a second thing to update on the
 * day this platform serves a second market.
 */
const KIGALI_CLOCK = new Intl.DateTimeFormat('en-GB', {
  timeZone: PROPERTY_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
  // h23, not `hour12: false`. The latter renders midnight as `24:00:00` under
  // some ICU builds, which the `hh:mm:ss` contract rejects — and would reject
  // only for receipts issued in one particular minute of the day.
  hourCycle: 'h23',
});

/** `dd/mm/yyyy` + `hh:mm:ss` in the property's zone, per 7.24.2. */
export function ebmClockFor(at: Date): { date: EbmDate; time: EbmTime } {
  if (Number.isNaN(at.getTime())) {
    // Never format an unreadable instant into a plausible-looking date. A
    // receipt stamped `NaN/NaN/NaN` fails the contract loudly; one silently
    // stamped with "now" would be a fiscal document dated a lie.
    throw new Error('cannot stamp an EBM receipt with an invalid date');
  }

  const parts: Record<string, string> = {};
  for (const part of KIGALI_CLOCK.formatToParts(at)) {
    parts[part.type] = part.value;
  }

  return {
    date: `${parts.day}/${parts.month}/${parts.year}`,
    time: `${parts.hour}:${parts.minute}:${parts.second}`,
  };
}
