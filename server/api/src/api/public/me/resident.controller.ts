import {
  AnswerRenewalRequest,
  GiveNoticeRequest,
  IssueVisitorPassRequest,
  RaiseResidenceRepairRequest,
  type ResidenceView,
  type ResidenceWriteResult,
} from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { ResidenceInterfaceService } from '../../../modules/operations/application/residence-interface.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The tenant's phone → /api/v1/me/residence (real-data 1.3.1): their tenancy, rent, repairs,
 * visitors and renewal, and the few things a tenant does about them. Messages stay on
 * `/api/v1/me/threads`, which already serves a lease's conversations.
 *
 * `SessionGuard` only, like every `/me` route: a tenant holds no workspace, so ownership through
 * `leases.tenant_user_id` is the guard, and a lease, offer or unit that is not the caller's answers
 * 404 so a probe cannot learn that it exists.
 */
@Controller({ path: 'me/residence', version: '1' })
@UseGuards(SessionGuard)
export class MeResidentController {
  constructor(private readonly residence: ResidenceInterfaceService) {}

  @Get()
  view(@CurrentUser() user: SessionUser): Promise<ResidenceView> {
    return this.residence.tenantView(user.id);
  }

  @Post('repairs')
  raiseRepair(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(RaiseResidenceRepairRequest)) body: RaiseResidenceRepairRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.raiseTenantRepair(user.id, body);
  }

  @Post('visitor-passes')
  issuePass(
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(IssueVisitorPassRequest)) body: IssueVisitorPassRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.issueTenantPass(user.id, body);
  }

  @Post('leases/:id/notice')
  giveNotice(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(GiveNoticeRequest)) body: GiveNoticeRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.giveNotice(user.id, id, body);
  }

  @Post('offers/:id/answer')
  answerOffer(
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AnswerRenewalRequest)) body: AnswerRenewalRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.answerOffer(user.id, id, body);
  }
}
