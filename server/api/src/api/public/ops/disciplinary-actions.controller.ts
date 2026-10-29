import {
  CreateDisciplinaryActionRequest,
  type CreateDisciplinaryActionResponse,
  type DisciplinaryActionList,
  type FileLink,
} from '@injishi/contracts';
import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';

import { HrContentService } from '../../../modules/hr/application/hr-content.service';
import type { ScopedWorkspace } from '../../../shared/auth/branch-scope';
import {
  CurrentUser,
  SessionGuard,
  type SessionUser,
} from '../../../shared/auth/session.guard';
import {
  CurrentWorkspace,
  RequirePermission,
  WorkspaceGuard,
} from '../../../shared/auth/workspace.guard';
import { ZodValidationPipe } from '../../../shared/validation/zod-validation.pipe';

/**
 * Disciplinary records -> /api/v1/ops/disciplinary-actions (058-people-file
 * AC-PF8).
 *
 * `people.manage` alone, reads included: a warning on somebody's file is not
 * a work field. The person reads their own through self service. Naming
 * several people writes one row each, so nobody's record shows who else was
 * named; a dismissal answers `offerOffboarding` and offboards nobody itself.
 */
@Controller({ path: 'ops/disciplinary-actions', version: '1' })
@UseGuards(SessionGuard, WorkspaceGuard)
export class OpsDisciplinaryActionsController {
  constructor(private readonly content: HrContentService) {}

  /** Every record of the caller's branches, or one person's (`employeeId`). */
  @Get()
  @RequirePermission('people.manage')
  list(
    @Query('employeeId', new ParseUUIDPipe({ optional: true })) employeeId: string | undefined,
    @CurrentWorkspace() workspace: ScopedWorkspace,
  ): Promise<DisciplinaryActionList> {
    return this.content.disciplinaryActions(workspace, employeeId);
  }

  @Post()
  @RequirePermission('people.manage')
  record(
    @Body(new ZodValidationPipe(CreateDisciplinaryActionRequest)) body: CreateDisciplinaryActionRequest,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<CreateDisciplinaryActionResponse> {
    return this.content.recordDiscipline(workspace, user.id, body);
  }

  @Get(':id/file')
  @RequirePermission('people.manage')
  file(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentWorkspace() workspace: ScopedWorkspace,
    @CurrentUser() user: SessionUser,
  ): Promise<FileLink> {
    return this.content.disciplineFileLink(workspace, user.id, id);
  }
}
