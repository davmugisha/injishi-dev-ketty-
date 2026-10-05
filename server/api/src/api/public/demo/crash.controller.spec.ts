// The guards' import chain reaches Better Auth, which ships as ESM Jest does
// not transform. Stood in the way the personas spec does it.
jest.mock('@injishi/auth', () => ({
  DEMO_OTP_CODE: '123456',
  DEMO_COOKIE_PREFIX: 'injishi-demo',
  createAuth: (config: unknown) => ({ config }),
}));

import { NotFoundException } from '@nestjs/common';
import { GUARDS_METADATA } from '@nestjs/common/constants';

import { REQUIRE_STAFF_PERMISSION } from '../../../shared/auth/require-staff-permission.decorator';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import type { Platform } from '../../../shared/config/platform';
import { DEMO_CRASH_MESSAGE, DemoCrashController } from './crash.controller';

/**
 * `GET /api/v1/demo/crash` (ADR-063 AC-12): the forced 500 the verifier uses
 * to prove a request fault reaches Sentry. A 404 off the demo, a plain error
 * on it, and staff only.
 */
const DEMO: Platform = { environment: 'demo', sampleData: true, commit: null };
const PRODUCTION: Platform = { environment: 'production', sampleData: false, commit: null };

describe('DemoCrashController', () => {
  it('throws a plain error on the demo, the fault the filter exists for', () => {
    const controller = new DemoCrashController(DEMO);
    expect(() => controller.crash()).toThrow(DEMO_CRASH_MESSAGE);
    try {
      controller.crash();
    } catch (error) {
      expect(error).not.toBeInstanceOf(NotFoundException);
    }
  });

  it('is a 404 everywhere else', () => {
    expect(() => new DemoCrashController(PRODUCTION).crash()).toThrow(NotFoundException);
  });

  it('is behind the session and staff guards, with the System health permission', () => {
    expect(Reflect.getMetadata(GUARDS_METADATA, DemoCrashController)).toEqual([SessionGuard, StaffGuard]);
    expect(Reflect.getMetadata(REQUIRE_STAFF_PERMISSION, DemoCrashController.prototype.crash)).toBe(
      'admin.system.view',
    );
  });
});
