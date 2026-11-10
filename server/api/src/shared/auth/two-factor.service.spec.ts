import { describe, expect, it, type Mock, vi } from 'vitest';

import { createHash } from 'node:crypto';

import type { OtpMailer } from '../../modules/auth/infrastructure/otp-mailer';
import type { Platform } from '../config/platform';
import type { Database } from '../database/database.module';
import { TwoFactorService } from './two-factor.service';

/**
 * Which step-up code is issued, and that it is always mailed.
 *
 * A demo process (ADR-043) issues the fixed, public code and still mails it:
 * the demo stack's mail goes to its own Mailpit, and locally Mailpit shows it
 * too. A production process, staging included, mails a fresh random code.
 */
describe('TwoFactorService.sendCode', () => {
  const EMAIL = 'operator@example.com';

  function build(platform: Platform): {
    service: TwoFactorService;
    send: Mock;
    stored: Mock;
  } {
    const selects = [[], [{ email: EMAIL }]];
    const stored = vi.fn();
    const db = {
      select: vi.fn(() => ({
        from: () => ({ where: () => ({ limit: () => Promise.resolve(selects.shift() ?? []) }) }),
      })),
      insert: vi.fn(() => ({
        values: (row: unknown) => {
          stored(row);
          return { onConflictDoUpdate: () => Promise.resolve() };
        },
      })),
    };
    const send = vi.fn().mockResolvedValue(undefined);
    const service = new TwoFactorService(
      db as unknown as Database,
      platform,
      { send } as unknown as OtpMailer,
    );
    return { service, send, stored };
  }

  const hash = (code: string): string => createHash('sha256').update(code).digest('hex');

  it('a demo process stores and mails the fixed code', async () => {
    const { service, send, stored } = build({ environment: 'demo', sampleData: true, commit: null });

    const result = await service.sendCode('user-1', 'session-1');

    expect(stored).toHaveBeenCalledWith(
      expect.objectContaining({ sessionId: 'session-1', codeHash: hash('123456') }),
    );
    expect(send).toHaveBeenCalledWith(
      expect.objectContaining({ email: EMAIL, otp: '123456', type: 'email-verification' }),
    );
    expect(result.expiresInSeconds).toBe(600);
  });

  it('a production process mails a fresh random code, never the demo one', async () => {
    const { service, send, stored } = build({ environment: 'production', sampleData: false, commit: null });

    await service.sendCode('user-1', 'session-1');

    expect(send).toHaveBeenCalledTimes(1);
    const { otp, email, type } = send.mock.calls[0][0];
    expect(email).toBe(EMAIL);
    expect(type).toBe('email-verification');
    expect(otp).toMatch(/^\d{6}$/);
    expect(stored).toHaveBeenCalledWith(expect.objectContaining({ codeHash: hash(otp) }));
  });

  it('staging (production on a sample database) is not the demo', async () => {
    // Random codes: five draws that all came out the same would be a constant.
    const otps = new Set<string>();
    for (let i = 0; i < 5; i += 1) {
      const { service, send } = build({ environment: 'production', sampleData: true, commit: null });
      await service.sendCode('user-1', 'session-1');
      otps.add(send.mock.calls[0][0].otp);
    }
    expect(otps.size).toBeGreaterThan(1);
  });
});
