import {
  type HousekeepingPhone,
  type HousekeepingTaskCheck,
  LogPhoneFoundItemRequest,
  type MinibarCount,
  type PhoneFoundItem,
  ResolveWorkOrderRequest,
  SendMinibarCountRequest,
  SetHousekeepingCheckRequest,
  type WorkOrder,
  type WorkOrderTimeLogList,
  WorkOrderTimerRequest,
} from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { StaffPhoneService } from '../../../modules/operations/application/staff-phone.service';
import { WorkOrderTimeService } from '../../../modules/operations/application/work-order-time.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The housekeeping phone -> /api/v1/ops/housekeeping (real-data 1.3.3), beside the board.
 *
 * The read is the board's read (`housekeeping.set` or `task.assign`). Ticking a step, sending the
 * minibar count and logging a found item are `housekeeping.set`, the permission that marks a room, and
 * the service adds what a permission cannot say: only the room's own cleaner (or a supervisor who
 * assigns tasks) records on it. A found item lands in the lost and found register with the cleaner as
 * finder; keeping the register stays `lostfound.manage`'s.
 */
@Controller({ path: 'ops/housekeeping', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsHousekeepingPhoneController {
  constructor(private readonly phone: StaffPhoneService) {}

  @Get('phone')
  @RequireAnyPermission('housekeeping.set', 'task.assign')
  read(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
    @Query('propertyId') propertyId?: string,
  ): Promise<HousekeepingPhone> {
    return this.phone.read(workspace, user.id, propertyId && UUID.test(propertyId) ? propertyId : undefined);
  }

  @Post('tasks/:id/checks')
  @RequirePermission('housekeeping.set')
  setCheck(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SetHousekeepingCheckRequest)) body: SetHousekeepingCheckRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HousekeepingTaskCheck[]> {
    return this.phone.setCheck(workspace, id, body, user.id);
  }

  @Post('tasks/:id/minibar')
  @RequirePermission('housekeeping.set')
  sendMinibar(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(SendMinibarCountRequest)) body: SendMinibarCountRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<MinibarCount[]> {
    return this.phone.sendMinibar(workspace, id, body, user.id);
  }

  @Post('tasks/:id/found-items')
  @RequirePermission('housekeeping.set')
  logFoundItem(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(LogPhoneFoundItemRequest)) body: LogPhoneFoundItemRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<PhoneFoundItem> {
    return this.phone.logFoundItem(workspace, id, body, user.id);
  }
}

/**
 * The technician's phone -> /api/v1/ops (real-data 1.3.3): time on a work order, starting it and
 * marking it fixed. All `ticket.advance`, the permission that works an order; the service refuses an
 * order that is not on the caller's own list. Releasing a room stays `listing.manage`'s.
 */
@Controller({ path: 'ops', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsWorkOrderTimeController {
  constructor(private readonly time: WorkOrderTimeService) {}

  @Get('maintenance-time-logs')
  @RequirePermission('ticket.advance')
  logs(@CurrentWorkspace() workspace: ScopedWorkspace): Promise<WorkOrderTimeLogList> {
    return this.time.logs(workspace);
  }

  @Post('work-orders/:id/timer')
  @RequirePermission('ticket.advance')
  timer(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(WorkOrderTimerRequest)) body: WorkOrderTimerRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<WorkOrder> {
    return this.time.timer(workspace, id, body, user.id);
  }

  @Post('work-orders/:id/start')
  @RequirePermission('ticket.advance')
  start(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<WorkOrder> {
    return this.time.start(workspace, id, user.id);
  }

  @Post('work-orders/:id/resolve')
  @RequirePermission('ticket.advance')
  resolve(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(ResolveWorkOrderRequest)) body: ResolveWorkOrderRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<WorkOrder> {
    return this.time.resolve(workspace, id, body, user.id);
  }
}
