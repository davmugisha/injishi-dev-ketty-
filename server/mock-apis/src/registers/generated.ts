import { createHash } from 'node:crypto';

import type { Citizen, Taxpayer } from './schemas.ts';

/**
 * The people and companies the registers hold WITHOUT a seed row, made up from
 * the number itself so the same number is always the same person.
 *
 * These rules are a copy of `server/api/src/shared/registry/demo-registers.ts`
 * (`registerPerson`, `registerBusiness`), which the API's in-process mocks
 * answer from. They are copied rather than shared because the two processes
 * meet over HTTP only; keeping them identical is what lets a seam move from
 * `mock` to `sandbox` without a demo's people changing names. Change both.
 *
 * Citizens, for any well formed National ID (`1`, birth year, gender marker
 * `7` female or `8` male, a seven digit sequence, three more digits):
 * - sequence `0000000`: not found;
 * - sequence `9999999`: the gateway is down (`isNidaOutage`);
 * - anything else: found, a name and birthday picked from the number.
 *
 * Taxpayers, in the `998` block:
 * - `9981NNNNN`: one director, National ID `11990800NNNNN101`;
 * - `9982NNNNN`: two directors, `11990801NNNNN101` and `11992702NNNNN101`;
 * - any other TIN without a seed row is not registered.
 */

const MALE_NAMES = ['Jean', 'Eric', 'Patrick', 'Innocent', 'Olivier', 'Emmanuel', 'Claude', 'Didier'];
const FEMALE_NAMES = ['Aline', 'Diane', 'Grace', 'Clarisse', 'Josiane', 'Solange', 'Vestine', 'Chantal'];
const SURNAMES = ['Mugabo', 'Uwimana', 'Niyonzima', 'Mukamana', 'Habimana', 'Ingabire', 'Nshimiyimana', 'Uwase'];
const BUSINESS_WORDS = ['Hospitality', 'Lodges', 'Hotels', 'Guest Houses', 'Resorts', 'Suites'];
const GENERATED_ADDRESSES = [
  { provinceCode: 1, districtCode: 102, sectorCode: 10205, street: 'KG 7 Ave' },
  { provinceCode: 1, districtCode: 101, sectorCode: 10101, street: 'KN 4 St' },
  { provinceCode: 3, districtCode: 301, sectorCode: 30101, street: 'Kibuye Rd' },
  { provinceCode: 4, districtCode: 403, sectorCode: 40301, street: 'Ruhengeri Rd' },
];

export const PASSPORT_GIVEN = { M: MALE_NAMES, F: FEMALE_NAMES } as const;
export const PASSPORT_SURNAMES = SURNAMES;

export function digest(value: string | Buffer): Buffer {
  return createHash('sha256').update(value).digest();
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

/** A National ID whose sequence asks for the gateway to be down. */
export function isNidaOutage(nationalId: string): boolean {
  return /^\d{16}$/.test(nationalId) && nationalId.slice(6, 13) === '9999999';
}

/** The citizen a National ID stands for when no seed row names it, or null when none does. */
export function generatedCitizen(nationalId: string): Citizen | null {
  if (!/^\d{16}$/.test(nationalId)) return null;
  const sequence = nationalId.slice(6, 13);
  if (sequence === '0000000' || sequence === '9999999') return null;
  const seed = digest(nationalId);
  const year = Number(nationalId.slice(1, 5));
  // `registerPerson` reads any other marker as no gender; NIDA prints one, so
  // the mock prints male there rather than invent a third answer.
  const sex = nationalId[5] === '7' ? 'F' : 'M';
  const given = sex === 'F' ? FEMALE_NAMES : MALE_NAMES;
  return {
    nationalId,
    foreNames: given[seed[2]! % given.length]!,
    surname: SURNAMES[seed[3]! % SURNAMES.length]!,
    dateOfBirth: `${year}-${pad(1 + (seed[0]! % 12))}-${pad(1 + (seed[1]! % 28))}`,
    sex,
    scenario: 'valid',
  };
}

/** The taxpayer a TIN in the generated blocks stands for, or null. */
export function generatedTaxpayer(tin: string, citizen: (nid: string) => Citizen | null): Taxpayer | null {
  const block = /^998([12])(\d{5})$/.exec(tin);
  if (!block) return null;
  const kind = block[1]!;
  const digits = block[2]!;
  const seed = digest(tin);
  const place = GENERATED_ADDRESSES[seed[0]! % GENERATED_ADDRESSES.length]!;
  const ids = kind === '1' ? [`11990800${digits}101`] : [`11990801${digits}101`, `11992702${digits}101`];
  const people = ids.map((id) => citizen(id));
  const surname = people[0]?.surname ?? 'Demo';
  return {
    tin,
    taxpayerName: `${surname} ${BUSINESS_WORDS[seed[1]! % BUSINESS_WORDS.length]} Ltd`,
    tradingName: null,
    legalForm: 'PRIVATE_LIMITED',
    registrationDate: `${2005 + (seed[2]! % 19)}-${pad(1 + (seed[3]! % 12))}-${pad(1 + (seed[4]! % 28))}`,
    vatRegistered: seed[5]! % 2 === 0,
    address: place,
    directors: ids.map((nationalId, i) => ({
      fullName: people[i] ? `${people[i]!.foreNames} ${people[i]!.surname}` : 'A director',
      nationalId,
      passportNumber: null,
      role: 'DIRECTOR' as const,
    })),
    scenario: 'active',
  };
}
