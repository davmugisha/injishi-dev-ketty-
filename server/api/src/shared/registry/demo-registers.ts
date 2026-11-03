import { createHash } from 'node:crypto';

/**
 * The made-up registers the MOCK document verifier and TIN adapter answer from
 * (ADR-060, ADR-075). Shared because the two must agree: a person's National ID
 * is what makes them a director of a business, and that agreement is the whole
 * of the owner-or-on-behalf demonstration. The mock reads a National ID front
 * as one of these people; a demo card names one by number
 * (`mock-identity-adapters.ts`).
 *
 * Every name, number, phone and company here is fictional. The mocks run only
 * over a sample database (`resolveIdentityMode`; the TIN mock returns details
 * only there), so none of it can land on a real account.
 *
 * THE RULES A DEMO CAN RELY ON
 *
 * People (the population register):
 * - The named people below are found by their National ID.
 * - Any other well formed National ID is found too, as a person generated from
 *   the number itself: the birth year and gender marker it encodes, and a name,
 *   birthday and phone picked from the rest. The same number is always the
 *   same person.
 * - A National ID whose sequence (digits 7 to 13) is `0000000` is not found.
 * - One whose sequence is `1111111` is found with no phone on record, which is
 *   what a register answers for a person nothing can bind.
 *
 * Companies (the company register, keyed by TIN). Kept in the `998` block, off
 * the `999` block the demo catalogue and the verify scripts draw random TINs
 * from, so a random TIN never lands on a company with directors:
 * - The named businesses below, with their directors.
 * - `9981NNNNN` (any five digits N): a company with ONE director, whose
 *   National ID is `11990800` + `NNNNN` + `101`.
 * - `9982NNNNN`: a company with TWO directors, National IDs `11990801` +
 *   `NNNNN` + `101` and `11992702` + `NNNNN` + `101`.
 * - Every other TIN is known to be valid and carries no company details, so
 *   the Business step is typed by hand, exactly as before ADR-060.
 */

export interface DemoPerson {
  documentNumber: string;
  fullName: string;
  dateOfBirth: string;
  gender: 'female' | 'male' | null;
  phoneE164: string | null;
}

export const DEMO_PEOPLE: readonly DemoPerson[] = [
  {
    // The seeded persona `rayan@demo.injishi.com` holds this number, so the
    // register agrees with what the demo database already says about him.
    documentNumber: '1199080123456789',
    fullName: 'Rayan Iraguha',
    dateOfBirth: '1990-02-14',
    gender: 'male',
    phoneE164: '+250788000211',
  },
  {
    documentNumber: '1198870034567812',
    fullName: 'Aline Uwase',
    dateOfBirth: '1988-07-21',
    gender: 'female',
    phoneE164: '+250788300412',
  },
  {
    documentNumber: '1198580045678923',
    fullName: 'Eric Habimana',
    dateOfBirth: '1985-11-03',
    gender: 'male',
    phoneE164: '+250788300523',
  },
  {
    documentNumber: '1199270056789034',
    fullName: 'Diane Mukamana',
    dateOfBirth: '1992-04-09',
    gender: 'female',
    phoneE164: '+250788300634',
  },
];

export interface DemoBusiness {
  tin: string;
  legalName: string;
  registeredOn: string;
  companyType: 'private_company' | 'sole_trader' | 'cooperative';
  address: { provinceId: number; districtId: number; sectorId: number; street: string };
  /** Directors by National ID, which is how the owner rule compares them. */
  directorDocumentNumbers: readonly string[];
}

export const DEMO_BUSINESSES: readonly DemoBusiness[] = [
  {
    // Aline is its only director: she registers it as its owner.
    tin: '998000001',
    legalName: 'Uwase Hospitality Ltd',
    registeredOn: '2019-03-12',
    companyType: 'private_company',
    address: { provinceId: 1, districtId: 102, sectorId: 10201, street: 'KG 11 Ave' },
    directorDocumentNumbers: ['1198870034567812'],
  },
  {
    // Eric and Diane direct it: anyone else registers it on their behalf.
    tin: '998000002',
    legalName: 'Kivu Lakeside Lodges Ltd',
    registeredOn: '2016-09-30',
    companyType: 'private_company',
    address: { provinceId: 3, districtId: 303, sectorId: 30301, street: 'Lake Kivu Rd' },
    directorDocumentNumbers: ['1198580045678923', '1199270056789034'],
  },
  {
    // A sole trader: Rayan trades under his own name.
    tin: '998000003',
    legalName: 'Iraguha Guest House',
    registeredOn: '2021-06-01',
    companyType: 'sole_trader',
    address: { provinceId: 4, districtId: 403, sectorId: 40301, street: 'Musanze Main Rd' },
    directorDocumentNumbers: ['1199080123456789'],
  },
];

