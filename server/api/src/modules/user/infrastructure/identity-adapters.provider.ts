import { Logger, type Provider } from '@nestjs/common';

import { resolveMockApis } from '../../../shared/config/mock-apis';
import { PLATFORM, type Platform } from '../../../shared/config/platform';
import {
  DOCUMENT_VERIFIER,
  MODE_VARIABLE,
  NATIONAL_ID_REGISTRY,
  NIDA_MODE_VARIABLE,
  resolveIdentityMode,
  type DocumentVerifierPort,
  type NationalIdRegistryPort,
} from '../domain/identity-ports';
import { GtbankNidaRegistry } from './gtbank-nida.registry';
import {
  MockDocumentVerifier,
  MockNationalIdRegistry,
  OffDocumentVerifier,
  OffNationalIdRegistry,
} from './mock-identity-adapters';
import { SmileIdDocumentVerifier } from './smile-id-document.verifier';

/**
 * The live adapters, once each provider is signed (ADR-060 D2, ADR-075 D-a,
 * and the owner's 2026-10-30 call: NIDA through GTBank for National IDs, Smile
 * ID for passports). Null until then, and `live` refuses to boot, as
 * `RRA_TIN_ADAPTER_MODE` and `SMS_MODE` do: a deployment that says it verifies
 * identities must actually be able to.
 *
 * Each live adapter is the class `sandbox` already runs (`SmileIdDocumentVerifier`,
 * `GtbankNidaRegistry`), given the provider's base URL and credentials once its
 * document has confirmed the mapping. Registering it is one line here.
 */
const LIVE_DOCUMENT_VERIFIER: (() => DocumentVerifierPort) | null = null;
const LIVE_NATIONAL_ID_REGISTRY: (() => NationalIdRegistryPort) | null = null;

const log = new Logger('IdentityModule');

/**
 * Build the document verifier from its mode. Exported for the spec, which
 * checks every branch without booting a module.
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
    return LIVE_DOCUMENT_VERIFIER();
  }
  if (mode === 'sandbox') {
    const endpoint = resolveMockApis(env);
    log.warn(`Document verifier: sandbox, Smile ID on Injishi Mock APIs at ${endpoint.url} (sample database only).`);
    return new SmileIdDocumentVerifier({
      mode: 'sandbox',
      baseUrl: `${endpoint.url}/smile-id`,
      partnerId: endpoint.credentials.smileId.partnerId,
      apiKey: endpoint.credentials.smileId.apiKey,
      timeoutMs: 15_000,
      pollTimeoutMs: 20_000,
      pollIntervalMs: 750,
    });
  }
  if (mode === 'mock') {
    log.warn('Document verifier: mock. ID photos are not read; holders are made up (sample database only).');
    return new MockDocumentVerifier();
  }
  log.log('Document verifier: off. ID scans keep the photos for PSF and read nothing.');
  return new OffDocumentVerifier();
}

/** Build the National ID registry from its mode, by the same rules. */
export function buildNationalIdRegistry(
  env: NodeJS.ProcessEnv,
  platform: Pick<Platform, 'sampleData'>,
): NationalIdRegistryPort {
  const mode = resolveIdentityMode(NIDA_MODE_VARIABLE, env[NIDA_MODE_VARIABLE], platform.sampleData);
  if (mode === 'live') {
    if (!LIVE_NATIONAL_ID_REGISTRY) {
      throw new Error(
        `${NIDA_MODE_VARIABLE}=live but no live National ID registry is registered. Register ` +
          'one in identity-adapters.provider.ts, or run with "off".',
      );
    }
    log.log('National ID registry: live');
    return LIVE_NATIONAL_ID_REGISTRY();
  }
  if (mode === 'sandbox') {
    const endpoint = resolveMockApis(env);
    log.warn(`National ID registry: sandbox, GTBank NIDA on Injishi Mock APIs at ${endpoint.url} (sample database only).`);
    return new GtbankNidaRegistry({
      mode: 'sandbox',
      baseUrl: `${endpoint.url}/gtbank`,
      clientId: endpoint.credentials.gtbank.clientId,
      clientSecret: endpoint.credentials.gtbank.clientSecret,
      timeoutMs: 15_000,
    });
  }
  if (mode === 'mock') {
    log.warn('National ID registry: mock. Numbers are looked up in the demo register (sample database only).');
    return new MockNationalIdRegistry();
  }
  log.log('National ID registry: off. A National ID is checked by scanning the card.');
  return new OffNationalIdRegistry();
}

export const identityAdapterProviders: Provider[] = [
  {
    provide: DOCUMENT_VERIFIER,
    inject: [PLATFORM],
    useFactory: (platform: Platform) => buildDocumentVerifier(process.env, platform),
  },
  {
    provide: NATIONAL_ID_REGISTRY,
    inject: [PLATFORM],
    useFactory: (platform: Platform) => buildNationalIdRegistry(process.env, platform),
  },
];
