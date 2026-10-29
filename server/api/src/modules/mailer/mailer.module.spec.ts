import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { Global, Logger, Module, type Type } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test } from '@nestjs/testing';

import { MAILER_PORT } from './domain/mailer-port';
import {
  SmtpMailerAdapter,
  UnconfiguredMailerAdapter,
} from './infrastructure/smtp-mailer.adapter';
import {
  createMailer,
  DEFAULT_MAIL_FROM,
  MailerModule,
  resolveMailerConfig,
} from './mailer.module';

/**
 * The transport is chosen once, at boot, from `SMTP_URL`. What is pinned here
 * is the choice itself, the production refusal, and that no refusal or boot
 * line ever repeats the relay's password.
 */

const PASSWORD = 'hunter2-relay-password';
const RELAY = `smtps://mailer:${PASSWORD}@relay.example.com:465`;

beforeEach(() => {
  vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
});
afterEach(() => vi.restoreAllMocks());

describe('resolveMailerConfig · transport choice', () => {
  it('chooses SMTP when SMTP_URL is set', () => {
    const config = resolveMailerConfig({
      smtpUrl: 'smtp://mailpit:1025',
      nodeEnv: 'development',
    });
    expect(config).toEqual({
      transport: 'smtp',
      smtpUrl: 'smtp://mailpit:1025',
      target: 'smtp://mailpit:1025',
      from: DEFAULT_MAIL_FROM,
    });
  });

  it('describes a credentialed relay without its credentials', () => {
    const config = resolveMailerConfig({ smtpUrl: RELAY, nodeEnv: 'production' });
    expect(config.transport).toBe('smtp');
    if (config.transport !== 'smtp') return;
    expect(config.target).toBe('smtps://relay.example.com:465');
    expect(config.target).not.toContain(PASSWORD);
    expect(config.target).not.toContain('mailer');
  });

  it('defaults the sender and honours MAIL_FROM', () => {
    expect(DEFAULT_MAIL_FROM).toBe('Injishi <no-reply@injishi.com>');
    expect(
      resolveMailerConfig({ smtpUrl: RELAY, mailFrom: '   ' }).from,
    ).toBe(DEFAULT_MAIL_FROM);
    expect(
      resolveMailerConfig({ smtpUrl: RELAY, mailFrom: 'Ops <ops@injishi.com>' })
        .from,
    ).toBe('Ops <ops@injishi.com>');
  });

  it.each([undefined, '', '   '])(
    'falls back to the unconfigured adapter outside production (SMTP_URL=%p)',
    (smtpUrl) => {
      for (const nodeEnv of [undefined, 'development', 'test']) {
        expect(resolveMailerConfig({ smtpUrl, nodeEnv }).transport).toBe(
          'unconfigured',
        );
      }
    },
  );
});

describe('resolveMailerConfig · refusals', () => {
  it.each([undefined, '', '   '])(
    'refuses to boot in production without SMTP_URL (%p)',
    (smtpUrl) => {
      expect(() =>
        resolveMailerConfig({ smtpUrl, nodeEnv: 'production' }),
      ).toThrow(/SMTP_URL is required when NODE_ENV=production/);
    },
  );

  it.each([
    ['an unparsable url', `smtp://mailer:${PASSWORD}@relay.example.com:99999`],
    ['another scheme', `https://mailer:${PASSWORD}@relay.example.com`],
    ['an overridden greeting bound', `${RELAY}?greetingTimeout=600000`],
    ['an overridden socket bound', `${RELAY}?SocketTimeout=600000`],
  ])('refuses %s without quoting the password', (_label, smtpUrl) => {
    let message = '';
    try {
      resolveMailerConfig({ smtpUrl, nodeEnv: 'development' });
    } catch (error) {
      message = (error as Error).message;
    }
    expect(message).toMatch(/SMTP_URL/);
    expect(message).not.toContain(PASSWORD);
  });

  it('allows query options that are not a bound', () => {
    expect(
      resolveMailerConfig({ smtpUrl: `${RELAY}?name=api.injishi.com` })
        .transport,
    ).toBe('smtp');
  });

  it('refuses a MAIL_FROM that would inject a header', () => {
    expect(() =>
      resolveMailerConfig({
        smtpUrl: RELAY,
        mailFrom: 'Injishi <no-reply@injishi.com>\r\nBcc: all@example.com',
      }),
    ).toThrow(/MAIL_FROM must be a single line/);
  });
});

describe('createMailer', () => {
  it('builds the SMTP adapter and logs the target, never the password', () => {
    const log = vi.spyOn(Logger.prototype, 'log');
    const mailer = createMailer({ smtpUrl: RELAY, nodeEnv: 'production' });
    expect(mailer).toBeInstanceOf(SmtpMailerAdapter);
    const lines = log.mock.calls.map((call) => String(call[0])).join('\n');
    expect(lines).toContain('smtps://relay.example.com:465');
    expect(lines).not.toContain(PASSWORD);
  });

  it('builds an adapter that rejects every send when unconfigured', async () => {
    const mailer = createMailer({ nodeEnv: 'development' });
    expect(mailer).toBeInstanceOf(UnconfiguredMailerAdapter);
    await expect(
      mailer.send({ to: 'a@example.com', subject: 's', text: 't' }),
    ).rejects.toThrow('SMTP_URL is not set');
  });
});

describe('MailerModule · boot', () => {
  function withEnv(env: Record<string, string | undefined>): Type<unknown> {
    @Global()
    @Module({
      providers: [
        {
          provide: ConfigService,
          useValue: { get: (key: string) => env[key] },
        },
      ],
      exports: [ConfigService],
    })
    class FakeConfigModule {}
    return FakeConfigModule;
  }

  async function boot(env: Record<string, string | undefined>): Promise<unknown> {
    const moduleRef = await Test.createTestingModule({
      imports: [withEnv(env), MailerModule],
    }).compile();
    const port = moduleRef.get(MAILER_PORT);
    await moduleRef.close();
    return port;
  }

  it('provides the SMTP adapter when SMTP_URL is set', async () => {
    await expect(
      boot({ NODE_ENV: 'production', SMTP_URL: 'smtp://mailpit:1025' }),
    ).resolves.toBeInstanceOf(SmtpMailerAdapter);
  });

  it('provides the unconfigured adapter in development without SMTP_URL', async () => {
    await expect(boot({ NODE_ENV: 'development' })).resolves.toBeInstanceOf(
      UnconfiguredMailerAdapter,
    );
  });

  it('refuses to boot in production without SMTP_URL', async () => {
    await expect(boot({ NODE_ENV: 'production' })).rejects.toThrow(
      /SMTP_URL is required when NODE_ENV=production/,
    );
  });
});
