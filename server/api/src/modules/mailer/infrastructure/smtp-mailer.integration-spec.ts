import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { randomInt } from 'node:crypto';
import { createServer, type Server, type Socket } from 'node:net';

import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import { OtpMailer } from '../../auth/infrastructure/otp-mailer';
import { createMailer } from '../mailer.module';
import { SMTP_TIMEOUTS, SmtpMailerAdapter } from './smtp-mailer.adapter';

/**
 * The SMTP adapter against a REAL server. Skipped unless `SMTP_IT_URL` names
 * one, so it never runs in the unit suite.
 *
 * Deliberately not called `*.spec.ts`: the unit suite's summary is read by a
 * gate that expects every collected test to pass, and a skipped suite would be
 * counted. Run it by name, through the config for suites the unit suite never
 * collects:
 *
 *   SMTP_IT_URL=smtp://localhost:1025 pnpm --filter @injishi/api exec vitest run --config vitest.manual.config.mts smtp-mailer
 *
 * `.unlazy/storage-mail/checks/leaf-1.2.1/check-smtp.mjs` starts Mailpit, runs
 * this, and then asserts through Mailpit's own API what arrived. This file
 * only proves the send was accepted; the check proves what was delivered. That
 * check still runs this under Jest and reads Jest's summary, so it needs the
 * command above and Vitest's summary before it can run again (2026-10-28).
 *
 * Inputs, all read from the environment:
 * - `SMTP_IT_URL`   the server to deliver to (required, or everything skips)
 * - `MAIL_FROM`     the sender, read by the adapter exactly as in production
 * - `SMTP_IT_TO`    recipient (default `otp-it@injishi.test`)
 * - `SMTP_IT_OTP`   the code to send (default: a fresh random one)
 * - `SMTP_IT_SILENT_URL` a server that accepts and never greets (default: one
 *   started here)
 */

const SMTP_IT_URL = process.env.SMTP_IT_URL?.trim();
const describeWithSmtp = SMTP_IT_URL ? describe : describe.skip;

const TO = process.env.SMTP_IT_TO?.trim() || 'otp-it@injishi.test';
const OTP =
  process.env.SMTP_IT_OTP?.trim() || String(randomInt(0, 1_000_000)).padStart(6, '0');

function configFrom(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

describeWithSmtp('SmtpMailerAdapter · a real SMTP server', () => {
  beforeAll(() => {
    // Nest's logger would print the boot line and the "sent" line into the
    // test report; the assertions below are what this run is for.
    vi.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });
  afterAll(() => vi.restoreAllMocks());

  it('delivers a sign-in code through OtpMailer and the transport chosen at boot', async () => {
    // Production posture on purpose, where OTP_DEBUG_LOG is ignored even when
    // set: a failed delivery must fail this test, never print the code and pass.
    const port = createMailer({
      smtpUrl: SMTP_IT_URL,
      mailFrom: process.env.MAIL_FROM,
      nodeEnv: 'production',
    });
    expect(port).toBeInstanceOf(SmtpMailerAdapter);

    const otpMailer = new OtpMailer(
      port,
      configFrom({ NODE_ENV: 'production', OTP_DEBUG_LOG: 'true' }),
    );
    await otpMailer.send({ email: TO, otp: OTP, type: 'sign-in' });
    (port as SmtpMailerAdapter).onModuleDestroy();
  }, 30_000);

  describe('a server that accepts the connection and never greets', () => {
    let server: Server | undefined;
    const sockets = new Set<Socket>();
    let silentUrl = process.env.SMTP_IT_SILENT_URL?.trim() ?? '';

    beforeAll(async () => {
      if (silentUrl) return;
      server = createServer((socket) => {
        sockets.add(socket);
        socket.on('error', () => undefined);
        socket.on('close', () => sockets.delete(socket));
      });
      await new Promise<void>((resolve) => server!.listen(0, '127.0.0.1', resolve));
      const address = server.address();
      if (address === null || typeof address === 'string') {
        throw new Error('silent server has no port');
      }
      silentUrl = `smtp://127.0.0.1:${address.port}`;
    });

    afterAll(async () => {
      for (const socket of sockets) socket.destroy();
      if (server) await new Promise<void>((resolve) => server!.close(() => resolve()));
    });

    it('is abandoned when the greeting bound runs out, not before and not long after', async () => {
      const adapter = new SmtpMailerAdapter(silentUrl, 'Injishi <no-reply@injishi.com>');
      const started = Date.now();
      const failure = await adapter
        .send({ to: TO, subject: 'Your Injishi sign-in code', text: OTP })
        .then(
          () => null,
          (error: unknown) => error,
        );
      const elapsed = Date.now() - started;
      adapter.onModuleDestroy();

      expect(failure).toBeInstanceOf(Error);
      expect((failure as Error).message).toMatch(/^SMTP delivery failed: /);
      expect(elapsed).toBeGreaterThanOrEqual(SMTP_TIMEOUTS.greetingTimeout - 250);
      expect(elapsed).toBeLessThan(SMTP_TIMEOUTS.greetingTimeout + 3_000);
    }, 30_000);
  });
});
