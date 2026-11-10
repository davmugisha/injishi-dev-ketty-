import {
  type AssetLoanList,
  CreateHrTicketRequest,
  type HrTicket,
  type HrTicketList,
  ReplyHrTicketRequest,
} from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, UseGuards } from '@nestjs/common';

import { HrFeatureOn } from '../../../modules/hr/application/hr-feature.guard';
import { HrDeskService } from '../../../modules/hr/application/hr-desk.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * A person's own help desk questions and the things lent to them -> /api/v1/me/work/:employeeId
 * (058-staff-services). `SessionGuard` only, as every `me/work` route: ownership is the guard, and
 * any id that is not the caller's answers 404.
 */
@Controller({ path: 'me/work', version: '1' })
@UseGuards(SessionGuard)
export class MeWorkDeskController {
  constructor(private readonly desk: HrDeskService) {}

  @Get(':employeeId/tickets')
  tickets(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<HrTicketList> {
    return this.desk.myTickets(user.id, employeeId);
  }

  @HrFeatureOn('helpDesk')
  @Post(':employeeId/tickets')
  ask(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Body(new ZodValidationPipe(CreateHrTicketRequest)) body: CreateHrTicketRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<HrTicket> {
    return this.desk.ask(user.id, employeeId, body);
  }

  @HrFeatureOn('helpDesk')
  @Post(':employeeId/tickets/:id/messages')
  reply(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ReplyHrTicketRequest)) body: ReplyHrTicketRequest,
    @CurrentUser() user: SessionUser,
  ): Promise<HrTicket> {
    return this.desk.replyMine(user.id, employeeId, id, body);
  }

  @Get(':employeeId/assets')
  assets(@Param('employeeId', ParseUUIDPipe) employeeId: string, @CurrentUser() user: SessionUser): Promise<AssetLoanList> {
    return this.desk.myLoans(user.id, employeeId);
  }
}
