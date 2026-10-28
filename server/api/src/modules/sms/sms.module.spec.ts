import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Global, Module, type Type } from '@nestjs/common';
import { Test } from '@nestjs/testing';

import { PLATFORM, type Platform } from '../../shared/config/platform';
import { SMS_PORT, SmsUnavailableError, type SmsPort } from './domain/sms-port';
import { buildSmsAdapter, resolveSmsMode, SmsModule } from './sms.module';

/**
 * The SMS seam's mode (ADR-039), decided once at boot from the platform.
 *
 * The 2026-10-01 demo outage is pinned here. The demo runs NODE_ENV=production
 * over a sample database, and the old rule refused the mock under
 * NODE_ENV=production at FILE LOAD, so the first module to import this seam
 * (UserModule, for the National ID code) kept the demo API from booting.
 */

const SAMPLE = { sampleData: true };
const REAL = { sampleData: false };

describe('resolveSmsMode', () => {
  it('runs the mock over a sample database when unset', () => {
    expect(resolveSmsMode(undefined, true)).toBe('mock');
    expect(resolveSmsMode('  ', true)).toBe('mock');
  });

  it('runs off over a real database when unset, so production boots with no provider', () => {
    expect(resolveSmsMode(undefined, false)).toBe('off');
  });

  it('refuses the mock over a real database', () => {
    expect(() => resolveSmsMode('mock', false)).toThrow(/SMS_MODE=mock is refused/);
  });

  it('reads the mode case and whitespace insensitively, and refuses nonsense', () => {
    expect(resolveSmsMode(' Live ', false)).toBe('live');
    expect(resolveSmsMode('OFF', true)).toBe('off');
    expect(() => resolveSmsMode('maybe', true)).toThrow(/must be "mock", "live" or "off"/);
  });
});

describe('buildSmsAdapter', () => {
  it('refuses to boot on live with no adapter registered', () => {
    expect(() => buildSmsAdapter({ SMS_MODE: 'live' }, SAMPLE)).toThrow(
      /no live SMS adapter is registered/,
    );
  });

  it('binds the mock over a sample database and off over a real one', () => {
    expect(buildSmsAdapter({}, SAMPLE).mode).toBe('mock');
    expect(buildSmsAdapter({}, REAL).mode).toBe('off');
  });

  it('fails every send when off, as an unreachable provider does', async () => {
    await expect(
      buildSmsAdapter({}, REAL).send({ toE164: '+250788123456', body: '123456' }),
    ).rejects.toBeInstanceOf(SmsUnavailableError);
  });
});

describe('SmsModule under NODE_ENV=production', () => {
  const saved = { NODE_ENV: process.env.NODE_ENV, SMS_MODE: process.env.SMS_MODE };

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.SMS_MODE;
  });

  afterEach(() => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  /** Stands in for the global DatabaseModule, which provides `PLATFORM`. */
  function platformModule(platform: Platform): Type<unknown> {
    @Global()
    @Module({
      providers: [{ provide: PLATFORM, useValue: platform }],
      exports: [PLATFORM],
    })
    class FakePlatformModule {}
    return FakePlatformModule;
  }

  async function resolvePort(platform: Platform): Promise<SmsPort> {
    const ref = await Test.createTestingModule({
      imports: [platformModule(platform), SmsModule],
    }).compile();
    return ref.get<SmsPort>(SMS_PORT);
  }

  it('loads without running anything: the file itself never throws', async () => {
    // A fresh load is the thing under test, so the copy imported above must not be reused.
    vi.resetModules();
    await expect(import('./sms.module')).resolves.toHaveProperty('SmsModule');
  });

  it('boots the demo (production NODE_ENV, sample database) on the mock', async () => {
    const port = await resolvePort({ environment: 'demo', sampleData: true, commit: null });
    expect(port.mode).toBe('mock');
  });

  it('boots production (real database, no provider) with SMS off', async () => {
    const port = await resolvePort({ environment: 'production', sampleData: false, commit: null });
    expect(port.mode).toBe('off');
  });
});
