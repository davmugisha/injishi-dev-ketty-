import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  MOCK_GIVEN_NAMES,
  MOCK_SURNAMES,
  registerPerson,
} from '../../../shared/registry/demo-registers';
import type {
  DocumentCheck,
  DocumentHolder,
  DocumentImage,
  DocumentVerifierPort,
  IdentityAdapterMode,
} from '../domain/identity-ports';

/**
 * The MOCK document verifier (ADR-060, both documents since ADR-075 O-4). It
 * reads nothing off a photo: there is no OCR here, and pretending otherwise
 * would be the worst kind of mock. It checks what it honestly can, and invents
 * a holder from the image bytes so the same photo always yields the same person.
 *
 * - An image under 2 KB is `unreadable`: nothing a camera produces is that small.
 * - A selfie that is byte for byte the document photo is a `face_mismatch`: the
 *   one substitution a mock can actually detect, and the commonest mistake.
 * - A National ID front is read as a National ID from the demo population
 *   register (`registerPerson`), so the person it invents is the one the TIN
 *   mock's directors are drawn from. A DEMO CARD, an image whose bytes carry
 *   `INJISHI-DEMO-NID:` and sixteen digits, is read as that number: it is how a
 *   demo or a verify script scans as a named director. A camera photo never
 *   carries the marker, so it never lands on a director by chance.
 */
@Injectable()
export class MockDocumentVerifier implements DocumentVerifierPort {
  readonly mode: IdentityAdapterMode = 'mock';

  async verifyDocument(input: {
    documentType: 'national_id' | 'passport';
    front: DocumentImage;
    selfie: DocumentImage;
  }): Promise<DocumentCheck> {
    if (input.front.bytes.length < MIN_IMAGE_BYTES || input.selfie.bytes.length < MIN_IMAGE_BYTES) {
      return { status: 'rejected', reason: 'unreadable' };
    }
    if (input.front.bytes.equals(input.selfie.bytes)) {
      return { status: 'rejected', reason: 'face_mismatch' };
    }
    const seed = createHash('sha256').update(input.front.bytes).digest();
    const holder =
      input.documentType === 'national_id' ? nationalIdHolder(input.front.bytes, seed) : passportHolder(seed);
    return holder ? { status: 'verified', generated: true, holder } : { status: 'rejected', reason: 'unreadable' };
  }
}

/** A seam switched off: nothing is read, and the scan keeps the photos for PSF. */
export class OffDocumentVerifier implements DocumentVerifierPort {
  readonly mode: IdentityAdapterMode = 'off';
  async verifyDocument(): Promise<DocumentCheck> {
    return { status: 'unavailable' };
  }
}

const MIN_IMAGE_BYTES = 2048;
const PASSPORT_COUNTRIES = ['KE', 'UG', 'TZ', 'GB', 'US', 'DE', 'FR', 'BE'];
const DEMO_CARD = /INJISHI-DEMO-NID:(\d{16})/;

/**
 * A National ID's holder: the demo card's number, else a number made from the
 * photo. A made up number has the shape the register reads (`1`, the birth
 * year, the gender marker, a sequence, then three more digits) and a sequence
 * that is never `0000000` (not found) or `1111111` (no phone), so every photo
 * reads as someone.
 */
function nationalIdHolder(bytes: Buffer, seed: Buffer): DocumentHolder | null {
  const card = DEMO_CARD.exec(bytes.toString('latin1'));
  const number = card ? card[1]! : madeUpNationalId(seed);
  const person = registerPerson(number);
  if (!person) return null;
  return {
    fullName: person.fullName,
    dateOfBirth: person.dateOfBirth,
    gender: person.gender,
    documentNumber: number,
    issuingCountry: 'RW',
    expiresOn: null,
  };
}

function madeUpNationalId(seed: Buffer): string {
  const year = 1960 + (seed[1]! % 40);
  const marker = seed[0]! % 2 === 0 ? '7' : '8';
  const sequence = String(2_000_000 + (seed.readUInt32BE(8) % 7_000_000)).padStart(7, '0');
  const tail = String(seed.readUInt16BE(12) % 1000).padStart(3, '0');
  return `1${year}${marker}${sequence}${tail}`;
}

function passportHolder(seed: Buffer): DocumentHolder {
  const female = seed[0]! % 2 === 0;
  const given = female ? MOCK_GIVEN_NAMES.female : MOCK_GIVEN_NAMES.male;
  const year = 1960 + (seed[1]! % 40);
  const country = PASSPORT_COUNTRIES[seed[2]! % PASSPORT_COUNTRIES.length]!;
  const thisYear = new Date().getUTCFullYear();
  return {
    fullName: `${given[seed[3]! % given.length]} ${MOCK_SURNAMES[seed[4]! % MOCK_SURNAMES.length]}`,
    dateOfBirth: `${year}-${pad(1 + (seed[5]! % 12))}-${pad(1 + (seed[6]! % 28))}`,
    gender: female ? 'female' : 'male',
    documentNumber: `P${String(seed.readUInt32BE(8) % 100_000_000).padStart(8, '0')}`,
    issuingCountry: country,
    expiresOn: `${thisYear + 1 + (seed[7]! % 8)}-${pad(1 + (seed[9]! % 12))}-15`,
  };
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