/** The person the register holds for a National ID, or null for none. */
export function registerPerson(documentNumber: string): DemoPerson | null {
  const named = DEMO_PEOPLE.find((p) => p.documentNumber === documentNumber);
  if (named) return named;
  if (!/^\d{16}$/.test(documentNumber)) return null;
  const sequence = documentNumber.slice(6, 13);
  if (sequence === '0000000') return null;

  const seed = digest(documentNumber);
  const year = Number(documentNumber.slice(1, 5));
  // Digits 2–5 are the birth year: a year no living person was born in is no one on the register.
  if (year < 1900 || year > new Date().getUTCFullYear()) return null;
  const gender =
    documentNumber[5] === '8' ? 'male' : documentNumber[5] === '7' ? 'female' : null;
  const given = gender === 'female' ? FEMALE_NAMES : MALE_NAMES;
  return {
    documentNumber,
    fullName: `${given[seed[2]! % given.length]} ${SURNAMES[seed[3]! % SURNAMES.length]}`,
    dateOfBirth: `${year}-${pad(1 + (seed[0]! % 12))}-${pad(1 + (seed[1]! % 28))}`,
    gender,
    phoneE164:
      sequence === '1111111'
        ? null
        : `+25078${String(1_000_000 + (seed.readUInt32BE(4) % 9_000_000)).padStart(7, '0')}`,
  };
}

/** The company the register holds for a TIN, or null when it holds no details. */
export function registerBusiness(tin: string): DemoBusiness | null {
  const named = DEMO_BUSINESSES.find((b) => b.tin === tin);
  if (named) return named;
  const block = /^998([12])(\d{5})$/.exec(tin);
  if (!block) return null;
  const [, kind, digits] = block as unknown as [string, '1' | '2', string];
  const seed = digest(tin);
  const place = GENERATED_ADDRESSES[seed[0]! % GENERATED_ADDRESSES.length]!;
  const directors =
    kind === '1'
      ? [`11990800${digits}101`]
      : [`11990801${digits}101`, `11992702${digits}101`];
  const lead = registerPerson(directors[0]!);
  const surname = lead?.fullName.split(' ').at(-1) ?? 'Demo';
  return {
    tin,
    legalName: `${surname} ${BUSINESS_WORDS[seed[1]! % BUSINESS_WORDS.length]} Ltd`,
    registeredOn: `${2005 + (seed[2]! % 19)}-${pad(1 + (seed[3]! % 12))}-${pad(1 + (seed[4]! % 28))}`,
    companyType: 'private_company',
    address: place,
    directorDocumentNumbers: directors,
  };
}

const MALE_NAMES = ['Jean', 'Eric', 'Patrick', 'Innocent', 'Olivier', 'Emmanuel', 'Claude', 'Didier'];
const FEMALE_NAMES = ['Aline', 'Diane', 'Grace', 'Clarisse', 'Josiane', 'Solange', 'Vestine', 'Chantal'];
const SURNAMES = ['Mugabo', 'Uwimana', 'Niyonzima', 'Mukamana', 'Habimana', 'Ingabire', 'Nshimiyimana', 'Uwase'];
const BUSINESS_WORDS = ['Hospitality', 'Lodges', 'Hotels', 'Guest Houses', 'Resorts', 'Suites'];
const GENERATED_ADDRESSES = [
  { provinceId: 1, districtId: 102, sectorId: 10205, street: 'KG 7 Ave' },
  { provinceId: 1, districtId: 101, sectorId: 10101, street: 'KN 4 St' },
  { provinceId: 3, districtId: 301, sectorId: 30101, street: 'Kibuye Rd' },
  { provinceId: 4, districtId: 403, sectorId: 40301, street: 'Ruhengeri Rd' },
];

export const MOCK_GIVEN_NAMES = { male: MALE_NAMES, female: FEMALE_NAMES } as const;
export const MOCK_SURNAMES = SURNAMES;

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
