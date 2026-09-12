import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';

import type { MailerPort, MailMessage } from '../../mailer/domain/mailer-port';
import { UnconfiguredMailerAdapter } from '../../mailer/infrastructure/smtp-mailer.adapter';
import { OtpMailer } from './otp-mailer';

/**
 * `OtpMailer` owns the words and the failure rule, and nothing about how a
 * message leaves the building. So the port is faked here: a recorder for the
 * success path, a refusal and a silence for the two ways a send fails.
 *
 * The rule under test is the one a printed code makes security-critical: a
 * code reaches the log ONLY with `OTP_DEBUG_LOG=true` outside production, and
 * otherwise a failed send raises rather than leaving someone with no code.
 */

const OTP = '482913';
const EMAIL = 'guest@example.com';

function configFrom(env: Record<string, string | undefined>): ConfigService {
  return { get: (key: string) => env[key] } as unknown as ConfigService;
}

function recorder(): MailerPort & { sent: MailMessage[] } {
  const sent: MailMessage[] = [];
  return {
    sent,
    send: async (message) => {
      sent.push(message);
    },
  };
}

const refusing: MailerPort = {
  send: () => Promise.reject(new Error('SMTP delivery failed: 550 no such user')),
};

let warn: jest.SpyInstance;
let error: jest.SpyInstance;

beforeEach(() => {
  jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
  error = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
});
afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

/** Every line written through the Nest logger during the test. */
function logged(): string {
  return [...warn.mock.calls, ...error.mock.calls]
    .map((call) => String(call[0]))
    .join('\n');
}

describe('OtpMailer · delivery through the port', () => {
  it('mails a sign-in code: one recipient, the sign-in subject, the code in both parts', async () => {
    const port = recorder();
    await new OtpMailer(port, configFrom({})).send({
      email: EMAIL,
      otp: OTP,
      type: 'sign-in',
    });
    expect(port.sent).toHaveLength(1);
    const [mail] = port.sent;
    expect(mail.to).toBe(EMAIL);
    expect(mail.subject).toBe('Your Injishi sign-in code');
    expect(mail.text).toBe(
      `Your Injishi code is ${OTP}. It expires in 10 minutes. If you didn't request this, you can ignore this email.`,
    );
    expect(mail.html).toContain(`>${OTP}</div>`);
  });

  it('words a step-up as a verification code', async () => {
    const port = recorder();
    await new OtpMailer(port, configFrom({})).send({
      email: EMAIL,
      otp: OTP,
      type: 'email-verification',
    });
    expect(port.sent[0].subject).toBe('Your Injishi verification code');
  });
});

describe('OtpMailer · a failed send', () => {
  it('raises, and never writes the code down', async () => {
    await expect(
      new OtpMailer(refusing, configFrom({ NODE_ENV: 'development' })).send({
        email: EMAIL,
        otp: OTP,
        type: 'sign-in',
      }),
    ).rejects.toThrow('Failed to send OTP email: SMTP delivery failed: 550 no such user');
    expect(logged()).not.toContain(OTP);
  });

  it('raises when no transport is configured', async () => {
    await expect(
      new OtpMailer(new UnconfiguredMailerAdapter(), configFrom({})).send({
        email: EMAIL,
        otp: OTP,
        type: 'sign-in',
      }),
    ).rejects.toThrow('Failed to send OTP email: SMTP_URL is not set');
  });

  it('logs the code instead with OTP_DEBUG_LOG=true outside production', async () => {
    await expect(
      new OtpMailer(
        new UnconfiguredMailerAdapter(),
        configFrom({ NODE_ENV: 'development', OTP_DEBUG_LOG: 'true' }),
      ).send({ email: EMAIL, otp: OTP, type: 'sign-in' }),
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledWith(
      `[OTP_DEBUG_LOG] SMTP_URL is not set — OTP for ${EMAIL} (sign-in): ${OTP}`,
    );
  });

  it('ignores OTP_DEBUG_LOG in production: raises, and the code is never logged', async () => {
    await expect(
      new OtpMailer(
        refusing,
        configFrom({ NODE_ENV: 'production', OTP_DEBUG_LOG: 'true' }),
      ).send({ email: EMAIL, otp: OTP, type: 'sign-in' }),
    ).rejects.toThrow(/Failed to send OTP email/);
    expect(logged()).not.toContain(OTP);
  });

  it('abandons a transport that never answers after 8 seconds, not before', async () => {
    jest.useFakeTimers();
    const silent: MailerPort = { send: () => new Promise<void>(() => undefined) };
    const sending = new OtpMailer(silent, configFrom({})).send({
      email: EMAIL,
      otp: OTP,
      type: 'sign-in',
    });
    const settled = jest.fn();
    sending.then(settled, settled);

    await jest.advanceTimersByTimeAsync(7_999);
    expect(settled).not.toHaveBeenCalled();

    await jest.advanceTimersByTimeAsync(1);
    await expect(sending).rejects.toThrow(
      'Failed to send OTP email: mail transport did not respond within 8000ms',
    );
  });
});
