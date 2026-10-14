import { createHash } from 'node:crypto';

import { Injectable } from '@nestjs/common';

import {
  MOCK_GIVEN_NAMES,
  MOCK_SURNAMES,
  registerPerson,
} from '../../../shared/registry/demo-registers';
import type {
  DocumentCheck,
  DocumentImage,
  DocumentVerifierPort,
  IdentityAdapterMode,
  IdentityRegistryPort,
  RegistryLookup,
} from '../domain/identity-ports';

/**
 * The MOCK population register (ADR-060). Runs only over a sample database
 * (`resolveIdentityMode`), and says so on every answer (`generated: true`).
 * Who it finds, and who it does not, is `registerPerson` in
 * `shared/registry/demo-registers.ts`, which the TIN mock's directors share.
 */
@Injectable()
export class MockIdentityRegistry implements IdentityRegistryPort {
  readonly mode: IdentityAdapterMode = 'mock';

  async lookupNationalId(documentNumber: string): Promise<RegistryLookup> {
    const person = registerPerson(documentNumber);
    if (!person) return { status: 'not_found' };
    return {
      status: 'found',
      generated: true,
      person: {
        fullName: person.fullName,
        dateOfBirth: person.dateOfBirth,
        gender: person.gender,
        phoneE164: person.phoneE164,
      },
    };
  }
}

/**
 * The MOCK document verifier (ADR-060). It reads nothing off the image: there
 * is no OCR here, and pretending otherwise would be the worst kind of mock. It
 * checks what it honestly can, and invents a holder from the image bytes so the
 * same photo always yields the same person.
 *
 * - An image under 2 KB is `unreadable`: nothing a camera produces is that small.
 * - A selfie that is byte for byte the passport photo is a `face_mismatch`: the
 *   one substitution a mock can actually detect, and the commonest mistake.
 */
@Injectable()
export class MockDocumentVerifier implements DocumentVerifierPort {
  readonly mode: IdentityAdapterMode = 'mock';

  async verifyPassport(input: {
    document: DocumentImage;
    selfie: DocumentImage;
  }): Promise<DocumentCheck> {
    if (input.document.bytes.length < MIN_IMAGE_BYTES || input.selfie.bytes.length < MIN_IMAGE_BYTES) {
      return { status: 'rejected', reason: 'unreadable' };
    }
    if (input.document.bytes.equals(input.selfie.bytes)) {
      return { status: 'rejected', reason: 'face_mismatch' };
    }
    const seed = createHash('sha256').update(input.document.bytes).digest();
    const female = seed[0]! % 2 === 0;
    const given = female ? MOCK_GIVEN_NAMES.female : MOCK_GIVEN_NAMES.male;
    const year = 1960 + (seed[1]! % 40);
    const country = PASSPORT_COUNTRIES[seed[2]! % PASSPORT_COUNTRIES.length]!;
    const thisYear = new Date().getUTCFullYear();
    return {
      status: 'verified',
      generated: true,
      holder: {
        fullName: `${given[seed[3]! % given.length]} ${MOCK_SURNAMES[seed[4]! % MOCK_SURNAMES.length]}`,
        dateOfBirth: `${year}-${pad(1 + (seed[5]! % 12))}-${pad(1 + (seed[6]! % 28))}`,
        gender: female ? 'female' : 'male',
        documentNumber: `P${String(seed.readUInt32BE(8) % 100_000_000).padStart(8, '0')}`,
        issuingCountry: country,
        expiresOn: `${thisYear + 1 + (seed[7]! % 8)}-${pad(1 + (seed[9]! % 12))}-15`,
      },
    };
  }
}

/** A seam switched off: every lookup is unavailable, and nothing is enforced. */
export class OffIdentityRegistry implements IdentityRegistryPort {
  readonly mode: IdentityAdapterMode = 'off';
  async lookupNationalId(): Promise<RegistryLookup> {
    return { status: 'unavailable' };
  }
}

export class OffDocumentVerifier implements DocumentVerifierPort {
  readonly mode: IdentityAdapterMode = 'off';
  async verifyPassport(): Promise<DocumentCheck> {
    return { status: 'unavailable' };
  }
}

const MIN_IMAGE_BYTES = 2048;
const PASSPORT_COUNTRIES = ['KE', 'UG', 'TZ', 'GB', 'US', 'DE', 'FR', 'BE'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}
