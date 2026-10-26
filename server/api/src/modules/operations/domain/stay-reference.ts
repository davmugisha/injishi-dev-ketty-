import { randomInt } from 'node:crypto';

/**
 * A stay's human handle, `ST-` and six characters (interface real-data,
 * frontdesk leaf), e.g. `ST-7Q2M4X`.
 *
 * The desk quotes it in a handover and on the phone the way it quotes a
 * booking reference, and a uuid is not something anybody reads aloud. Drawn
 * from the CSPRNG over the booking reference's alphabet, which has no look
 * alikes (no `I`, `L`, `O`, `0`, `1`), and never derived from a sequence: a
 * running number tells anyone holding one slip how many guests came before.
 * `guest_stays_reference_uk` refuses a repeat and the repository draws again.
 */
export function makeStayReference(): string {
  const alphabet = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let out = '';
  for (let i = 0; i < 6; i++) out += alphabet[randomInt(alphabet.length)];
  return `ST-${out}`;
}

/** The index that refuses a repeated stay reference. */
export const STAY_REFERENCE_INDEX = 'guest_stays_reference_uk';

/**
 * When a stay is due out: the booking's checkout DAY at the property's
 * checkout HOUR, on the Kigali clock (Rwanda keeps one zone, UTC+2, with no
 * daylight saving). `11:00` when the property states no hour.
 *
 * Check in used to write `T11:00:00Z`, which is 13:00 in Kigali: every booked
 * stay read as due out two hours after the property's own checkout time.
 */
export function plannedExitFor(checkOutDate: string, checkOutTime: string | null | undefined): Date {
  const time = /^\d{2}:\d{2}(:\d{2})?$/.test(checkOutTime ?? '') ? (checkOutTime as string).slice(0, 5) : '11:00';
  return new Date(`${checkOutDate}T${time}:00+02:00`);
}
