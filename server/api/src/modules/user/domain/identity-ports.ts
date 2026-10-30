/**
 * The two identity seams.
 *
 * - The DOCUMENT VERIFIER (ADR-060, the only identity seam under ADR-075):
 *   "is this document genuine, what does it say, and is this selfie its
 *   holder?" for a passport's photo page, or the front of a National ID card
 *   where the registry below is off. Smile ID sits behind it (job type 6).
 *
 * - The NATIONAL ID REGISTRY (2026-10-30, the owner's call): a Rwandan
 *   National ID is checked by its NUMBER against NIDA's population register,
 *   through GTBank's NIDA gateway, with the holder's selfie: "does this number
 *   exist, who holds it, and is this selfie them?". It replaces the card scan
 *   for National IDs wherever it runs; where it is `off` the card scan stays.
 *
 * Each has a mock that is honest about being one, a `sandbox` that runs the
 * real HTTP adapter against Injishi Mock APIs (`server/mock-apis`), and a live
 * side that refuses to boot until a provider is registered, in the style of
 * the RRA TIN and SMS seams. No code is sent to any phone (ADR-075 AC-4).
 */

export type IdentityAdapterMode = 'mock' | 'sandbox' | 'live' | 'off';

export const DOCUMENT_VERIFIER = Symbol('DOCUMENT_VERIFIER');
export const NATIONAL_ID_REGISTRY = Symbol('NATIONAL_ID_REGISTRY');

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
    /** Where the document was issued, when the person said: a passport's country. `RW` for a National ID. */
    issuingCountry?: string | null;
  }): Promise<DocumentCheck>;
}

/**
 * What the population register said about a number and a selfie.
 *
 * `face` is `not_checked` when the gateway returned the record but compared
 * no face: the identity is then held `pending` with the register's details,
 * and the PSF officer compares the selfie before approving (ADR-075 O-6).
 */
export type NationalIdCheck =
  | { status: 'verified'; holder: DocumentHolder; face: 'match' | 'not_checked'; generated: boolean }
  | { status: 'rejected'; reason: 'not_found' | 'revoked' | 'face_mismatch' | 'unreadable' }
  | { status: 'unavailable' };

export interface NationalIdRegistryPort {
  readonly mode: IdentityAdapterMode;
  verify(input: {
    /** Sixteen digits. */
    documentNumber: string;
    selfie: DocumentImage;
    /** Ours, unique per try, so a provider can tell a retry from a new check. */
    reference: string;
  }): Promise<NationalIdCheck>;
}

/** The environment variables the seams read. */
export const MODE_VARIABLE = 'DOCUMENT_VERIFIER_MODE';
export const NIDA_MODE_VARIABLE = 'NIDA_ADAPTER_MODE';

/**
 * A seam's mode, decided ONCE at boot from its variable and from what the
 * database is (ADR-043's sample marker).
 *
 * - Unset: `mock` over a sample database, `off` over a real one. So every
 *   laptop and the demo verify against made-up people, and production keeps
 *   the photos for PSF and reads nothing.
 * - `mock` or `sandbox` over a REAL database is refused. Both answer from
 *   people somebody invented, and invented identities on real accounts are the
 *   same failure as mock money on a real database (ADR-051), refused the same
 *   way.
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
  if (value !== 'mock' && value !== 'sandbox' && value !== 'live' && value !== 'off') {
    throw new Error(`${variable} must be "mock", "sandbox", "live" or "off", got "${value}".`);
  }
  if ((value === 'mock' || value === 'sandbox') && !sampleData) {
    throw new Error(
      `${variable}=${value} is refused over a database without the sample marker: ` +
        `the ${value === 'mock' ? 'mock verifies people it made up' : 'sandbox answers from Injishi Mock APIs’ invented registers'}. ` +
        'Run "off" until a live provider is registered, or run over a sample database.',
    );
  }
  return value;
}
