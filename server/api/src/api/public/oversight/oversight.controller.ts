import {
  type OversightDecisionPage,
  type OversightDocumentList,
  type OversightGrant,
  OversightDecisionQuery,
  type OversightQueueItem,
} from '@injishi/contracts';
import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

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
   * The documents one registration carries → the evidence half of the field
   * verifier's job (F-S03 §5).
   *
   * BOTH functions read it, and that is the point of the route. The verifier
   * goes and looks; the approver has to see what the verifier saw, and could
   * previously approve a business whose documents were unreachable through any
   * API at all.
   *
   * Region and conflict of interest are checked by the service against the
   * business itself, with the same helper the gates use — a read that informs a
   * decision must not be laxer than the decision.
   */
  @Get('registrations/:orgId/documents')
  @UseGuards(SessionGuard, OversightGuard)
  @RequireOversight('business_field_verifier', 'business_approver')
  documents(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<OversightDocumentList> {
    return this.registrations.documentsFor(orgId, grants, user.id);
  }

  /**
   * Record that this officer has read one document (F-S03 §5).
   *
   * The field verifier's act alone. The approver reads the file and decides on
   * it; they do not get to certify that somebody looked. 200 rather than 201: a
   * second press is not a second check, and the answer is the list as it now
   * stands so the console redraws from the server rather than guessing.
   */
  @Post('registrations/:orgId/documents/:documentId/check')
  @HttpCode(200)
  @UseGuards(SessionGuard, OversightGuard)
  @RequireOversight('business_field_verifier')
  checkDocument(
    @Param('orgId', ParseUUIDPipe) orgId: string,
    @Param('documentId', ParseUUIDPipe) documentId: string,
    @CurrentUser() user: SessionUser,
    @CurrentOversight() grants: OversightGrant[],
  ): Promise<OversightDocumentList> {
    return this.registrations.checkDocument(orgId, documentId, grants, user.id);
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
