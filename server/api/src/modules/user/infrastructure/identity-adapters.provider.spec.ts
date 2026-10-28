import { describe, expect, it } from 'vitest';

import { registerPerson } from '../../../shared/registry/demo-registers';
import { RraTinAdapter } from '../../organization/infrastructure/rra-tin.adapter';
import { resolveIdentityMode } from '../domain/identity-ports';
import { buildDocumentVerifier } from './identity-adapters.provider';
import { MockDocumentVerifier } from './mock-identity-adapters';

/**
 * The document verifier seam (ADR-060, ADR-075): which side runs, decided once
 * at boot, and the demo rules the mock promises in
 * `shared/registry/demo-registers.ts`.
 */

const SAMPLE = { sampleData: true };
const REAL = { sampleData: false };

describe('resolveIdentityMode', () => {
  it('runs the mock over a sample database when unset', () => {
    expect(resolveIdentityMode('X', undefined, true)).toBe('mock');
  });

  it('runs off over a real database when unset, so production keeps photos and reads nothing', () => {
    expect(resolveIdentityMode('X', undefined, false)).toBe('off');
    expect(resolveIdentityMode('X', '  ', false)).toBe('off');
  });

  it('refuses the mock over a real database, naming the variable', () => {
    expect(() => resolveIdentityMode('DOCUMENT_VERIFIER_MODE', 'mock', false)).toThrow(
      /DOCUMENT_VERIFIER_MODE=mock is refused/,
    );
  });

  it('reads the mode case and whitespace insensitively, and refuses nonsense', () => {
    expect(resolveIdentityMode('X', ' Live ', false)).toBe('live');
    expect(resolveIdentityMode('X', 'OFF', true)).toBe('off');
    expect(() => resolveIdentityMode('X', 'maybe', true)).toThrow(/must be "mock", "live" or "off"/);
  });
});

describe('building the adapter', () => {
  it('refuses to boot on live with no provider registered', () => {
    expect(() => buildDocumentVerifier({ DOCUMENT_VERIFIER_MODE: 'live' }, REAL)).toThrow(
      /no live document verifier is registered/,
    );
  });

  it('binds the mock over a sample database and off over a real one', () => {
    expect(buildDocumentVerifier({}, SAMPLE).mode).toBe('mock');
    expect(buildDocumentVerifier({}, REAL).mode).toBe('off');
  });

  it('answers unavailable when off, never a person', async () => {
    const off = buildDocumentVerifier({}, REAL);
    const photo = { mime: 'image/jpeg', bytes: Buffer.alloc(4096, 1) };
    expect(
      (await off.verifyDocument({ documentType: 'national_id', front: photo, selfie: photo })).status,
    ).toBe('unavailable');
  });
});

describe('MockDocumentVerifier', () => {
  const verifier = new MockDocumentVerifier();
  const photo = (fill: number, size = 4096): { mime: string; bytes: Buffer } => ({
    mime: 'image/jpeg',
    bytes: Buffer.alloc(size, fill),
  });
  const demoCard = (number: string): { mime: string; bytes: Buffer } => ({
    mime: 'image/jpeg',
    bytes: Buffer.concat([Buffer.alloc(4096, 7), Buffer.from(`INJISHI-DEMO-NID:${number}`, 'latin1')]),
  });

  it('calls an image too small to be a photo unreadable', async () => {
    for (const documentType of ['national_id', 'passport'] as const) {
      expect(await verifier.verifyDocument({ documentType, front: photo(1, 100), selfie: photo(2) })).toEqual({
        status: 'rejected',
        reason: 'unreadable',
      });
    }
  });

  it('calls a selfie that is the document photo itself a face mismatch', async () => {
    expect(await verifier.verifyDocument({ documentType: 'national_id', front: photo(1), selfie: photo(1) })).toEqual({
      status: 'rejected',
      reason: 'face_mismatch',
    });
  });

  it('reads a passport page as a passport, the same holder for the same page every time', async () => {
    const first = await verifier.verifyDocument({ documentType: 'passport', front: photo(3), selfie: photo(4) });
    const again = await verifier.verifyDocument({ documentType: 'passport', front: photo(3), selfie: photo(5) });
    expect(first.status).toBe('verified');
    expect(first).toEqual(again);
    if (first.status !== 'verified') return;
    expect(first.holder.documentNumber).toMatch(/^P\d{8}$/);
    expect(first.holder.expiresOn).not.toBeNull();
    expect(first.generated).toBe(true);
  });

  it('reads a National ID front as a Rwandan National ID the register knows, with no expiry', async () => {
    const first = await verifier.verifyDocument({ documentType: 'national_id', front: photo(6), selfie: photo(4) });
    const again = await verifier.verifyDocument({ documentType: 'national_id', front: photo(6), selfie: photo(5) });
    expect(first).toEqual(again);
    if (first.status !== 'verified') throw new Error(first.status);
    expect(first.holder.documentNumber).toMatch(/^\d{16}$/);
    expect(first.holder.issuingCountry).toBe('RW');
    expect(first.holder.expiresOn).toBeNull();
    // The register agrees with the card: the same person, by the same number.
    expect(registerPerson(first.holder.documentNumber)?.fullName).toBe(first.holder.fullName);
  });

  it('reads a demo card as its number, so a demo scans as a named director', async () => {
    const found = await verifier.verifyDocument({
      documentType: 'national_id',
      front: demoCard('1198870034567812'),
      selfie: photo(4),
    });
    expect(found).toMatchObject({
      status: 'verified',
      generated: true,
      holder: { fullName: 'Aline Uwase', documentNumber: '1198870034567812', dateOfBirth: '1988-07-21' },
    });
  });
});

describe('the demo population register', () => {
  it('does not find a number whose sequence is all zeros', () => {
    expect(registerPerson('1199080000000012')).toBeNull();
  });

  it('invents anyone else from the number: its birth year and gender marker, the same every time', () => {
    const first = registerPerson('1197580099887766');
    expect(first).toEqual(registerPerson('1197580099887766'));
    expect(first?.dateOfBirth.startsWith('1975-')).toBe(true);
    expect(first?.gender).toBe('male');
  });
});

describe('RraTinAdapter company details (ADR-060)', () => {
  it('fills a demo register business, with its directors, over a sample database', async () => {
    const outcome = await new RraTinAdapter(SAMPLE).verify('998000002');
    expect(outcome.result).toBe('verified');
    if (outcome.result !== 'verified') return;
    expect(outcome.business?.legalName).toBe('Kivu Lakeside Lodges Ltd');
    expect(outcome.business?.directors.map((d) => d.name)).toEqual(['Eric Habimana', 'Diane Mukamana']);
  });

  it('invents nothing for any other TIN, and nothing at all over a real database', async () => {
    const other = await new RraTinAdapter(SAMPLE).verify('123456789');
    const real = await new RraTinAdapter(REAL).verify('998000002');
    expect(other.result === 'verified' && other.business).toBeNull();
    expect(real.result === 'verified' && real.business).toBeNull();
  });
});
