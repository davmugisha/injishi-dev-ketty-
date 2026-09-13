import {
  type OversightDecisionPage,
  type OversightGrant,
  OversightDecisionQuery,
  type OversightQueueItem,
} from '@injishi/contracts';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';

import { RegistrationService } from '../../../modules/organization/application/registration.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentOversight,
  OversightGuard,
  RequireOversight,
} from '../../../shared/auth/oversight.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The government console's read side → /api/v1/oversight/* (F-S03 §6, D25).
 *
 * Two routes rather than one parameterised by function, on purpose: the guard
 * has to name a single function at declaration time, and a `?role=` parameter
 * would move that choice to the caller — which is exactly the thing a field
 * verifier must not be able to ask for.
 *
 * The government console is a separate SURFACE (D19) and never shares a session
 * with the admin panel. These routes serve that surface; admin gets its own
 * review queue under F-A03 and reads different rows for a different reason.
 */
@Controller({ path: 'oversight', version: '1' })
export class OversightController {
  constructor(private readonly registrations: RegistrationService) {}

  /** Businesses waiting on a physical check, inside this verifier's region. */
  @Get('verification-queue')
  @UseGuards(SessionGuard, OversightGuard)
  @RequireOversight('business_field_verifier')
  verificationQueue(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<OversightQueueItem[]> {
    return this.registrations.queueFor(user.id, grants);
  }

  /**
   * Businesses waiting on approval, inside this approver's region.
   *
   * Rows this officer field-verified themselves are still listed, flagged with
   * `blockedBySeparationOfDuties`. Hiding them would leave the queue looking
   * empty while work sat in it; flagging them lets the console say who has to
   * pick it up instead.
   */
  @Get('approval-queue')
  @UseGuards(SessionGuard, OversightGuard)
  @RequireOversight('business_approver')
  approvalQueue(
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<OversightQueueItem[]> {
    return this.registrations.queueFor(user.id, grants);
  }

  /**
   * The officer's own decisions, newest first, cursor paged (ADR-053, AC-G6).
   *
   * Guarded per function exactly as the queues are: a field verifier or an
   * approver reads it, and a tax compliance officer, who decides no gate, is
   * refused. The answer does not depend on which grant let them in, because it
   * is keyed on the person who decided, so one route serves both functions.
   */
  @Get('decisions')
  @UseGuards(SessionGuard, OversightGuard)
  @RequireOversight('business_field_verifier', 'business_approver')
  decisions(
    @CurrentUser() user: SessionUser,
    @Query(new ZodValidationPipe(OversightDecisionQuery))
    query: OversightDecisionQuery,
  ): Promise<OversightDecisionPage> {
    return this.registrations.decisionsFor(user.id, query.cursor);
  }
}
