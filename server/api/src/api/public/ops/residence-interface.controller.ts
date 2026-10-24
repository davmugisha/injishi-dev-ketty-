import {
  ConvertApplicationRequest,
  DecideAccessRequest,
  DeclineApplicationRequest,
  IssueVisitorPassRequest,
  MoveResidenceRepairRequest,
  RaiseResidenceRepairRequest,
  RecordNoticeRequest,
  RecordRentPaymentRequest,
  RecordScreeningRequest,
  ResidenceRepairMessageRequest,
  type ResidenceView,
  type ResidenceWriteResult,
  SendRentRemindersRequest,
} from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Put, UseGuards } from '@nestjs/common';

import { ResidenceInterfaceService } from '../../../modules/operations/application/residence-interface.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { IdempotencyKey } from '../../../shared/http/idempotency-key';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The residence manager's screens → /api/v1/ops/residence (real-data 1.3.1): one read model for the
 * landlord's buildings, and the commands of the Residence, Applicants, Leases, Rent roll, Move-outs
 * and Maintenance and Visitors screens.
 *
 * The existing tenancy routes (`/ops/leases`, `/ops/rent-roll`, `/ops/tickets`, `/ops/deposits`) stay
 * as they are; this adds what those screens need that nothing served.
 */
@Controller({ path: 'ops/residence', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsResidenceController {
  constructor(private readonly residence: ResidenceInterfaceService) {}

  // Anyone who works the building reads it; the service leaves out what their grant does not cover
  // (rent and deposits need the money, tickets `ticket.advance`, the tenancy pipeline `lease.manage`).
  @Get()
  @RequireAnyPermission('lease.manage', 'rent.record', 'money.view', 'ticket.advance', 'deposit.return')
  view(@CurrentWorkspace() ws: ScopedWorkspace): Promise<ResidenceView> {
    return this.residence.view(ws);
  }

  /** Raise a repair on a unit or a block's common area; it gets the next WO number. */
  @Post('repairs')
  @RequirePermission('ticket.advance')
  raiseRepair(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(RaiseResidenceRepairRequest)) body: RaiseResidenceRepairRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.raiseRepair(ws, user.id, body);
  }

  @Post('repairs/:id/move')
  @RequirePermission('ticket.advance')
  moveRepair(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(MoveResidenceRepairRequest)) body: MoveResidenceRepairRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.moveRepair(ws, id, body, user.id);
  }

  /** An internal note, or a reply to the resident (which also needs `message.send`, checked inside). */
  @Post('repairs/:id/messages')
  @RequirePermission('ticket.advance')
  repairMessage(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResidenceRepairMessageRequest)) body: ResidenceRepairMessageRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.repairMessage(ws, id, body, user.id);
  }

  /** Who may come through the gate is part of running the tenancies: `lease.manage`. */
  @Post('visitor-passes')
  @RequirePermission('lease.manage')
  issuePass(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(IssueVisitorPassRequest)) body: IssueVisitorPassRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.issuePass(ws, user.id, body);
  }

  @Post('access-requests/:id/decision')
  @RequirePermission('lease.manage')
  decideAccess(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DecideAccessRequest)) body: DecideAccessRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.decideAccess(ws, id, body, user.id);
  }

  /**
   * Save a payment received outside the app, as pending (AC-14). It moves money onto the books once
   * verified, so it takes an `Idempotency-Key` like every rent command.
   */
  @Post('rent-payments')
  @RequirePermission('rent.record')
  recordPayment(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @IdempotencyKey() key: string,
    @Body(new ZodValidationPipe(RecordRentPaymentRequest)) body: RecordRentPaymentRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.recordPayment(ws, user.id, key, body);
  }

  @Post('rent-reminders')
  @RequirePermission('rent.record')
  sendReminders(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(SendRentRemindersRequest)) body: SendRentRemindersRequest,
  ): Promise<ResidenceWriteResult[]> {
    return this.residence.sendReminders(ws, user.id, body);
  }

  /** A notice that came by letter, email or in person; the resident's own goes through `/me/residence`. */
  @Post('notices')
  @RequirePermission('lease.manage')
  recordNotice(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Body(new ZodValidationPipe(RecordNoticeRequest)) body: RecordNoticeRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.recordNotice(ws, user.id, body);
  }

  @Post('offers/:id/withdraw')
  @RequirePermission('lease.manage')
  withdrawOffer(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResidenceWriteResult> {
    return this.residence.withdrawOffer(ws, id, user.id);
  }

  @Post('offers/:id/remind')
  @RequirePermission('lease.manage')
  remindOffer(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @Param('id', ParseUUIDPipe) id: string,
  ): Promise<ResidenceWriteResult> {
    return this.residence.remindOffer(ws, id);
  }

  /** The manual screening checks recorded so far, as a whole set (a retry writes the same set). */
  @Put('applications/:id/screening')
  @RequirePermission('lease.manage')
  recordScreening(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(RecordScreeningRequest)) body: RecordScreeningRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.recordScreening(ws, id, body);
  }

  @Post('applications/:id/decline')
  @RequirePermission('lease.manage')
  declineApplication(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(DeclineApplicationRequest)) body: DeclineApplicationRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.declineApplication(ws, id, body);
  }

  @Post('applications/:id/convert')
  @RequirePermission('lease.manage')
  convertApplication(
    @CurrentWorkspace() ws: ScopedWorkspace,
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ConvertApplicationRequest)) body: ConvertApplicationRequest,
  ): Promise<ResidenceWriteResult> {
    return this.residence.convertApplication(ws, id, body);
  }
}
