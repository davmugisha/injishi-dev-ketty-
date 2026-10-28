import { describe, expect, it } from 'vitest';

import { getQueueToken } from '@nestjs/bullmq';
import { Global, Injectable, Module, type Provider } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomBytes } from 'node:crypto';

import { PLATFORM } from '../../shared/config/platform';
import { DRIZZLE } from '../../shared/database/database.module';
import { QUEUES } from '../../shared/queues/queues.module';
import { EbmReceiptService } from './application/ebm-receipt.service';
import { EbmSaleTrigger } from './application/ebm-sale-trigger.service';
import { EBM_LIVE } from './domain/ebm-live';
import { VSDC_PORT, type VsdcPort } from './domain/vsdc-port';
import { EbmModule, buildEbmProviders } from './ebm.module';
import { EbmEmissionProcessor } from './infrastructure/ebm-emission.processor';
import { LiveVsdcSigner } from './infrastructure/live-vsdc.signer';
import { MockVsdcSigner } from './infrastructure/mock-vsdc.signer';

/**
 * The receipt route lives on `BookingsController`, which `PublicApiModule`
 * registers — a module that does NOT import `EbmModule`. The only reason that
 * resolves is that `EbmModule` is `@Global`, and a Nest wiring mistake of this
 * kind does not fail a typecheck or a unit test: it fails at boot, on a
 * container nobody is watching, with a "can't resolve dependencies" that names
 * a controller rather than the module that stopped being global.
 *
 * So the structure is pinned here rather than assumed — and so is the boot
 * refusal for a live mode that cannot keep its promise.
 */
describe('EbmModule', () => {
  /** Stands in for the `@Global` DatabaseModule and QueuesModule it injects. */
  @Global()
  @Module({
    providers: [
      { provide: DRIZZLE, useValue: {} },
      { provide: PLATFORM, useValue: { environment: 'production', sampleData: false } },
      { provide: getQueueToken(QUEUES.ebmEmission), useValue: { add: async () => ({}) } },
    ],
    exports: [DRIZZLE, PLATFORM, getQueueToken(QUEUES.ebmEmission)],
  })
  class FakeInfrastructureModule {}

  /** A consumer in a module that deliberately does not import EbmModule. */
  @Injectable()
  class SomeController {
    constructor(
      readonly receipts: EbmReceiptService,
      readonly trigger: EbmSaleTrigger,
    ) {}
  }

  @Module({ providers: [SomeController] })
  class UnrelatedModule {}

  const LIVE_ENV = {
    VSDC_ADAPTER_MODE: 'live',
    EBM_API_BASE_URL: 'https://test-ebm-api.injishi.com',
    EBM_OAUTH_CLIENT_ID: 'client',
    EBM_OAUTH_CLIENT_SECRET: 'secret',
    EBM_OAUTH_REDIRECT_URI: 'http://localhost:8000/api/v1/ebm/oauth/callback',
    EBM_TOKEN_ENCRYPTION_KEY: randomBytes(32).toString('base64'),
    EBM_CONNECT_RETURN_URL: 'http://localhost:3002/settings/ebm',
    EBM_LIVE_SINCE: '2026-09-11T00:00:00+02:00',
  };

  function bound(providers: Provider[], token: string): Provider | undefined {
    return providers.find(
      (p) => typeof p === 'object' && 'provide' in p && p.provide === token,
    );
  }

  it('reaches a consumer that never imported it', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeInfrastructureModule, EbmModule, UnrelatedModule],
    }).compile();

    expect(moduleRef.get(SomeController).receipts).toBeInstanceOf(EbmReceiptService);
    expect(moduleRef.get(SomeController).trigger).toBeInstanceOf(EbmSaleTrigger);
  });

  it('binds a VSDC that declares itself a mock by default', async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [FakeInfrastructureModule, EbmModule],
    }).compile();

    // The one thing about this seam a reader must never have to guess.
    expect(moduleRef.get<VsdcPort>(VSDC_PORT).mode).toBe('mock');
    expect(moduleRef.get(EBM_LIVE)).toBeNull();
  });

  it('refuses live mode without EBM configuration', () => {
    expect(() => buildEbmProviders({ VSDC_ADAPTER_MODE: 'live' }, false)).toThrow(
      /VSDC_ADAPTER_MODE=live needs EBM_API_BASE_URL, EBM_OAUTH_CLIENT_ID/,
    );
    const noKey: Record<string, string | undefined> = { ...LIVE_ENV, EBM_TOKEN_ENCRYPTION_KEY: undefined };
    expect(() => buildEbmProviders(noKey, false)).toThrow(/EBM_TOKEN_ENCRYPTION_KEY/);
  });

  it('refuses live mode with a key that is not 32 bytes, or a provider over plain http', () => {
    expect(() =>
      buildEbmProviders({ ...LIVE_ENV, EBM_TOKEN_ENCRYPTION_KEY: 'hunter2' }, false),
    ).toThrow(/32 bytes/);
    expect(() =>
      buildEbmProviders({ ...LIVE_ENV, EBM_API_BASE_URL: 'http://test-ebm-api.injishi.com' }, false),
    ).toThrow(/must be https/);
    expect(() =>
      buildEbmProviders({ ...LIVE_ENV, EBM_LIVE_SINCE: 'yesterday' }, false),
    ).toThrow(/EBM_LIVE_SINCE/);
  });

  it('refuses a mode it cannot read rather than falling back to mock', () => {
    expect(() => buildEbmProviders({ VSDC_ADAPTER_MODE: 'Live-ish' }, false)).toThrow(
      /must be "mock" or "live"/,
    );
  });

  it('boots live mode with EBM configuration', () => {
    const providers = buildEbmProviders(LIVE_ENV, false);
    expect(bound(providers, VSDC_PORT)).toMatchObject({ useClass: LiveVsdcSigner });
    const live = bound(providers, EBM_LIVE) as { useValue: { config: { liveSince: Date } } };
    expect(live.useValue.config.liveSince.toISOString()).toBe('2026-09-10T22:00:00.000Z');
    // The HTTP process never runs the worker.
    expect(providers).not.toContain(EbmEmissionProcessor);
  });

  it('runs the emission worker only in a live worker process', () => {
    expect(buildEbmProviders(LIVE_ENV, true)).toContain(EbmEmissionProcessor);
    expect(buildEbmProviders({ VSDC_ADAPTER_MODE: 'mock' }, true)).not.toContain(
      EbmEmissionProcessor,
    );
    expect(bound(buildEbmProviders({}, false), VSDC_PORT)).toMatchObject({ useClass: MockVsdcSigner });
  });
});
