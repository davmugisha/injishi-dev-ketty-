import {
  AdvanceHousekeepingTaskRequest,
  CreateHousekeepingTaskRequest,
  type OperatorHousekeepingTask,
  type OperatorHousekeepingTaskList,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Headers,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { HousekeepingService } from '../../../modules/operations/application/housekeeping.service';
import { SessionGuard } from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequireAnyPermission,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * The cleaning queue -> /api/v1/ops/housekeeping-tasks (ADR-016 slice 5).
 *
 * THE READ IS ANY OF `housekeeping.set` OR `task.assign`. A housekeeper
 * holds exactly `housekeeping.set` and `ticket.advance`; gating their own
 * queue on `task.assign` alone would 403 them out of the only screen they use.
 * A receptionist holds neither and is refused, as is a business still in the
 * registration pipeline (audit H1).
 *
 * The two commands are gated on different permissions for the same reason:
 * CREATING and assigning a task is a supervisor's act (`task.assign`), and
 * MARKING one done is the cleaner's (`housekeeping.set`).
 *
 * `Idempotency-Key` is optional on create rather than required, unlike the
 * money commands. The phone app is offline half the time and replays, but a
 * duplicate cleaning task costs a wasted trip rather than a guest's money.
 */
@Controller({ path: 'ops/housekeeping-tasks', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsHousekeepingController {
  constructor(private readonly housekeeping: HousekeepingService) {}

  @Get()
  @RequireAnyPermission('housekeeping.set', 'task.assign')
  async list(
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorHousekeepingTaskList> {
    return { tasks: await this.housekeeping.list(workspace) };
  }

  @Post()
  @RequirePermission('task.assign')
  create(
    @Body(new ZodValidationPipe(CreateHousekeepingTaskRequest))
    body: CreateHousekeepingTaskRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @Headers('idempotency-key') key: string | undefined,
  ): Promise<OperatorHousekeepingTask> {
    return this.housekeeping.create(workspace, body, key ?? null);
  }

  @Post(':id/advance')
  @RequirePermission('housekeeping.set')
  advance(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(AdvanceHousekeepingTaskRequest))
    body: AdvanceHousekeepingTaskRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<OperatorHousekeepingTask> {
    return this.housekeeping.advance(workspace, id, body);
  }
}
