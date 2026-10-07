import { Controller, Get, Inject, NotFoundException, UseGuards } from '@nestjs/common';

import { RequireStaffPermission } from '../../../shared/auth/require-staff-permission.decorator';
import { SessionGuard } from '../../../shared/auth/session.guard';
import { StaffGuard } from '../../../shared/auth/staff.guard';
import { PLATFORM, type Platform } from '../../../shared/config/platform';

/** What the forced fault says, so it is recognisable in Sentry. */
export const DEMO_CRASH_MESSAGE = 'Demo crash, forced to prove the API reports a 500 (ADR-063)';

/**
 * `GET /api/v1/demo/crash`: a forced 500, on the demo only (ADR-063 AC-12).
 *
 * The verifier calls it to prove a fault in a request reaches Sentry with its
 * route pattern and nothing from the request. A 404 everywhere but the demo,
 * and staff only even there, with the permission the System health section
 * already asks for: whoever may read the platform's health may test its alarm.
 */
@Controller('demo/crash')
@UseGuards(SessionGuard, StaffGuard)
export class DemoCrashController {
  constructor(@Inject(PLATFORM) private readonly platform: Platform) {}

  @Get()
  @RequireStaffPermission('admin.system.view')
  crash(): never {
    if (this.platform.environment !== 'demo') throw new NotFoundException();
    // A plain Error, not an HttpException: the fault the filter exists for.
    throw new Error(DEMO_CRASH_MESSAGE);
  }
}
