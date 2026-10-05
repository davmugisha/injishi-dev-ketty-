// The guards' import chain reaches Better Auth, which ships as ESM Jest does not
// transform. Only the guard CLASSES are compared below, so the auth package is
// stood in for the same way `auth.module.spec.ts` does it.
jest.mock('@injishi/auth', () => ({
  DEMO_OTP_CODE: '123456',
  DEMO_COOKIE_PREFIX: 'injishi-demo',
  createAuth: (config: unknown) => ({ config }),
}));

import { BadRequestException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { AssistantUsageQuery } from '@injishi/contracts';

import { DEFAULT_PRICES } from '../../../modules/assistant/domain/usage';
import { buildUsageReport } from '../../../modules/assistant/infrastructure/usage-queries';
import { REQUIRE_STAFF_PERMISSION } from '../../../shared/auth/require-staff-permission.decorator';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';
import { AdminAssistantUsageController } from './assistant-usage.controller';

/**
 * The assistant's monthly usage for staff (ADR-061 D-s). The ledger and its
 * SQL are tested where they live; this pins who may call the route, the month
 * it reads, and that what it returns matches the contract.
 */
function controller(
  report: (month: string) => unknown = (month) => buildUsageReport({ month, prices: DEFAULT_PRICES, usage: [], turns: [], tools: [] }),
): { controller: AdminAssistantUsageController; asked: string[] } {
  const asked: string[] = [];
  const ledger = {
    report: (month: string) => {
      asked.push(month);
      return Promise.resolve(report(month) as ReturnType<typeof buildUsageReport>);
    },
  };
  return { controller: new AdminAssistantUsageController(ledger), asked };
}

describe('AdminAssistantUsageController (ADR-061 D-s)', () => {
  it('is behind a staff session and admin.analytics.view', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, AdminAssistantUsageController)).toEqual([SessionGuard, StaffGuard]);
    expect(Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, AdminAssistantUsageController.prototype.read)).toBe(
      'admin.analytics.view',
    );
  });

  it('reads the month asked for, or the current UTC month', async () => {
    const { controller: c, asked } = controller();
    expect((await c.read({ month: '2026-09' })).month).toBe('2026-09');
    await c.read({});
    expect(asked).toEqual(['2026-09', new Date().toISOString().slice(0, 7)]);
  });

  it.each(['2026-9', '2026-13', 'october', '2026-10-01'])('refuses a month that is not YYYY-MM: "%s"', (month) => {
    expect(() => new ZodValidationPipe(AssistantUsageQuery).transform({ month })).toThrow(
      BadRequestException,
    );
  });

  it('returns the turn log section through the contract, not stripped by it (D-s)', async () => {
    const { controller: c } = controller();
    const report = await c.read({ month: '2026-10' });
    expect(report.turns.byOutcome).toEqual({ answered: 0, fallback: 0, withheld: 0, truncated: 0, out_of_time: 0, step_limit: 0, refused: 0, failed: 0 });
    expect(report.turns.modelCallsPerModelTurn).toEqual({ one: 0, two: 0, threeOrMore: 0 });
  });

  it('refuses to return a report the contract does not allow', async () => {
    const { controller: c } = controller((month) => ({
      ...buildUsageReport({ month, prices: DEFAULT_PRICES, usage: [], turns: [], tools: [] }),
      byCallerRole: [{ callerRole: 'superuser', modelRequests: 1, estimatedCostUsd: 0 }],
    }));
    await expect(c.read({ month: '2026-10' })).rejects.toThrow();
  });
});
