import type { MyChecklists } from '@injishi/contracts';
import {
  Controller,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Post,
  UseGuards,
} from '@nestjs/common';

import { ChecklistsService } from '../../../modules/people/application/checklists.service';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';

/**
 * A person's own checklists -> /api/v1/me/work/:employeeId/checklists
 * (ADR-058; the shape of every `me/work` route, 058-self-service).
 *
 * `SessionGuard` only: ownership is the guard, and any id that is not the
 * caller's answers 404. A person reads every task of their joining or leaving
 * list, so they know what the office still owes them, and ticks only the ones
 * that are theirs to do. A file the person has left is read only (409).
 */
@Controller({ path: 'me/work', version: '1' })
@UseGuards(SessionGuard)
export class MeWorkChecklistsController {
  constructor(private readonly checklists: ChecklistsService) {}

  @Get(':employeeId/checklists')
  list(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<MyChecklists> {
    return this.checklists.mine(user.id, employeeId);
  }

  @Post(':employeeId/checklists/tasks/:taskId/done')
  @HttpCode(200)
  done(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<MyChecklists> {
    return this.checklists.setMineDone(user.id, employeeId, taskId, true);
  }

  @Post(':employeeId/checklists/tasks/:taskId/undo')
  @HttpCode(200)
  undo(
    @Param('employeeId', ParseUUIDPipe) employeeId: string,
    @Param('taskId', ParseUUIDPipe) taskId: string,
    @CurrentUser() user: SessionUser,
  ): Promise<MyChecklists> {
    return this.checklists.setMineDone(user.id, employeeId, taskId, false);
  }
}
