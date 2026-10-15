import {
  AssignHousekeepingTaskRequest,
  type HousekeepingBoard,
  type HousekeepingBoardEscalation,
  type HousekeepingBoardTask,
  InspectHousekeepingTaskRequest,
} from '@injishi/contracts';
import { Body, Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';

import { HousekeepingBoardService } from '../../../modules/operations/application/housekeeping-board.service';
import { CurrentUser, SessionGuard, type SessionUser } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * The housekeeping board -> /api/v1/ops/housekeeping (real-data 1.2.3).
 *
 * The read is the cleaning queue's read (`housekeeping.set` or `task.assign`), widened to the
 * property's rooms, today's allocation sheet, the open escalations, the rules and the rooms'
 * history: nothing on it touches a guest's money, which is why a housekeeper may hold it.
 *
 * Assigning is the supervisor's act (`task.assign`), exactly as creating a task is. Inspecting is
 * `housekeeping.set`, the permission that marks a room, and the service adds the rule a permission
 * cannot express: nobody passes a room they cleaned. Reminding is `task.assign`.
 */
@Controller({ path: 'ops/housekeeping', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsHousekeepingBoardController {
  constructor(private readonly board: HousekeepingBoardService) {}

  @Get('board')
  @RequireAnyPermission('housekeeping.set', 'task.assign')
  read(
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Query('propertyId') propertyId?: string,
  ): Promise<HousekeepingBoard> {
    return this.board.read(workspace, propertyId && UUID.test(propertyId) ? propertyId : undefined);
  }

  @Post('tasks/:id/assign')
  @RequirePermission('task.assign')
  assign(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AssignHousekeepingTaskRequest)) body: AssignHousekeepingTaskRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HousekeepingBoardTask> {
    return this.board.assign(workspace, id, body, user.id);
  }

  @Post('tasks/:id/inspection')
  @RequirePermission('housekeeping.set')
  inspect(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(InspectHousekeepingTaskRequest)) body: InspectHousekeepingTaskRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HousekeepingBoardTask> {
    return this.board.inspect(workspace, id, body, user.id);
  }

  @Post('escalations/:id/remind')
  @RequirePermission('task.assign')
  remind(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<HousekeepingBoardEscalation> {
    return this.board.remind(workspace, id, user.id);
  }
}
