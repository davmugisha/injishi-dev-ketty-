import {
  CancelRosterEntryRequest,
  CreateRosterEntryRequest,
  CreateShiftTemplateRequest,
  ShiftTemplateQuery,
  type RosterEntry,
  type ListQuery,
  type RosterPage,
  type ShiftTemplate,
  type ShiftTemplateList,
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

import { TimeService } from '../../../modules/people/application/time.service';
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
 * Shift templates -> /api/v1/ops/shift-templates (ADR-058, AC-T1).
 *
 * Read by whoever builds the roster and by the desk that clocks people onto
 * it, so the clock in can name the shift.
 */
@Controller({ path: 'ops/shift-templates', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsShiftTemplatesController {
  constructor(private readonly time: TimeService) {}

  @Get()
  @RequireAnyPermission('roster.manage', 'attendance.record')
  list(
    @Query(new ZodValidationPipe(ShiftTemplateQuery)) query: ShiftTemplateQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<ShiftTemplateList> {
    return this.time.listTemplates(workspace, query);
  }

  @Post()
  @RequirePermission('roster.manage')
  create(
    @Body(new ZodValidationPipe(CreateShiftTemplateRequest)) body: CreateShiftTemplateRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<ShiftTemplate> {
    return this.time.createTemplate(workspace, body);
  }
}

/**
 * The roster -> /api/v1/ops/roster (ADR-058, AC-T1 to AC-T3, AC-T6).
 *
 * Entries carry roster cards (a name and a job title) and nothing else from the
 * HR file, so reading the roster exposes no sensitive field to the desk.
 */
@Controller({ path: 'ops/roster', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsRosterController {
  constructor(private readonly time: TimeService) {}

  @Get()
  @RequireAnyPermission('roster.manage', 'attendance.record', 'people.view')
  list(
    @Query(ListQueryPipe) query: ListQuery,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<RosterPage> {
    return this.time.listRoster(workspace, query);
  }

  @Post()
  @RequirePermission('roster.manage')
  create(
    @Body(new ZodValidationPipe(CreateRosterEntryRequest)) body: CreateRosterEntryRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RosterEntry> {
    return this.time.roster(workspace, user.id, body);
  }

  @Post(':id/cancel')
  @HttpCode(200)
  @RequirePermission('roster.manage')
  cancel(
    @Param('id', ParseUUIDPipe) id: string,
    @Body(new ZodValidationPipe(CancelRosterEntryRequest)) body: CancelRosterEntryRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<RosterEntry> {
    return this.time.cancelEntry(workspace, user.id, id, body);
  }
}
