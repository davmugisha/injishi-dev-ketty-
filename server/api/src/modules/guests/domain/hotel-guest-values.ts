import { RWANDA_CODE } from '@injishi/contracts';

import type { GuestValues, HotelStayFacts } from '../infrastructure/guest-registry.repository';

/** The register's longest stay (`guest_registrations_dates`). */
const MAX_NIGHTS = 90;

/** A phone the desk or the account gave, as E.164, or null when it cannot be read as one. */
export function phoneE164(raw: string | null): string | null {
  if (!raw) return null;
  const digits = raw.replace(/[^\d+]/g, '');
  let e164: string;
  if (digits.startsWith('+')) e164 = digits;
  else if (/^07\d{8}$/.test(digits)) e164 = `+250${digits.slice(1)}`;
  else if (/^7\d{8}$/.test(digits)) e164 = `+250${digits}`;
  else if (/^250\d{9}$/.test(digits)) e164 = `+${digits}`;
  else return null;
  return /^[+][1-9][0-9]{7,14}$/.test(e164) ? e164 : null;
}

/**
 * The document, in the shapes the register accepts (16 digits for a National
 * ID, 5 to 20 letters or digits for a passport), or neither. An "other"
 * document, or a number that does not fit, files the guest with no document
 * rather than failing the filing.
 */
export function guestDocument(
  kind: string | null,
  number: string | null,
): { idKind: 'national_id' | 'passport' | null; idNumber: string | null } {
  if (!kind || !number) return { idKind: null, idNumber: null };
  if (kind === 'national_id') {
    const n = number.replace(/\D/g, '');
    return /^[0-9]{16}$/.test(n) ? { idKind: 'national_id', idNumber: n } : { idKind: null, idNumber: null };
  }
  if (kind === 'passport') {
    const n = number.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    return /^[A-Z0-9]{5,20}$/.test(n) ? { idKind: 'passport', idNumber: n } : { idKind: null, idNumber: null };
  }
  return { idKind: null, idNumber: null };
}

/**
 * Who the guest is reported as, in order of how sure it is: the desk's
 * country, the account's document, a Rwandan National ID on the card, then the
 * profile's country. `known` is false when nothing said it, so the caller can
 * log a guest filed as Rwandan for want of an answer.
 */
export function guestNationality(f: HotelStayFacts): { code: string; known: boolean } {
  const from =
    f.cardNationality ??
    f.accountIssuingCountry ??
    (f.cardDocumentType === 'national_id' || f.accountDocumentType === 'national_id' ? RWANDA_CODE : null);
  if (from) return { code: from.trim().toUpperCase(), known: true };
  if (f.profileCountry) return { code: f.profileCountry.trim().toUpperCase(), known: true };
  return { code: RWANDA_CODE, known: false };
}

function addDays(day: string, n: number): string {
  const d = new Date(`${day}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** The stay's dates as the register keeps them: departure on or after arrival, at most 90 nights. */
export function stayWindow(arrivalOn: string, departureOn: string | null): { arrivalOn: string; departureOn: string } {
  let out = departureOn && departureOn >= arrivalOn ? departureOn : arrivalOn;
  const latest = addDays(arrivalOn, MAX_NIGHTS);
  if (out > latest) out = latest;
  return { arrivalOn, departureOn: out };
}

/** The registration a hotel stay files, or null when it has no name to file under. */
export function hotelGuestValues(f: HotelStayFacts): { values: GuestValues; nationalityKnown: boolean } | null {
  const fullName = f.fullName?.trim() ?? '';
  if (fullName.length < 2) return null;
  const nationality = guestNationality(f);
  const card = guestDocument(f.cardDocumentType, f.cardIdNumber);
  const doc = card.idKind ? card : guestDocument(f.accountDocumentType, f.accountIdNumber);
  const rwandan = nationality.code === RWANDA_CODE;
  return {
    nationalityKnown: nationality.known,
    values: {
      fullName,
      phone: phoneE164(f.phone),
      nationality: nationality.code,
      idKind: doc.idKind,
      idNumber: doc.idNumber,
      relationship: null,
      relationshipOther: null,
      originCountry: nationality.code,
      // A Rwandan's home village, when their profile holds one; a hotel rarely asks.
      originVillageId: rwandan ? f.profileVillageId : null,
      ...stayWindow(f.arrivalOn, f.departureOn),
    },
  };
}
