import type { IdentityAdapterMode } from './identity-ports';

/**
 * The population register seam (ADR-060), kept for the public PSF form only.
 *
 * ADR-075 AC-4 took it out of business registration, which now checks identity
 * by ID scan (`DOCUMENT_VERIFIER`). The public PSF form (2026-10-19) has no
 * account and binds an application to the register's phone, so it still asks
 * the register directly. Restored here, in its own file, when origin/main was
 * merged into audric-main (2026-10-29), rather than put back into
 * `identity-ports.ts`, so registration's single-seam shape is left as main has it.
 */
export const IDENTITY_REGISTRY = Symbol('IDENTITY_REGISTRY');

/** The environment variable the seam reads. */
export const REGISTRY_MODE_VARIABLE = 'IDENTITY_REGISTRY_MODE';

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
