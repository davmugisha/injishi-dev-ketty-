import { Logger, type Provider } from '@nestjs/common';

import { PLATFORM, type Platform } from '../../../shared/config/platform';
import {
  DOCUMENT_VERIFIER,
  MODE_VARIABLE,
  resolveIdentityMode,
  type DocumentVerifierPort,
} from '../domain/identity-ports';
import { MockDocumentVerifier, OffDocumentVerifier } from './mock-identity-adapters';

/**
 * The live adapter, once a provider is signed (ADR-060 D2, ADR-075 D-a). Null
 * until then, and `live` refuses to boot, as `RRA_TIN_ADAPTER_MODE` and
 * `SMS_MODE` do: a deployment that says it verifies identities must actually
 * be able to.
 */
const LIVE_DOCUMENT_VERIFIER: (new () => DocumentVerifierPort) | null = null;

const log = new Logger('IdentityModule');

/**
 * Build the seam's adapter from its mode. Exported for the spec, which checks
 * every branch without booting a module.
 */
export function buildDocumentVerifier(
  env: NodeJS.ProcessEnv,
  platform: Pick<Platform, 'sampleData'>,
): DocumentVerifierPort {
  const mode = resolveIdentityMode(MODE_VARIABLE, env[MODE_VARIABLE], platform.sampleData);
  if (mode === 'live') {
    if (!LIVE_DOCUMENT_VERIFIER) {
      throw new Error(
        `${MODE_VARIABLE}=live but no live document verifier is registered. Register ` +
          'one in identity-adapters.provider.ts, or run with "off".',
      );
    }
    log.log('Document verifier: live');
    return new LIVE_DOCUMENT_VERIFIER();
  }
  if (mode === 'mock') {
    log.warn('Document verifier: mock. ID photos are not read; holders are made up (sample database only).');
    return new MockDocumentVerifier();
  }
  log.log('Document verifier: off. ID scans keep the photos for PSF and read nothing.');
  return new OffDocumentVerifier();
}

export const identityAdapterProviders: Provider[] = [
  {
    provide: DOCUMENT_VERIFIER,
    inject: [PLATFORM],
    useFactory: (platform: Platform) => buildDocumentVerifier(process.env, platform),
  },
];
