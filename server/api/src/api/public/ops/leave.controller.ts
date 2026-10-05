import {
  CreateLeaveRequestRequest,
  LeaveBulkRequest,
  LeaveDecisionRequest,
  type BulkResponse,
  type LeaveRequest,
  type LeaveRequestPage,
  type ListIds,
  type ListQuery,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { LeaveService } from '../../../modules/people/application/leave.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ListQueryPipe } from '../../../shared/lists/list-query';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Leave requests -> /api/v1/ops/leave/requests (ADR-058, AC-L1, AC-L4, AC-L5).
 *
 * Deciding is `leave.approve`, and never on one's own request. A request is
 * routed to the person's reporting manager first; that orders the queue and
 * grants nothing.
 */
@Controller({ path: 'ops/leave/requests', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsLeaveController {
  constructor(private readonly leave: LeaveService) {}

  /** One page of the queue through the list contract (058-list-framework). */
  @Get()
  @RequirePermission('leave.approve')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequestPage> {
    return this.leave.list(workspace, user.id, query);
  }

  /** Select all over the queue: the matching ids up to the bulk cap, and how many match. */
  @Get('ids')
  @RequirePermission('leave.approve')
  ids(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<ListIds> {
    return this.leave.ids(workspace, user.id, query);
  }

  /**
   * Approve or refuse several requests, each as the single command. Answers
   * 200 with a result per id, so a partial success is reported row by row.
   */
  @Post('bulk')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  bulk(
    @Body(new ZodValidationPipe(LeaveBulkRequest)) body: LeaveBulkRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<BulkResponse> {
    return this.leave.bulk(workspace, user.id, body);
  }

  /** File leave for someone. Its days are an estimate until approved. */
  @Post()
  @RequireAnyPermission('leave.approve', 'people.manage')
  create(
    @Body(new ZodValidationPipe(CreateLeaveRequestRequest)) body: CreateLeaveRequestRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.request(workspace, user.id, body);
  }

  @Post(':id/approve')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  approve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LeaveDecisionRequest)) body: LeaveDecisionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.approve(workspace, user.id, id, body.note?.trim() || null);
  }

  @Post(':id/reject')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LeaveDecisionRequest)) body: LeaveDecisionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.reject(workspace, user.id, id, body.note?.trim() || null);
  }

  /** An approved leave cancelled writes a reversal for each month it took. */
  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('leave.approve')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LeaveDecisionRequest)) body: LeaveDecisionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<LeaveRequest> {
    return this.leave.cancel(workspace, user.id, id, body.note?.trim() || null);
  }
}
