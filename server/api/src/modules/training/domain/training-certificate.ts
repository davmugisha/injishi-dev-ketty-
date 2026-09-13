import { PROPERTY_TIME_ZONE } from '@injishi/contracts';
import { randomBytes } from 'node:crypto';

/**
 * The certificate's own vocabulary: the serial, the token, the calendar date,
 * and the shape a renderer is handed (ADR-049 slice 1 item 8).
 *
 * Everything here is a pure function over its arguments so that the two things
 * that must never drift can be reasoned about on their own: how a serial is
 * built, and how a token is drawn. Both are printed onto paper that outlives
 * the process that made it.
 */

export const CERTIFICATE_RENDERER = Symbol('CERTIFICATE_RENDERER');

/**
 * Every value a certificate PDF is drawn from, and nothing else (AC-14).
 *
 * This is deliberately a flat record of strings rather than a certificate row
 * plus joins. The whole point of locking the values at issue is that the same
 * file can be rebuilt from the row alone, and a renderer that accepted a
 * session id could quietly start reading a live venue name instead of the
 * copied one. Give it no way to.
 *
 * NO BUSINESS NAME. It is recorded on the row and never printed (AC-12).
 */
export interface CertificateFacts {
  readonly serial: string;
  readonly holderName: string;
  readonly courseTitle: string;
  readonly courseVersion: number;
  /** `YYYY-MM-DD`, already resolved to the market's calendar day. */
  readonly sessionDate: string;
  readonly venueName: string;
  readonly districtName: string;
  readonly leadTrainerName: string;
  /** `YYYY-MM-DD`. */
  readonly issuedOn: string;
  /** The absolute URL the QR encodes and the footer prints. */
  readonly verifyUrl: string;
}

/** What renders the PDF. One implementation, `pdf-lib`, behind a seam. */
export interface CertificateRenderer {
  render(facts: CertificateFacts): Promise<Buffer>;
}

/**
 * The calendar day a session falls on, in the market's zone.
 *
 * `starts_at` is an instant and `session_date` is a DATE, and the conversion is
 * not a formatting detail: a session starting at 22:30 UTC on the 3rd is the
 * 4th in Kigali (UTC+2), so a certificate rendered off the raw instant would
 * name the wrong day on the paper. `en-CA` because it yields `YYYY-MM-DD`,
 * which is the same trick `revenue.service.ts` uses for the business date.
 */
export function marketCalendarDate(instant: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: PROPERTY_TIME_ZONE,
  }).format(instant);
}

/**
 * The alphabet a verification token is written in.
 *
 * Crockford base32 without `I`, `L`, `O` and `U`: the first three are
 * misread as `1` and `0`, and `U` is dropped so the generator cannot produce an
 * unfortunate word. A token gets typed in by somebody whose phone would not
 * scan, so the cost of an ambiguous glyph is a person who cannot check a
 * certificate they are holding.
 */
const TOKEN_ALPHABET = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';

/**
 * 160 bits of randomness, base32 encoded (AC-17).
 *
 * DERIVED FROM NOTHING. Not the serial, not the row id, not the holder's name
 * or the session. The serial is deliberately short and readable so it can be
 * quoted down a phone line, which is exactly why it must not be the thing that
 * opens the public page: anybody who has seen one piece of paper would then be
 * able to enumerate the rest.
 *
 * 160 rather than the 128 the criterion asks for because the cost is eight
 * characters of URL and the benefit is not having to think about it again.
 * `randomBytes` is the CSPRNG; `Math.random` is not one and must never appear
 * in this file.
 */
export function mintVerifyToken(): string {
  const bytes = randomBytes(20);
  let bits = 0;
  let value = 0;
  let out = '';

  for (const byte of bytes) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += TOKEN_ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += TOKEN_ALPHABET[(value << (5 - bits)) & 31];

  return out;
}

/**
 * `INJ-TR-<year of the session>-<sequence>` (AC-18).
 *
 * The year comes from the SESSION date and the number from a sequence that
 * never resets, so serials within one year are unique but not contiguous. That
 * gap is the intended trade and is worth stating plainly: a per-year counter
 * has to be reset by something, and the thing that resets a counter is the
 * thing that eventually reissues a serial somebody has already printed and
 * filed.
 *
 * Zero padded to six so the common case lines up in a column on a page, and
 * not truncated past it: a sequence value wider than six digits prints wider
 * rather than wrapping around.
 */
export function formatSerial(sessionDate: string, sequence: number): string {
  const year = sessionDate.slice(0, 4);
  return `INJ-TR-${year}-${String(sequence).padStart(6, '0')}`;
}

/**
 * The absolute URL a QR points at.
 *
 * Built from configuration rather than from the incoming request's host, and
 * that is the whole reason `TRAINING_VERIFY_BASE_URL` exists: a certificate
 * issued on the demo host must not print a link into production, and a request
 * header is attacker-controlled. A printed QR cannot be corrected later.
 */
export function verificationUrl(baseUrl: string, token: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/verify/${token}`;
}
