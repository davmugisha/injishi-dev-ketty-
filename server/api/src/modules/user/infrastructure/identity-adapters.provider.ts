import { Logger, type Provider } from '@nestjs/common';

import { PLATFORM, type Platform } from '../../../shared/config/platform';
import {
  DOCUMENT_VERIFIER,
  IDENTITY_REGISTRY,
  MODE_VARIABLE,
  resolveIdentityMode,
  type DocumentVerifierPort,
  type IdentityRegistryPort,
} from '../domain/identity-ports';
import {
  MockDocumentVerifier,
  MockIdentityRegistry,
  OffDocumentVerifier,
  OffIdentityRegistry,
} from './mock-identity-adapters';

/**
 * The live adapters, once a provider is signed (ADR-060 D1, D2). Null until
 * then, and `live` refuses to boot, as `RRA_TIN_ADAPTER_MODE` and `SMS_MODE`
 * do: a deployment that says it verifies identities must actually be able to.
 */
const LIVE_REGISTRY: (new () => IdentityRegistryPort) | null = null;
const LIVE_DOCUMENT_VERIFIER: (new () => DocumentVerifierPort) | null = null;

const log = new Logger('IdentityModule');

/**
 * Build one seam's adapter from its mode. Exported for the spec, which checks
 * every branch without booting a module.
 */
export function buildIdentityRegistry(
  env: NodeJS.ProcessEnv,
  platform: Pick<Platform, 'sampleData'>,
): IdentityRegistryPort {
  const variable = MODE_VARIABLE.registry;
  const mode = resolveIdentityMode(variable, env[variable], platform.sampleData);
  if (mode === 'live') {
    if (!LIVE_REGISTRY) {
      throw new Error(
        `${variable}=live but no live identity registry is registered. Register ` +
          'one in identity-adapters.provider.ts, or run with "off".',
      );
    }
    log.log('Identity registry: live');
    return new LIVE_REGISTRY();
  }
  if (mode === 'mock') {
    log.warn('Identity registry: mock. National IDs resolve to made-up people (sample database only).');
    return new MockIdentityRegistry();
  }
  log.log('Identity registry: off. National ID lookup is unavailable and not required.');
  return new OffIdentityRegistry();
}

export function buildDocumentVerifier(
  env: NodeJS.ProcessEnv,
  platform: Pick<Platform, 'sampleData'>,
): DocumentVerifierPort {
  const variable = MODE_VARIABLE.documents;
  const mode = resolveIdentityMode(variable, env[variable], platform.sampleData);
  if (mode === 'live') {
    if (!LIVE_DOCUMENT_VERIFIER) {
      throw new Error(
        `${variable}=live but no live document verifier is registered. Register ` +
          'one in identity-adapters.provider.ts, or run with "off".',
      );
    }
    log.log('Document verifier: live');
    return new LIVE_DOCUMENT_VERIFIER();
  }
  if (mode === 'mock') {
    log.warn('Document verifier: mock. Passports are not read; holders are made up (sample database only).');
    return new MockDocumentVerifier();
  }
  log.log('Document verifier: off. Passport scanning is unavailable and not required.');
  return new OffDocumentVerifier();
}

export const identityAdapterProviders: Provider[] = [
  {
    provide: IDENTITY_REGISTRY,
    inject: [PLATFORM],
    useFactory: (platform: Platform) => buildIdentityRegistry(process.env, platform),
  },
  {
    provide: DOCUMENT_VERIFIER,
    inject: [PLATFORM],
    useFactory: (platform: Platform) => buildDocumentVerifier(process.env, platform),
  },
];
