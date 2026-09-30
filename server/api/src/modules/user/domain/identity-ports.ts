/**
 * The two identity seams (ADR-060), in the style of the RRA TIN and SMS seams:
 * one port each, a mock that is honest about being one, and a live side that
 * refuses to boot until a provider is registered.
 *
 * - The REGISTRY answers "who holds this National ID, and on what phone?" —
 *   NIDA directly, or through Irembo or a KYC provider that reaches it.
 * - The DOCUMENT VERIFIER answers "is this passport genuine, what does it say,
 *   and is this selfie its holder?" — Sumsub, Persona or Smile ID.
 *
 * Neither is chosen yet. That choice, and the agreements behind it, are the
 * owner's (ADR-060 D1, D2); the seams are what lets the product be built and
 * demonstrated against mocks while it is made.
 */

export type IdentityAdapterMode = 'mock' | 'live' | 'off';

export const IDENTITY_REGISTRY = Symbol('IDENTITY_REGISTRY');
export const DOCUMENT_VERIFIER = Symbol('DOCUMENT_VERIFIER');

export interface RegistryPerson {
  fullName: string;
  /** `YYYY-MM-DD`. */
  dateOfBirth: string;
  gender: 'female' | 'male' | null;
  /** The phone the register holds, E.164. Null when it holds none. */
  phoneE164: string | null;
}

export type RegistryLookup =
  | { status: 'found'; person: RegistryPerson; generated: boolean }
  | { status: 'not_found' }
  | { status: 'unavailable' };

export interface IdentityRegistryPort {
  readonly mode: IdentityAdapterMode;
  lookupNationalId(documentNumber: string): Promise<RegistryLookup>;
}

export interface DocumentImage {
  mime: string | null;
  bytes: Buffer;
}

export interface PassportHolder {
  fullName: string;
  dateOfBirth: string;
  gender: 'female' | 'male' | null;
  documentNumber: string;
  /** ISO-3166-1 alpha-2. */
  issuingCountry: string;
  /** `YYYY-MM-DD`. */
  expiresOn: string;
}

export type DocumentCheck =
  | { status: 'verified'; holder: PassportHolder; generated: boolean }
  | {
      status: 'rejected';
      reason: 'not_authentic' | 'face_mismatch' | 'unreadable' | 'expired';
    }
  | { status: 'unavailable' };

export interface DocumentVerifierPort {
  readonly mode: IdentityAdapterMode;
  verifyPassport(input: {
    document: DocumentImage;
    selfie: DocumentImage;
  }): Promise<DocumentCheck>;
}

/** The environment variable each seam reads. */
export const MODE_VARIABLE = {
  registry: 'IDENTITY_REGISTRY_MODE',
  documents: 'DOCUMENT_VERIFIER_MODE',
} as const;

/**
 * The mode a seam runs in, decided ONCE at boot from its variable and from what
 * the database is (ADR-043's sample marker).
 *
 * - Unset: `mock` over a sample database, `off` over a real one. So every
 *   laptop and the demo verify against made-up people, and production boots
 *   exactly as it did before this seam existed.
 * - `mock` over a REAL database is refused. A mock that "verifies" people it
 *   invented would put invented identities on real accounts; that is the same
 *   failure as mock money on a real database (ADR-051), refused the same way.
 * - Anything unreadable is refused rather than defaulted, as `SMS_MODE` does:
 *   `Live ` quietly becoming `off` is a deployment believing it verifies.
 */
export function resolveIdentityMode(
  variable: string,
  raw: string | undefined,
  sampleData: boolean,
): IdentityAdapterMode {
  const value = (raw ?? '').trim().toLowerCase();
  if (value === '') return sampleData ? 'mock' : 'off';
  if (value !== 'mock' && value !== 'live' && value !== 'off') {
    throw new Error(`${variable} must be "mock", "live" or "off", got "${value}".`);
  }
  if (value === 'mock' && !sampleData) {
    throw new Error(
      `${variable}=mock is refused over a database without the sample marker: ` +
        'the mock verifies people it made up. Run "off" until a live provider ' +
        'is registered, or run over a sample database.',
    );
  }
  return value;
}
