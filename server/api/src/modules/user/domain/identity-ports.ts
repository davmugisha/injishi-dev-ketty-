/**
 * The document verifier seam (ADR-060, made the only identity seam by ADR-075):
 * one port, a mock that is honest about being one, and a live side that refuses
 * to boot until a provider is registered, in the style of the RRA TIN and SMS
 * seams.
 *
 * It answers "is this document genuine, what does it say, and is this selfie
 * its holder?", for the front of a Rwandan National ID and a passport's photo
 * page alike (O-4). Sumsub, Persona or Smile ID would sit behind it; none is
 * chosen (ADR-075 D-a), and where the seam is `off` the scan keeps the photos
 * for the PSF officer to compare by eye (O-6).
 *
 * The population register seam, and the SMS code it sent to the register's
 * phone, went with ADR-075 AC-4: no code is sent to any phone during
 * registration.
 */

export type IdentityAdapterMode = 'mock' | 'live' | 'off';

export const DOCUMENT_VERIFIER = Symbol('DOCUMENT_VERIFIER');

export interface DocumentImage {
  mime: string | null;
  bytes: Buffer;
}

export interface DocumentHolder {
  fullName: string;
  /** `YYYY-MM-DD`. */
  dateOfBirth: string;
  gender: 'female' | 'male' | null;
  documentNumber: string;
  /** ISO-3166-1 alpha-2. `RW` for a National ID. */
  issuingCountry: string;
  /** `YYYY-MM-DD`, or null for a document printed with no expiry. */
  expiresOn: string | null;
}

export type DocumentCheck =
  | { status: 'verified'; holder: DocumentHolder; generated: boolean }
  | {
      status: 'rejected';
      reason: 'not_authentic' | 'face_mismatch' | 'unreadable' | 'expired';
    }
  | { status: 'unavailable' };

export interface DocumentVerifierPort {
  readonly mode: IdentityAdapterMode;
  verifyDocument(input: {
    documentType: 'national_id' | 'passport';
    /** The front of the card, or the passport's photo page. */
    front: DocumentImage;
    selfie: DocumentImage;
  }): Promise<DocumentCheck>;
}

/** The environment variable the seam reads. */
export const MODE_VARIABLE = 'DOCUMENT_VERIFIER_MODE';

/**
 * The mode the seam runs in, decided ONCE at boot from its variable and from
 * what the database is (ADR-043's sample marker).
 *
 * - Unset: `mock` over a sample database, `off` over a real one. So every
 *   laptop and the demo verify against made-up people, and production keeps
 *   the photos for PSF and reads nothing.
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
