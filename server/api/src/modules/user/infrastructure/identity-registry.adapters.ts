import { Injectable, Logger, type Provider } from '@nestjs/common';

import { PLATFORM, type Platform } from '../../../shared/config/platform';
import { registerPerson } from '../../../shared/registry/demo-registers';
import { resolveIdentityMode, type IdentityAdapterMode } from '../domain/identity-ports';
import {
  IDENTITY_REGISTRY,
  REGISTRY_MODE_VARIABLE,
  type IdentityRegistryPort,
  type RegistryLookup,
} from '../domain/identity-registry-port';

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

/** The seam switched off: every lookup is unavailable, and nothing is enforced. */
export class OffIdentityRegistry implements IdentityRegistryPort {
  readonly mode: IdentityAdapterMode = 'off';
  async lookupNationalId(): Promise<RegistryLookup> {
    return { status: 'unavailable' };
  }
}

/** No live provider is chosen yet (ADR-060 D1). */
const LIVE_REGISTRY: (new () => IdentityRegistryPort) | null = null;

const log = new Logger('IdentityModule');

export function buildIdentityRegistry(
  env: NodeJS.ProcessEnv,
  platform: Pick<Platform, 'sampleData'>,
): IdentityRegistryPort {
  const variable = REGISTRY_MODE_VARIABLE;
  const mode = resolveIdentityMode(variable, env[variable], platform.sampleData);
  if (mode === 'live') {
    if (!LIVE_REGISTRY) {
      throw new Error(
        `${variable}=live but no live identity registry is registered. Register ` +
          'one in identity-registry.adapters.ts, or run with "off".',
      );
    }
    log.log('Identity registry: live');
    return new LIVE_REGISTRY();
  }
  if (mode === 'mock') {
    log.warn('Identity registry: mock. National IDs resolve to made-up people (sample database only).');
    return new MockIdentityRegistry();
  }
  log.log('Identity registry: off. The public PSF form cannot look up a National ID.');
  return new OffIdentityRegistry();
}

export const identityRegistryProvider: Provider = {
  provide: IDENTITY_REGISTRY,
  inject: [PLATFORM],
  useFactory: (platform: Platform) => buildIdentityRegistry(process.env, platform),
};
