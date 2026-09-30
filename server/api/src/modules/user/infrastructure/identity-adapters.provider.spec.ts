import { RraTinAdapter } from '../../organization/infrastructure/rra-tin.adapter';
import { resolveIdentityMode } from '../domain/identity-ports';
import { buildDocumentVerifier, buildIdentityRegistry } from './identity-adapters.provider';
import { MockDocumentVerifier, MockIdentityRegistry } from './mock-identity-adapters';

/**
 * The identity seams (ADR-060): which side of each runs, decided once at boot,
 * and the demo rules the two mocks promise in `shared/registry/demo-registers.ts`.
 */

const SAMPLE = { sampleData: true };
const REAL = { sampleData: false };

describe('resolveIdentityMode', () => {
  it('runs the mock over a sample database when unset', () => {
    expect(resolveIdentityMode('X', undefined, true)).toBe('mock');
  });

  it('runs off over a real database when unset, so production boots as before', () => {
    expect(resolveIdentityMode('X', undefined, false)).toBe('off');
    expect(resolveIdentityMode('X', '  ', false)).toBe('off');
  });

  it('refuses the mock over a real database, naming the variable', () => {
    expect(() => resolveIdentityMode('IDENTITY_REGISTRY_MODE', 'mock', false)).toThrow(
      /IDENTITY_REGISTRY_MODE=mock is refused/,
    );
  });

  it('reads the mode case and whitespace insensitively, and refuses nonsense', () => {
    expect(resolveIdentityMode('X', ' Live ', false)).toBe('live');
    expect(resolveIdentityMode('X', 'OFF', true)).toBe('off');
    expect(() => resolveIdentityMode('X', 'maybe', true)).toThrow(/must be "mock", "live" or "off"/);
  });
});

describe('building the adapters', () => {
  it('refuses to boot on live with no provider registered, for both seams', () => {
    expect(() => buildIdentityRegistry({ IDENTITY_REGISTRY_MODE: 'live' }, SAMPLE)).toThrow(
      /no live identity registry is registered/,
    );
    expect(() => buildDocumentVerifier({ DOCUMENT_VERIFIER_MODE: 'live' }, REAL)).toThrow(
      /no live document verifier is registered/,
    );
  });

  it('binds the mocks over a sample database and off over a real one', () => {
    expect(buildIdentityRegistry({}, SAMPLE).mode).toBe('mock');
    expect(buildDocumentVerifier({}, SAMPLE).mode).toBe('mock');
    expect(buildIdentityRegistry({}, REAL).mode).toBe('off');
    expect(buildDocumentVerifier({}, REAL).mode).toBe('off');
  });

  it('answers unavailable when off, never a person', async () => {
    const off = buildIdentityRegistry({}, REAL);
    expect((await off.lookupNationalId('1199080123456789')).status).toBe('unavailable');
  });
});

describe('MockIdentityRegistry', () => {
  const registry = new MockIdentityRegistry();

  it('finds a demo register person by their number', async () => {
    const found = await registry.lookupNationalId('1198870034567812');
    expect(found).toMatchObject({
      status: 'found',
      generated: true,
      person: { fullName: 'Aline Uwase', gender: 'female', dateOfBirth: '1988-07-21' },
    });
  });

  it('invents anyone else from the number: its birth year and gender marker, the same every time', async () => {
    const first = await registry.lookupNationalId('1197580099887766');
    const again = await registry.lookupNationalId('1197580099887766');
    expect(first).toEqual(again);
    expect(first.status).toBe('found');
    if (first.status !== 'found') return;
    expect(first.person.dateOfBirth.startsWith('1975-')).toBe(true);
    expect(first.person.gender).toBe('male');
    expect(first.person.phoneE164).toMatch(/^\+25078\d{7}$/);
  });

  it('does not find a number whose sequence is all zeros', async () => {
    expect((await registry.lookupNationalId('1199080000000012')).status).toBe('not_found');
  });

  it('finds a number whose sequence is all ones, with no phone to bind', async () => {
    const found = await registry.lookupNationalId('1199081111111012');
    expect(found.status === 'found' && found.person.phoneE164).toBeNull();
  });
});

describe('MockDocumentVerifier', () => {
  const verifier = new MockDocumentVerifier();
  const photo = (fill: number, size = 4096): { mime: string; bytes: Buffer } => ({
    mime: 'image/jpeg',
    bytes: Buffer.alloc(size, fill),
  });

  it('calls an image too small to be a photo unreadable', async () => {
    expect(await verifier.verifyPassport({ document: photo(1, 100), selfie: photo(2) })).toEqual({
      status: 'rejected',
      reason: 'unreadable',
    });
  });

  it('calls a selfie that is the passport photo itself a face mismatch', async () => {
    expect(await verifier.verifyPassport({ document: photo(1), selfie: photo(1) })).toEqual({
      status: 'rejected',
      reason: 'face_mismatch',
    });
  });

  it('verifies two different photos, the same holder for the same page every time', async () => {
    const first = await verifier.verifyPassport({ document: photo(3), selfie: photo(4) });
    const again = await verifier.verifyPassport({ document: photo(3), selfie: photo(5) });
    expect(first.status).toBe('verified');
    expect(first).toEqual(again);
    if (first.status !== 'verified') return;
    expect(first.holder.documentNumber).toMatch(/^P\d{8}$/);
    expect(first.generated).toBe(true);
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
